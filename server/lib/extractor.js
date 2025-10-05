// Shared article extraction utilities
// IMPORTANT: This module centralizes the scraping logic used by both
// server/scrape.js (/api/scrape) and server/routes.js (/api/article/:id)
// to avoid divergence. Do NOT change logic here without testing both endpoints.

import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import http from 'http';
import https from 'https';

// Simple in-memory cache for extracted HTML keyed by normalized URL
// TTL 10 minutes to ensure fresh content
const htmlCache = new Map(); // key -> { html, meta, ts }
const DEFAULT_HTML_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function getCachedExtraction(url) {
  try {
    const key = normalizeUrl(url);
    const entry = htmlCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > DEFAULT_HTML_TTL_MS) {
      htmlCache.delete(key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function setCachedExtraction(url, payload) {
  try {
    const key = normalizeUrl(url);
    htmlCache.set(key, { ...payload, ts: Date.now() });
  } catch {}
}

export function clearCache() {
  htmlCache.clear();
}

async function fetchWithRetries(url, options = {}, retries = 2) {
  let lastErr;
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  ];
  // Reuse TCP connections to reduce latency
  const isHttps = (() => { try { return new URL(url).protocol === 'https:'; } catch { return true; } })();
  const agent = isHttps
    ? new https.Agent({ keepAlive: true, maxSockets: 10 })
    : new http.Agent({ keepAlive: true, maxSockets: 10 });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ua = uas[Math.min(attempt, uas.length - 1)];
      const res = await fetch(url, {
        ...options,
        // pass keep-alive agent
        agent,
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.google.com/',
          ...(options.headers || {}),
        },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      // small backoff
      await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Normalizes a URL by removing query parameters, hash, and trailing slashes
 * for more reliable comparison.
 */
export function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/$/, ''); // remove trailing slash
    return url.toString();
  } catch {
    return u; // Return original if invalid
  }
}

/**
 * Attempt to locate the most likely main content node by scoring
 * candidates that contain multiple paragraphs and longer text.
 */
export function pickBestContentNode(doc) {
  // Remove obvious non-content nodes early
  doc.querySelectorAll('script, style, noscript, iframe, form, footer, header, nav').forEach(el => el.remove());

  // Heuristic scoring: prefer nodes with many <p> and long text
  const candidates = Array.from(doc.querySelectorAll('main, article, section, div'));
  let best = null;
  let bestScore = 0;

  for (const el of candidates) {
    const text = el.textContent || '';
    const pCount = el.querySelectorAll('p').length;
    const liCount = el.querySelectorAll('li').length;
    const len = text.replace(/\s+/g, ' ').trim().length;

    // Penalize if it looks like a nav/sidebar/related section by class/id
    const label = (el.className + ' ' + (el.id || '')).toLowerCase();
    const isJunk = /(nav|footer|header|sidebar|menu|subscribe|newsletter|related|promo|advert|social)/.test(label);
    if (isJunk) continue;

    // Score: paragraphs are valuable, list items add a bit, and raw length matters
    const score = pCount * 50 + liCount * 10 + Math.min(len, 20000) / 20;
    if (score > bestScore && len > 500) {
      best = el;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Fetches the article's HTML directly and extracts the main content body.
 * This is the robust implementation used across endpoints.
 */
export async function extractHtmlFromArticlePage(targetUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000); // 10-second timeout

  const res = await fetchWithRetries(targetUrl, { signal: controller.signal }, 2);

  clearTimeout(timer);

  const html = await res.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Preferred selectors for CoinDesk
  const selectors = [
    '[data-component="ArticleBody"]',
    'article [data-component="ArticleBody"]',
    '[data-module="article-body"], [data-module="article-body-block"]',
    '.article-body, .article__body, .article-content, .content-area',
    'article',
    'main article',
  ];

  let articleNode;
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element && (element.textContent || '').trim().length > 200) {
      articleNode = element;
      break;
    }
  }

  // If predefined selectors fail, fall back to heuristic picker
  let strategy = 'selectors';
  if (!articleNode) {
    articleNode = pickBestContentNode(doc);
    strategy = 'heuristic-picker';
  }

  const ensureClean = (node) => {
    if (!node) return '';
    
    // AGGRESSIVE CLEANUP: Remove all non-content elements first
    node.querySelectorAll('script, style, noscript, iframe, figure, aside, svg, video, button, nav, footer, header, form, select, input, textarea').forEach(el => el.remove());
    
    // Remove elements with navigation/menu/sidebar classes
    Array.from(node.querySelectorAll('[class], [id]')).forEach(el => {
      const label = (el.className + ' ' + (el.id || '')).toLowerCase();
      if (/(share|social|subscribe|newsletter|related|promo|advert|cookie|consent|latest|sidebar|recommended|navigation|menu|footer|header|disclosure|policy|policies|language|signin|about|contact|careers|masthead|sitemap|investor|bug-bounty|terms|privacy|ethics)/.test(label)) {
        el.remove();
      }
    });
    
    // Kill phrases that indicate this is definitely not article content
    const killPhrases = [
      'Back to menu', 'Select Language', 'Sign In', 'About Us',
      'Masthead', 'Careers', 'Blog', 'Investor Relations',
      'Contact Us', 'Accessiblility', 'Advertise', 'Sitemap',
      'System status', 'Bug Bounty Program', 'Do Not Sell My Info',
      'Terms of Use', 'Privacy', 'Ethics', '© 2025 CoinDesk',
      'Disclosure & Polices', 'CoinDesk is an award-winning',
      'CoinDesk is part of Bullish',
      'Latest Crypto News', 'Top Stories', 'Related Stories',
      'More From CoinDesk', 'Recommended Articles', 'More For You',
      'Read full story', 'What to know:', 'STORY CONTINUES BELOW',
      'Don\'t miss another story', 'Subscribe to the Crypto Daybook',
      'By signing up, you will receive emails', 'See all newsletters',
      'Read more:', 'Crypto Exchange', 'Exclusive', 'minutes ago',
      'hours ago', 'days ago', 'Earn Rewards', 'Learn & Earn',
      'Connecting Farcaster', 'Articles Claimed Today', 'Lucky Reward',
      'Read selected articles to claim', 'Back CoinDesk', 'about 1 hour ago',
      'Edited by', 'View Full Report', 'State of Crypto'
    ];
    
    // NUCLEAR OPTION: Remove any element that contains kill phrases
    // Work backwards to avoid issues with removing parent nodes
    const allElements = Array.from(node.querySelectorAll('*')).reverse();
    for (const el of allElements) {
      const text = el.textContent || '';
      
      // If this element contains kill phrases, nuke it
      for (const phrase of killPhrases) {
        if (text.includes(phrase)) {
          el.remove();
          break;
        }
      }
    }
    
    // Remove any remaining lists that look like navigation
    Array.from(node.querySelectorAll('ul, ol')).forEach(el => {
      const links = el.querySelectorAll('a');
      const text = (el.textContent || '').trim();
      
      // If it's mostly links, it's navigation
      if (links.length > 3 && text.length < 300) {
        el.remove();
      }
      
      // If it contains menu-like text patterns
      if (/(News|Markets|Finance|Tech|Policy|Videos|Podcasts|Prices|Data|Events|Sponsored|Research)/i.test(text) && text.length < 500) {
        el.remove();
      }
    });
    
    // Remove divs that are just containers of links
    Array.from(node.querySelectorAll('div')).forEach(el => {
      const links = el.querySelectorAll('a');
      const text = (el.textContent || '').trim();
      
      if (links.length > 5 && text.length < 400) {
        el.remove();
      }
    });
    
    // NUCLEAR CLEANUP: Aggressively cut off everything after main article content
    let html = node.innerHTML;
    
    // PASS 1: Cut at ANY timestamp pattern first (these ALWAYS indicate article lists)
    const timestampPatterns = [
      /\d+\s+(minute|minutes|hour|hours|day|days)\s+ago/i,
      /(Oct|Sep|Aug|Jul|Jun|May|Apr|Mar|Feb|Jan)\s+\d+,\s+20\d{2}/i
    ];
    
    let timestampIndex = -1;
    for (const pattern of timestampPatterns) {
      const match = html.match(pattern);
      if (match && match.index !== undefined) {
        if (timestampIndex === -1 || match.index < timestampIndex) {
          timestampIndex = match.index;
        }
      }
    }
    
    if (timestampIndex !== -1 && timestampIndex > 500) {
      // Only cut if timestamp is far enough (not in article metadata)
      html = html.substring(0, timestampIndex);
    }
    
    // PASS 2: Cut at common article ending phrases
    const hardCutoffPhrases = [
      'More For You', 'Read more:', 'Related Stories', 'What to know:', 
      'STORY CONTINUES BELOW', 'Don\'t miss another story', 'Subscribe to',
      'By signing up, you will receive', 'See all newsletters',
      'Crypto Exchange', 'Exclusive', 'Read full story', 'Latest Crypto News',
      'Top Stories', 'Recommended', 'More from', 'Also read',
      'View Full Report', 'By CoinDesk', 'Total Crypto Trading Volume',
      'State of Crypto:', 'Edited by', 'Earn Rewards', 'Learn & Earn',
      'Articles Claimed Today', 'Lucky Reward', 'Connecting Farcaster'
    ];
    
    let earliestIndex = -1;
    for (const phrase of hardCutoffPhrases) {
      const index = html.toLowerCase().indexOf(phrase.toLowerCase());
      if (index !== -1 && (earliestIndex === -1 || index < earliestIndex)) {
        earliestIndex = index;
      }
    }
    
    if (earliestIndex !== -1) {
      html = html.substring(0, earliestIndex);
    }
    
    // PASS 2.5: Detect when a SECOND article starts (author byline pattern)
    // Pattern: "By [Author]" followed by date like "Sep 9, 2025"
    const secondArticlePattern = /By\s+[A-Z][a-zA-Z\s,]+\|?\s*(Edited by)?.*?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+20\d{2}/i;
    const match = html.match(secondArticlePattern);
    if (match && match.index && match.index > 1000) {
      // Only cut if this pattern appears well into the content (not the main article's byline)
      html = html.substring(0, match.index);
    }
    
    // PASS 2.6: Detect article lists by looking for multiple timestamps in close proximity
    // Pattern: Multiple "X hour(s) ago" or "X minute(s) ago" within 500 chars = article list
    const timestampRegex = /\d+\s+(hour|hours|minute|minutes)\s+ago/gi;
    const timestamps = [...html.matchAll(timestampRegex)];
    if (timestamps.length >= 3) {
      // Find the first timestamp that appears after substantial content
      // Require at least 3 timestamps to avoid false positives
      for (const ts of timestamps) {
        if (ts.index && ts.index > 1500) {
          html = html.substring(0, ts.index);
          break;
        }
      }
    }
    
    // PASS 3: NUCLEAR - Remove ANYTHING that looks like article lists
    // DISABLED: Too aggressive, removing valid content
    // Only run this if we detect we're in the "related articles" section
    const hasMultipleTimestamps = (html.match(/\d+\s+(hour|hours|minute|minutes)\s+ago/gi) || []).length >= 2;
    
    if (hasMultipleTimestamps) {
      const tempDiv = new JSDOM(`<div>${html}</div>`).window.document.querySelector('div');
      if (tempDiv) {
        // Work backwards to remove parent containers
        const allElements = Array.from(tempDiv.querySelectorAll('*')).reverse();
        
        for (const el of allElements) {
          try {
            const text = el.textContent || '';
            const links = el.querySelectorAll('a');
            
            // KILL PATTERN 1: Multiple links + timestamp = article list
            if (links.length >= 2 && /(hour|minute|day)s?\s+ago/i.test(text)) {
              el.remove();
              continue;
            }
            
            // KILL PATTERN 2: Timestamp text (standalone)
            if (/(hour|minute|day)s?\s+ago/i.test(text) && text.length < 100) {
              el.remove();
              continue;
            }
          } catch {}
        }
        
        html = tempDiv.innerHTML;
      }
    }
    
    // PASS 4: Remove duplicate consecutive headings (same text appearing twice)
    const finalDiv = new JSDOM(`<div>${html}</div>`).window.document.querySelector('div');
    if (finalDiv) {
      const headings = finalDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const seenTexts = new Set();
      
      headings.forEach(h => {
        const text = h.textContent.trim();
        if (text && seenTexts.has(text.toLowerCase())) {
          // Duplicate heading, remove it
          h.remove();
        } else if (text) {
          seenTexts.add(text.toLowerCase());
        }
      });
      
      html = finalDiv.innerHTML;
    }
    
    return html;
  };

  let cleanedHtml = ensureClean(articleNode);
  let textLen = (articleNode?.textContent || '').trim().length;
  
  // Check for paywall indicators
  const rawText = (articleNode?.textContent || '').toLowerCase();
  const paywallIndicators = [
    'create a free account to continue reading',
    'you\'ve reached your monthly limit',
    'sign up for free',
    'subscribe to continue reading',
    'this article is for subscribers only',
    'become a member to read',
    'premium content'
  ];
  
  const isPaywalled = paywallIndicators.some(indicator => rawText.includes(indicator));
  
  if (isPaywalled) {
    console.log('[EXTRACTOR] Detected paywall, throwing error');
    throw new Error('Article is behind a paywall');
  }
  
  console.log('[EXTRACTOR] Initial extraction:', { textLen, hasHtml: !!cleanedHtml, strategy });

  if (!cleanedHtml || textLen < 500) {
    // Fallback 1.5: Aggregate paragraphs when page uses split paragraph blocks
    if (doc) {
      const paraNodes = Array.from(
        doc.querySelectorAll('[data-component="Paragraph"], article p, main p, .article-body p, .article__body p, .article-content p')
      ).filter(n => (n.textContent || '').trim().length > 40);
      if (paraNodes.length >= 4) {
        const htmlJoined = paraNodes.map(n => `<p>${n.textContent.trim()}</p>`).join('\n');
        const joinedLen = paraNodes.reduce((acc, n) => acc + (n.textContent || '').trim().length, 0);
        if (joinedLen > textLen) {
          cleanedHtml = htmlJoined;
          textLen = joinedLen;
          strategy = 'paragraph-aggregate';
        }
      }
    }

    // Attempt AMP version
    let ampUrl = targetUrl;
    if (!/\/amp\/?$/.test(ampUrl)) {
      try {
        const u = new URL(targetUrl);
        if (!u.pathname.endsWith('/')) u.pathname += '/';
        u.pathname += 'amp/';
        ampUrl = u.toString();
      } catch {}
    }

    try {
      const ampRes = await fetchWithRetries(ampUrl, {}, 1);
      if (ampRes.ok) {
        const ampHtml = await ampRes.text();
        const ampDom = new JSDOM(ampHtml);
        const ampDoc = ampDom.window.document;
        const ampNode = ampDoc.querySelector('article') || ampDoc.querySelector('main') || pickBestContentNode(ampDoc);
        const ampClean = ensureClean(ampNode);
        const ampLen = (ampNode?.textContent || '').trim().length;
        if (ampClean && ampLen > textLen) {
          cleanedHtml = ampClean;
          textLen = ampLen;
          strategy = 'amp-fallback';
        }
      }
    } catch {}
  }

  if (!cleanedHtml || textLen < 150) {
    console.error('[EXTRACTOR] Failed to extract content:', { textLen, hasHtml: !!cleanedHtml });
    throw new Error('Article content too short or unavailable');
  }
  
  console.log('[EXTRACTOR] Success:', { textLen, strategy });

  return { html: cleanedHtml, meta: { strategy, textLen, url: targetUrl } };
}

// Cached helper: check cache first, otherwise extract and cache
export async function extractHtmlFromArticlePageCached(targetUrl) {
  const cached = getCachedExtraction(targetUrl);
  if (cached?.html && cached?.meta) {
    return { html: cached.html, meta: cached.meta };
  }
  const out = await extractHtmlFromArticlePage(targetUrl);
  setCachedExtraction(targetUrl, out);
  return out;
}
