# App Fetching Logic Fix - 2025-10-05

## Issues Identified

### 1. ✅ Double QueryClientProvider (CRITICAL)
**Problem**: Two separate `QueryClient` instances causing conflicts
- `main.tsx` created a new QueryClient
- `App.tsx` imported a different queryClient
- Both were wrapping the app

**Fix**: Removed duplicate from `main.tsx`, kept single instance in `App.tsx`

### 2. ✅ Missing Vite Proxy Configuration (CRITICAL)
**Problem**: No proxy to forward API requests to Express server
- Frontend on Vite dev server couldn't reach backend
- API calls were failing silently

**Fix**: Added proxy in `vite.config.ts`:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

### 3. ✅ Conflicting QueryFn Logic
**Problem**: Default queryFn tried to construct URLs differently than manual fetch calls
- queryClient had a default queryFn that joined queryKey segments
- But queries were using manual `fetch(getApiUrl(...))` calls

**Fix**: Removed default queryFn from QueryClient config

### 4. ✅ API URL Configuration
**Problem**: Always pointed to Railway even in development
**Fix**: Use relative URLs in dev mode:
```typescript
export const API_URL = import.meta.env.MODE === 'development' 
  ? '' 
  : (import.meta.env.VITE_API_URL || 'https://farcaster-miniapp-production.up.railway.app');
```

### 5. ✅ TypeScript Type Errors
**Problem**: Storage.ts had type mismatches for optional fields
**Fix**: Explicitly convert undefined to null for NewsArticle fields

## Verification

### Backend Server (Port 3001)
- ✅ Server running: `http://localhost:3001/api/ping` → `{"ok":true,"env":"development"}`
- ✅ News API: `http://localhost:3001/api/news` → Returns 6915 bytes of news data

### Frontend
- ✅ Added console logging to track initialization
- ✅ Added error logging for API calls
- ✅ Vite serves frontend through Express server

## How to Test

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Open in browser**: 
   ```
   http://localhost:3001
   ```

3. **Check browser console** for:
   - `🚀 App initializing...`
   - `✅ Root element found, rendering app...`
   - `🔄 Fetching news from: /api/news`
   - `✅ News data received: X articles`

4. **Expected behavior**:
   - App loads without errors
   - News articles display on home page
   - Can click articles to view details
   - Scraping works for full article content

## Next Steps if Issues Persist

1. Check browser console for errors
2. Check Network tab to see if API calls are made
3. Verify no CORS errors
4. Check if Farcaster SDK initialization is blocking
