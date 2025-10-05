import express from 'express';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
import { JSDOM } from 'jsdom';
// IMPORTANT: Use the shared extractor so logic stays in sync with /api/article/:id
import { normalizeUrl, extractHtmlFromArticlePageCached } from './lib/extractor.js';

const router = express.Router();

// Initialize a single, reusable RSS parser instance
const parser = new Parser({
  customFields: {
    item: ['content:encoded']
  }
});

// Cache RSS feed to avoid re-fetching on every scrape
let cachedRSSFeed = null;
let lastRSSFetch = 0;
const RSS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getCachedRSSFeed() {
  const now = Date.now();
  if (!cachedRSSFeed || now - lastRSSFetch > RSS_CACHE_TTL) {
    cachedRSSFeed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
    lastRSSFetch = now;
  }
  return cachedRSSFeed;
}

// Main scraping route
router.get('/api/scrape', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const targetUrl = String(url);
    if (!targetUrl.includes('coindesk.com')) {
      return res.status(400).json({ error: 'Only CoinDesk articles are supported' });
    }

    // --- Strategy 1: Try to get full content from the CACHED RSS feed first ---
    const feed = await getCachedRSSFeed();
    const normalizedTargetUrl = normalizeUrl(targetUrl);
    
    // Find a match with more flexible logic to increase hit rate
    const rssItem = feed.items.find(item => {
      const normalizedItemUrl = normalizeUrl(item.link || '');
      // Check for exact match OR if one URL is a substring of the other
      return normalizedItemUrl === normalizedTargetUrl || normalizedTargetUrl.startsWith(normalizedItemUrl);
    });

    if (rssItem && rssItem['content:encoded'] && rssItem['content:encoded'].length > 200) {
      // Add cache headers (1 hour for scraped content)
      res.set('Cache-Control', 'public, max-age=3600, s-maxage=7200');
      return res.json({ content: rssItem['content:encoded'], contentLength: rssItem['content:encoded'].length, strategy: 'rss' });
    }

    // --- Strategy 2: If RSS fails, fetch and parse the page directly ---
    console.log(`RSS content not found for ${targetUrl}. Falling back to direct page scrape.`);
    const page = await extractHtmlFromArticlePageCached(targetUrl);
    console.log('SCRAPE_SUCCESS', { strategy: page.meta.strategy, length: page.meta.textLen, url: targetUrl });
    // Add cache headers (1 hour for scraped content)
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=7200');
    return res.json({ content: page.html, contentLength: page.meta.textLen, strategy: page.meta.strategy });

  } catch (error) {
    console.error('SCRAPE_ERROR', { url: url, message: error.message });
    res.status(500).json({ error: 'Failed to fetch or process article content', message: error.message });
  }
});

export default router;
