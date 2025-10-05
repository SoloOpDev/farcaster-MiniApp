import express from 'express';
import { createServer } from 'http';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
import { JSDOM } from 'jsdom';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// RSS parser
const parser = new Parser({ customFields: { item: ['content:encoded'] } });
let cachedRSSFeed = null;
let lastRSSFetch = 0;
const RSS_CACHE_TTL = 10 * 60 * 1000;

async function getCachedRSSFeed() {
  const now = Date.now();
  if (!cachedRSSFeed || now - lastRSSFetch > RSS_CACHE_TTL) {
    cachedRSSFeed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
    lastRSSFetch = now;
  }
  return cachedRSSFeed;
}

function normalizeUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
}

// Simple test endpoint
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Scrape endpoint
app.get('/api/scrape', async (req, res) => {
  try {
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

    // Fallback: fetch and parse the page
    console.log(`RSS content not found for ${targetUrl}. Scraping directly.`);
    const response = await fetch(targetUrl);
    const html = await response.text();
    
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    // Extract article content
    const articleBody = doc.querySelector('article') || doc.querySelector('.article-body') || doc.querySelector('main');
    
    if (!articleBody) {
      return res.status(500).json({ error: 'Could not find article content' });
    }

    // Clean up scripts and styles
    articleBody.querySelectorAll('script, style, iframe, nav, aside, .ad, .advertisement').forEach(el => el.remove());
    
    const content = articleBody.innerHTML;
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=7200');
    return res.json({ 
      content, 
      contentLength: content.length, 
      strategy: 'html-scrape' 
    });

  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({ error: 'Failed to fetch article content', message: error.message });
  }
});

// For Vercel serverless
export default app;
