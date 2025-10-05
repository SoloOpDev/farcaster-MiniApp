import express from 'express';
import fetch from 'node-fetch';
// import type { Express } from "express"; // Removed for JS compatibility
import { createServer } from "http";
import { storage } from "./storage.js";
import { insertUserClaimSchema } from "../shared/schema.js";
import { z } from "zod";
import Parser from 'rss-parser';
import { createHash } from 'crypto';

import { JSDOM } from 'jsdom';
import { extractHtmlFromArticlePage, extractHtmlFromArticlePageCached, getCachedExtraction } from './lib/extractor.js';
import { isAddress } from 'ethers';

// Fix require import for CommonJS modules in ES modules
const { createRequire } = await import('module');
const require = createRequire(import.meta.url);

// Import scraping function now comes from shared module './lib/extractor.js'

// --- Simple In-Memory Cache ---
let cachedNews = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for detailed article payloads keyed by id
const articleCache = new Map(); // id -> { data, ts }
const ARTICLE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const NEWS_SWR_REVALIDATE_MS = 2 * 60 * 1000; // revalidate in background after 2 min

// Clear cache to force refresh with new ID format
cachedNews = null;
cacheTimestamp = 0;


function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.toString();
  } catch {
    return u;
  }
}

// Simple limited-concurrency runner
async function runLimited(items, concurrency, worker) {
  const q = [...items];
  const running = new Set();
  async function runOne() {
    const item = q.shift();
    if (!item) return;
    const p = Promise.resolve().then(() => worker(item)).finally(() => running.delete(p));
    running.add(p);
  }
  const initial = Math.min(concurrency, q.length);
  for (let i = 0; i < initial; i++) runOne();
  while (running.size) {
    await Promise.race([...running]);
    if (q.length) runOne();
  }
}

async function fetchNewsNow() {
  const parser = new Parser({
    requestOptions: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsFetcher/1.0; +https://example.com)'
      }
    },
    customFields: {
      item: ['content:encoded', ['media:content', 'media'], ['media:thumbnail', 'thumbnail'], ['enclosure', 'enclosure']]
    }
  });
  const RSS_URL = 'https://www.coindesk.com/arc/outboundfeeds/rss/';
  // 3s timeout to avoid hanging first paint
  const TIMEOUT_MS = 3000;
  const timer = new Promise((_, rej) => setTimeout(() => rej(new Error('RSS_TIMEOUT')), TIMEOUT_MS));
  let feed;
  try {
    feed = await Promise.race([parser.parseURL(RSS_URL), timer]);
  } catch (e) {
    // quick single retry on network/timeout only
    if (String(e?.message || '').includes('RSS_TIMEOUT') || String(e?.message || '').includes('network')) {
      feed = await parser.parseURL(RSS_URL);
    } else {
      throw e;
    }
  }
  const items = feed.items.slice(0, 10);
  const results = items.map((item, index) => ({
    id: (index + 1).toString(),
    title: item.title || '',
    description: item.contentSnippet || item.content || '',
    content: item['content:encoded'] || '',
    published_at: item.pubDate || new Date().toISOString(),
    kind: "news",
    source: { title: 'CoinDesk', domain: 'coindesk.com' },
    original_url: item.link || '',
    image: item.media?.$.url || item.enclosure?.url || item.thumbnail?.$.url || null,
  }));
  const storageArticles = items.map((item, index) => ({
    id: (index + 1).toString(),
    title: item.title || '',
    description: item.contentSnippet || item.content || '',
    publishedAt: new Date(item.pubDate || new Date().toISOString()),
    kind: 'article',
    sourceTitle: 'CoinDesk',
    sourceDomain: 'coindesk.com',
    originalUrl: item.link || '',
    url: item.link || '',
    image: item.media?.$.url || item.enclosure?.url || item.thumbnail?.$.url || null,
    author: item.creator || null,
  }));
  return { results, storageArticles };
}

export async function warmNews() {
  try {
    const { results, storageArticles } = await fetchNewsNow();
    cachedNews = results;
    cacheTimestamp = Date.now();
    await storage.createNewsArticles(storageArticles);
    // kick prewarm in background (first 10)
    setImmediate(async () => {
      try {
        const prewarm = storageArticles.slice(0, Math.min(10, storageArticles.length));
        await runLimited(prewarm, 3, async (a) => {
          if (!a.originalUrl) return;
          await extractHtmlFromArticlePageCached(a.originalUrl);
        });
        console.log(`[warmNews] prewarmed ${prewarm.length} articles`);
      } catch {}
    });
    console.log('[warmNews] cache filled at startup');
  } catch (e) {
    console.warn('[warmNews] initial fetch failed, will rely on on-demand fetching', e.message);
  }
}

