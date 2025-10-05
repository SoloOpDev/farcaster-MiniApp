# Content Fetching Fix - 2025-10-05T13:19

## Problem
App was opening but article content inside news cards was not loading - only showing headings.

## Root Causes Identified

1. **Scrape API called with relative URL** - Not using `getApiUrl()` helper
2. **Missing debug logging** - Hard to diagnose where fetching was failing
3. **No error handling visibility** - Errors were swallowed silently

## Fixes Applied

### 1. Updated Article Scraping Logic (`article.tsx`)
- ✅ Now uses `getApiUrl()` for scrape requests
- ✅ Added comprehensive logging for scrape flow:
  - Request URL logging
  - Response status logging
  - Content length logging
  - Error logging (excluding AbortError)
- ✅ Logs warning if no `original_url` found

### 2. Enhanced Content Rendering Debug
- ✅ Added logging before render to show:
  - Paywall status
  - fullContent availability & length
  - articleDetail availability & length
  - Description availability
- ✅ Each render path now logs which content source is used

### 3. Improved ArticleDetail Query
- ✅ Added enabled state logging
- ✅ Added request/response logging
- ✅ Added error logging via useEffect
- ✅ Exposes loading and error states

## Testing Steps

### 1. Open Browser Console
Navigate to `http://localhost:3001` and open the browser console (F12).

### 2. Click on Any Article
You should see console logs like:

```
🔍 Article data: { title: "...", original_url: "...", hasDescription: true, ... }
📋 ArticleDetail query state: { enabled: true, hasParamsId: true, ... }
🌐 Fetching scrape for: https://www.coindesk.com/...
🌐 Scrape URL: /api/scrape?url=...
📡 Scrape response status: 200
📦 Scrape data: { hasContent: true, contentLength: 2341, strategy: "rss" }
✅ Setting scraped content, length: 2341
🎨 Rendering content: { hasFullContent: true, fullContentLength: 2341, ... }
✅ Rendering fullContent
```

### 3. Verify Content Displays
- Article should show full content, not just description
- If scraping fails, should fall back to articleDetail
- If both fail, should show description with loading spinner

## Expected Behavior

### Success Path (Normal)
1. User clicks article
2. Page loads with title and description
3. `/api/scrape` fetches full content in background
4. Content updates to show full article (HTML rendered)

### Fallback Path 1 (Scrape fails)
1. User clicks article
2. `/api/article/:id` endpoint fetches content
3. articleDetail content displayed

### Fallback Path 2 (Both fail)
1. Shows description with "Loading full article..." spinner
2. After 1.5s timeout, gives up and keeps showing description

## API Endpoints Verified

✅ `/api/news` - Returns 10 articles with descriptions
✅ `/api/scrape?url=...` - Returns HTML content (2341+ bytes)
✅ `/api/article/:id` - Returns article with scraped content

## Console Logs to Watch For

### Good Signs ✅
- `✅ Setting scraped content`
- `✅ Rendering fullContent`
- `📡 Scrape response status: 200`

### Warning Signs ⚠️
- `⚠️ Scrape returned no content`
- `⚠️ No original_url found for article`
- `⏳ Showing description with loading spinner` (if stuck here for >2 seconds)

### Error Signs ❌
- `❌ Scrape failed:` - Network or server error
- `❌ ArticleDetail error:` - Fallback also failed

## If Still Not Working

Check browser console for specific error messages and share:
1. The full console output when clicking an article
2. Any red error messages
3. Network tab showing failed requests (if any)
