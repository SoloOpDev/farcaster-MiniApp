import express from 'express';
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { insertUserClaimSchema } from "../shared/schema.js";
import { z } from "zod";
import { fetchCoinDeskRSS } from "./rss.js";
import { extractHtmlFromArticlePageCached, normalizeUrl, clearCache } from "./lib/extractor.js";
import Parser from 'rss-parser';

export async function registerRoutes(app: Express): Promise<Server> {
  let cachedNews: any = null;
  let lastFetchTime = 0;
  const FETCH_INTERVAL = 10 * 60 * 1000; // 10 minutes
  
  async function getCachedRSS() {
    const now = Date.now();
    if (!cachedNews || now - lastFetchTime > FETCH_INTERVAL) {
      cachedNews = await fetchCoinDeskRSS();
      lastFetchTime = now;
    }
    return cachedNews;
  }
  
  const parser = new Parser({ customFields: { item: ['content:encoded'] } });
  let cachedRSSFeed: any = null;
  let lastRSSFetch = 0;
  const RSS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  
  async function getCachedRSSFeed() {
    const now = Date.now();
    if (!cachedRSSFeed || now - lastRSSFetch > RSS_CACHE_TTL) {
      cachedRSSFeed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
      lastRSSFetch = now;
    }
    return cachedRSSFeed;
  }

  // Clear all caches - useful for testing
  app.post("/api/clear-cache", (_req, res) => {
    cachedNews = null;
    lastFetchTime = 0;
    cachedRSSFeed = null;
    lastRSSFetch = 0;
    clearCache(); // Clear article content cache
    console.log('[CACHE] All caches cleared');
    res.json({ success: true, message: 'All caches cleared' });
  });

  app.get("/api/news", async (_req, res) => {
    try {
      const data = await getCachedRSS();
      res.set('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=3600');
      res.json(data);
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ 
        message: "Failed to fetch news articles",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Scrape endpoint - extract article content from URL
  console.log('[ROUTES] Registering /api/scrape endpoint');
  app.get("/api/scrape", async (req, res) => {
    try {
      console.log('[SCRAPE] Request received:', req.query);
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing url parameter' });
      }

      const targetUrl = String(url);
      if (!targetUrl.includes('coindesk.com')) {
        return res.status(400).json({ error: 'Only CoinDesk articles are supported' });
      }

      // Try RSS feed first
      const feed = await getCachedRSSFeed();
      const normalizedTargetUrl = normalizeUrl(targetUrl);
      
      const rssItem = feed.items.find((item: any) => {
        const normalizedItemUrl = normalizeUrl(item.link || '');
        return normalizedItemUrl === normalizedTargetUrl || normalizedTargetUrl.startsWith(normalizedItemUrl);
      });

      if (rssItem && rssItem['content:encoded'] && rssItem['content:encoded'].length > 200) {
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=7200');
        return res.json({ content: rssItem['content:encoded'], contentLength: rssItem['content:encoded'].length, strategy: 'rss' });
      }

      // Fallback to direct scraping
      console.log(`RSS content not found for ${targetUrl}. Scraping directly.`);
      const page = await extractHtmlFromArticlePageCached(targetUrl);
      console.log(`Scrape success: ${page.meta.textLen} chars`);
      res.set('Cache-Control', 'public, max-age=3600, s-maxage=7200');
      return res.json({ content: page.html, contentLength: page.meta.textLen, strategy: page.meta.strategy });

    } catch (error: any) {
      console.error('Scrape error:', error.message);
      res.status(500).json({ error: 'Failed to fetch article content', message: error.message });
    }
  });

  app.get("/api/article/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`[API /article/:id] Looking for article with ID: ${id}`);
      
      const articleIndex = parseInt(id, 10) - 1;
      if (isNaN(articleIndex) || articleIndex < 0) {
        return res.status(400).json({ message: "Invalid article ID" });
      }

      const rssData = await getCachedRSS();
      const article = rssData.results[articleIndex];
      
      if (!article) {
        console.log(`Article not found at index: ${articleIndex}`);
        return res.status(404).json({ message: "Article not found" });
      }
      
      console.log(`[API /article/:id] Found article: ${article.title}`);

      if (article.sourceDomain === 'coindesk.com' && article.originalUrl) {
        try {
          console.log(`[API /article/:id] Scraping full content from: ${article.originalUrl}`);
          
          const feed = await getCachedRSSFeed();
          const normalizedTargetUrl = normalizeUrl(article.originalUrl);
          const rssItem = feed.items.find((item: any) => {
            const normalizedItemUrl = normalizeUrl(item.link || '');
            return normalizedItemUrl === normalizedTargetUrl || normalizedTargetUrl.startsWith(normalizedItemUrl);
          });
          
          
          console.log(`[API /article/:id] RSS content not found, scraping page directly`);
          const page = await extractHtmlFromArticlePageCached(article.originalUrl);
          console.log(`[API /article/:id] Successfully scraped content (${page.meta.textLen} chars)`);
          res.set('Cache-Control', 'public, max-age=3600, s-maxage=7200');
          return res.json({
            ...article,
            content: page.html,
            contentStrategy: page.meta.strategy
          });
        } catch (scrapeError) {
          console.error("Error fetching full content:", scrapeError);
        }
      }

      res.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
      res.json({
        ...article,
        content: article.description || '',
        contentStrategy: 'rss-fallback'
      });
    } catch (error) {
      console.error("Error fetching article content:", error);
      res.status(500).json({ message: "Failed to fetch article content" });
    }
  });

  app.get("/api/user/profile", async (_req, res) => {
    try {
      const user = await storage.getUser("default-user");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

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

  app.get("/api/user/claims", async (req, res) => {
    try {
      // Get FID from query parameter or default for backward compatibility
      const fid = req.query.fid as string;
      const userId = fid ? `fid-${fid}` : "default-user";
      
      const claims = await storage.getUserClaims(userId);
      res.json(claims);
    } catch (error) {
      console.error("Error fetching user claims:", error);
      res.status(500).json({ message: "Failed to fetch user claims" });
    }
  });

  app.post("/api/user/claim", async (req, res) => {
    try {
      const claimData = insertUserClaimSchema.parse(req.body);
      const userId = "default-user";
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const today = new Date();
      const dailyClaims = await storage.getUserDailyClaims(userId, today);
      
      if (dailyClaims.length >= 3) {
        return res.status(400).json({ message: "Daily claim limit reached" });
      }

      const existingClaim = await storage.getUserClaimForArticle(userId, claimData.articleId);
      if (existingClaim) {
        return res.status(400).json({ message: "Already claimed for this article" });
      }

      const claim = await storage.createUserClaim({
        ...claimData,
        userId,
      });

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