export async function registerRoutes(app) {
  // Dedicated warm endpoint (useful for schedulers)
  app.get('/api/warm', async (_req, res) => {
    try {
      await warmNews();
      res.json({ ok: true, warmedAt: new Date().toISOString() });
    } catch (e) {
      res.status(500).json({ ok: false, message: e?.message || 'warm failed' });
    }
  });
  // Add debug endpoint to test server
  app.get("/api/debug", async (_req, res) => {
    res.json({ message: "Server is working", timestamp: new Date().toISOString() });
  });

  // On-chain claim trigger (Farcaster Mini App compatible)
  // This endpoint does NOT move funds itself by default. It forwards the claim
  // to an external payout service (configured via env) that holds the tokens
  // and executes the transfer on Arbitrum. This keeps private keys out of the app.
  //
  // Env (optional):
  // - PAYOUT_MODE=external
  // - PAYOUT_WEBHOOK_URL=https://your-wallet-service/api/payout
  // - PAYOUT_WEBHOOK_AUTH=Bearer <token>  (optional auth header)
  // - ARBITRUM_CHAIN_ID=42161 (mainnet) or 421614 (sepolia)
  // - CLAIM_DEFAULT_AMOUNT=0.5  (tokens per claim)
  const TOKEN_OPTIONS = [
    { symbol: 'ARB', decimals: 18 },
    { symbol: 'TOKEN2', decimals: 18 },
    { symbol: 'TOKEN3', decimals: 18 },
  ];

  app.post('/api/claim/onchain', express.json(), async (req, res) => {
    try {
      const { address, token } = req.body || {};
      if (!address || typeof address !== 'string' || !isAddress(address)) {
        return res.status(400).json({ message: 'Invalid recipient address' });
      }
      const selected = TOKEN_OPTIONS.find(t => t.symbol === token);
      if (!selected) {
        return res.status(400).json({ message: 'Invalid token selection' });
      }

      const chainId = parseInt(process.env.ARBITRUM_CHAIN_ID || '421614', 10); // default Arbitrum Sepolia
      const amountTokens = parseFloat(process.env.CLAIM_DEFAULT_AMOUNT || '0.5');
      if (isNaN(amountTokens) || amountTokens <= 0) {
        return res.status(500).json({ message: 'Server misconfigured: CLAIM_DEFAULT_AMOUNT' });
      }
      const payoutMode = (process.env.PAYOUT_MODE || 'external').toLowerCase();

      // External payout service
      if (payoutMode === 'external') {
        const url = process.env.PAYOUT_WEBHOOK_URL;
        if (!url) {
          return res.status(500).json({ message: 'PAYOUT_WEBHOOK_URL not configured' });
        }
        const auth = process.env.PAYOUT_WEBHOOK_AUTH || '';
        const payload = {
          chainId,
          to: address,
          token: selected.symbol,
          decimals: selected.decimals,
          amount: amountTokens,
          context: { source: 'crypto-news-app', reason: 'read-and-claim' },
        };
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(auth ? { 'Authorization': auth } : {}),
            },
            body: JSON.stringify(payload),
          });
          if (!r.ok) {
            const text = await r.text();
            return res.status(502).json({ message: 'Payout provider error', status: r.status, body: text });
          }
          const json = await r.json().catch(() => ({}));
          return res.json({ ok: true, provider: 'external', tx: json.txHash || null });
        } catch (err) {
          console.error('[claim/onchain] external payout failed', err);
          return res.status(502).json({ message: 'Payout request failed' });
        }
      }

      // Local signer mode could be implemented here if desired.
      return res.status(501).json({ message: 'Local signer payout not configured' });
    } catch (e) {
      console.error('[claim/onchain] error', e);
      return res.status(500).json({ message: 'Internal error' });
    }
  });

  // Scrape endpoint - extract article content from URL
  app.get("/api/scrape", async (req, res) => {
    try {
      const { url } = req.query;
      console.log('[SCRAPE] Request received:', req.query);
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing url parameter' });
      }

      const targetUrl = String(url);
      if (!targetUrl.includes('coindesk.com')) {
        return res.status(400).json({ error: 'Only CoinDesk articles are supported' });
      }

      // Try RSS feed first
      const parser = new Parser({ customFields: { item: ['content:encoded'] } });
      const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
      const normalizedTargetUrl = normalizeUrl(targetUrl);
      
      const rssItem = feed.items.find((item) => {
        const normalizedItemUrl = normalizeUrl(item.link || '');
        return normalizedItemUrl === normalizedTargetUrl || normalizedTargetUrl.startsWith(normalizedItemUrl);
      });

      if (rssItem && rssItem['content:encoded'] && rssItem['content:encoded'].length > 200) {
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=7200');
        return res.json({ 
          content: rssItem['content:encoded'], 
          contentLength: rssItem['content:encoded'].length, 
          strategy: 'rss' 
        });
      }

      // Fallback to direct scraping
      console.log(`RSS content not found for ${targetUrl}. Scraping directly.`);
      const page = await extractHtmlFromArticlePageCached(targetUrl);
      console.log(`Scrape success: ${page.meta.textLen} chars`);
      res.set('Cache-Control', 'public, max-age=3600, s-maxage=7200');
      return res.json({ 
        content: page.html, 
        contentLength: page.meta.textLen, 
        strategy: page.meta.strategy 
      });

    } catch (error) {
      console.error('Scrape error:', error.message);
      res.status(500).json({ error: 'Failed to fetch article content', message: error.message });
    }
  });

  // Get news articles (live from CoinDesk RSS)
  app.get("/api/news", async (req, res) => {
    try {
      console.log('[API /news] Fetching fresh news data...');
      const forceRefresh = String(req.query.refresh || '') === '1';
      const age = Date.now() - cacheTimestamp;

      // Serve from cache if fresh and not forced
      if (!forceRefresh && cachedNews && age < CACHE_DURATION) {
        // ETag support
        const etag = createHash('sha1').update(JSON.stringify(cachedNews)).digest('hex');
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
        res.set('ETag', etag);
        return res.json({ results: cachedNews });
      }

      // Stale-While-Revalidate: if we have cache but it's older than TTL and not forced,
      // serve it immediately and refresh in background
      if (!forceRefresh && cachedNews && age >= CACHE_DURATION) {
        res.json({ results: cachedNews });
        setImmediate(async () => {
          try {
            const { results, storageArticles } = await fetchNewsNow();
            cachedNews = results;
            cacheTimestamp = Date.now();
            await storage.createNewsArticles(storageArticles);
            console.log('[API /news][SWR] cache refreshed');
          } catch (err) {
            console.error('[API /news][SWR] refresh failed', err);
          }
        });
        return;
      }

      // No fresh cache: try fast fetch with 3s timeout; if it fails and we have cache, serve it.
      try {
        const { results, storageArticles } = await fetchNewsNow();
        console.log(`[API /news] Returning ${results.length} articles with IDs:`, results.map(r => r.id));
        cachedNews = results;
        cacheTimestamp = Date.now();
        await storage.createNewsArticles(storageArticles);
        res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
        const etag = createHash('sha1').update(JSON.stringify(results)).digest('hex');
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
        res.set('ETag', etag);
        res.json({ results });

        // Background prewarm
        setImmediate(async () => {
          try {
            const prewarm = storageArticles.slice(0, Math.min(10, storageArticles.length));
            await runLimited(prewarm, 3, async (a) => {
              if (!a.originalUrl) return;
              await extractHtmlFromArticlePageCached(a.originalUrl);
            });
            console.log(`[API /news][prewarm] warmed ${prewarm.length} articles`);
          } catch (e) {
            console.error('[API /news][prewarm] failed', e);
          }
        });
        return;
      } catch (ferr) {
        console.warn('[API /news] fast fetch failed:', ferr.message);
        if (cachedNews) {
          const etag = createHash('sha1').update(JSON.stringify(cachedNews)).digest('hex');
          if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
          }
          res.set('ETag', etag);
          return res.json({ results: cachedNews });
        }
        // Last resort: quick empty payload; client shows skeleton and retry button
        return res.json({ results: [] });
      }
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ 
        message: "Failed to fetch news articles",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get article content with full scraping
  app.get("/api/article/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`[API /article/:id] Fetching article with ID: ${id}`);

      // Serve from article cache if present and fresh
      const cached = articleCache.get(id);
      if (cached && Date.now() - cached.ts < ARTICLE_TTL_MS) {
        return res.json(cached.data);
      }

      // First try to use the in-memory storage for stable lookups based on the list the client saw
      const stored = await storage.getNewsArticle(id);

      let baseTitle = stored?.title || '';
      let baseDescription = stored?.description || '';
      let baseImage = stored?.image || null;
      let basePublishedAt = stored?.publishedAt ? new Date(stored.publishedAt).toISOString() : undefined;
      let targetUrl = stored?.originalUrl || stored?.url || stored?.original_url || '';

      // If not found in storage, repopulate storage from RSS (same logic as /api/news), then retry lookup
      if (!stored) {
        try {
          const parser = new Parser({
            customFields: {
              item: ['content:encoded', ['media:content', 'media'], ['media:thumbnail', 'thumbnail'], ['enclosure', 'enclosure']]
            }
          });
          const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
          const items = feed.items.slice(0, 10);

          const storageArticles = items.map((item, index) => ({
            id: (index + 1).toString(),
            title: item.title || '',
            description: item.contentSnippet || item.content || '',
            publishedAt: new Date(item.pubDate || new Date().toISOString()),
            kind: 'article',
            sourceTitle: 'CoinDesk',
            sourceDomain: 'coindesk.com',
            originalUrl: item.link || '',
            url: item.link || '',
            image: item.media?.$.url || item.enclosure?.url || item.thumbnail?.$.url || null,
            author: item.creator || null,
          }));
          await storage.createNewsArticles(storageArticles);

          const retry = await storage.getNewsArticle(id);
          if (retry) {
            baseTitle = retry.title || '';
            baseDescription = retry.description || '';
            baseImage = retry.image || null;
            basePublishedAt = retry.publishedAt ? new Date(retry.publishedAt).toISOString() : undefined;
            targetUrl = retry.originalUrl || retry.url || '';
          }

          // If still not found, fall back to using RSS index best-effort
          if (!retry) {
            const articleIndex = parseInt(id, 10) - 1;
            if (isNaN(articleIndex) || articleIndex < 0) {
              return res.status(400).json({ message: "Invalid article ID" });
            }
            const rssItem = items[articleIndex];
            if (!rssItem) {
              console.log(`Article not found at index after repopulate: ${articleIndex}`);
              // Return a minimal payload instead of 404 to avoid client fallback to HTML
              const minimal = {
                id,
                title: baseTitle || `Article ${id}`,
                description: baseDescription || '',
                content: baseDescription || '',
                published_at: basePublishedAt || new Date().toISOString(),
                kind: "news",
                source: { title: 'CoinDesk', domain: 'coindesk.com' },
                original_url: targetUrl || '',
                image: baseImage || null,
                contentStrategy: 'not-found-minimal'
              };
              return res.json(minimal);
            }
            baseTitle = rssItem.title || '';
            baseDescription = rssItem.contentSnippet || rssItem.content || '';
            baseImage = rssItem.media?.$.url || rssItem.enclosure?.url || rssItem.thumbnail?.$.url || null;
            basePublishedAt = rssItem.pubDate || new Date().toISOString();
            targetUrl = rssItem.link || targetUrl;
          }
        } catch (repopErr) {
          console.error('[API /article/:id] Repopulate storage failed', repopErr);
        }
      }

      console.log(`[API /article/:id] Target URL: ${targetUrl}`);

      // Get full article content by scraping (or use RSS content if available and long enough)
      let fullContent = '';
      let contentStrategy = 'scrape';

      try {
        // If we didn't get a target URL for some reason, attempt to recover via RSS by index again
        if (!targetUrl) {
          const articleIndex = parseInt(id, 10) - 1;
          const parser = new Parser({
            customFields: {
              item: ['content:encoded']
            }
          });
          const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
          const rssItem = feed.items[articleIndex];
          if (rssItem) {
            targetUrl = rssItem.link || '';
            fullContent = rssItem['content:encoded'] || '';
            if (fullContent && fullContent.length > 500) {
              contentStrategy = 'rss';
            }
          }
        }

        if (!fullContent || fullContent.length < 500) {
          // Strictly non-blocking policy: if we don't already have a cached extraction,
          // respond immediately with description and warm the cache in background.
          const cached = getCachedExtraction(targetUrl);
          if (cached?.html && cached?.meta) {
            fullContent = cached.html;
            contentStrategy = cached.meta.strategy;
          } else {
            fullContent = baseDescription || 'Loading full content…';
            contentStrategy = 'deferred-scrape';
            setImmediate(async () => {
              try {
                const sc = await extractHtmlFromArticlePageCached(targetUrl);
                const warmed = {
                  id: id,
                  title: baseTitle,
                  description: baseDescription,
                  content: sc.html,
                  published_at: basePublishedAt || new Date().toISOString(),
                  kind: "news",
                  source: { title: 'CoinDesk', domain: 'coindesk.com' },
                  original_url: targetUrl,
                  image: baseImage,
                  contentStrategy: sc.meta.strategy,
                };
                articleCache.set(id, { data: warmed, ts: Date.now() });
                console.log(`[API /article/:id][warm] cache updated for ${id}`);
              } catch {}
            });
          }
        }
      } catch (scrapeError) {
        console.error(`Failed to scrape article content:`, scrapeError.message);
        // Ensure we at least send back description if scraping fails
        if (!fullContent || fullContent.length < 50) {
          fullContent = baseDescription || '';
          contentStrategy = 'fallback-description';
        }
      }

      const article = {
        id: id,
        title: baseTitle,
        description: baseDescription,
        content: fullContent,
        published_at: basePublishedAt || new Date().toISOString(),
        kind: "news",
        source: {
          title: 'CoinDesk',
          domain: 'coindesk.com'
        },
        original_url: targetUrl,
        image: baseImage,
        contentStrategy // For debugging
      };

      console.log(`[API /article/:id] Successfully fetched article: ${article.title} (${contentStrategy})`);
      // Save to cache (avoid caching minimal fallback so we can improve later)
      if (contentStrategy !== 'timeout-fallback' && contentStrategy !== 'fallback-description') {
        articleCache.set(id, { data: article, ts: Date.now() });
      }
      res.set('Cache-Control', 'public, max-age=600'); // cache detail for 10 minutes client-side
      res.json(article);
    } catch (error) {
      console.error("Error fetching article content:", error);
      res.status(500).json({ message: "Failed to fetch article content", error: error.message });
    }
  });

  // Get user profile
  app.get("/api/user/profile", async (_req, res) => {
    try {
      // For demo, always return the default user
      const user = await storage.getUser("default-user");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if we need to reset daily claims (new day)
      const today = new Date();
      const lastClaimDate = user.lastClaimDate;
      
      if (lastClaimDate) {
        const lastClaimDay = new Date(lastClaimDate);
        lastClaimDay.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        if (today.getTime() > lastClaimDay.getTime()) {
          await storage.resetDailyClaims(user.id);
          const updatedUser = await storage.getUser(user.id);
          return res.json(updatedUser);
        }
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Get user claims
  app.get("/api/user/claims", async (_req, res) => {
    try {
      const userId = "default-user"; // For demo
      const claims = await storage.getUserClaims(userId);
      res.json(claims);
    } catch (error) {
      console.error("Error fetching user claims:", error);
      res.status(500).json({ message: "Failed to fetch user claims" });
    }
  });

  // Claim tokens
  app.post("/api/user/claim", async (req, res) => {
    try {
      const claimData = insertUserClaimSchema.parse(req.body);
      const userId = "default-user"; // For demo
      
      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check daily limit (max 3 claims per day)
      const today = new Date();
      const dailyClaims = await storage.getUserDailyClaims(userId, today);
      
      if (dailyClaims.length >= 3) {
        return res.status(400).json({ message: "Daily claim limit reached" });
      }

      // Check if already claimed for this article
      const existingClaim = await storage.getUserClaimForArticle(userId, claimData.articleId);
      if (existingClaim) {
        return res.status(400).json({ message: "Already claimed for this article" });
      }

      // Create the claim
      const claim = await storage.createUserClaim({
        ...claimData,
        userId,
      });

      // Update user token balance and daily claims count
      const newBalance = user.tokenBalance + claimData.tokensEarned;
      const newDailyClaims = user.dailyClaims + 1;
      
      await storage.updateUserTokens(userId, newBalance, newDailyClaims);

      res.json({ 
        claim,
        newBalance,
        dailyClaims: newDailyClaims,
        message: "Tokens claimed successfully"
      });
    } catch (error) {
      console.error("Error claiming tokens:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to claim tokens" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
