# 🔴 Upstash Redis Setup Guide

## ✅ What I Updated

**File:** `server/routes-farcaster.ts`

**Changes:**
- ✅ Added Upstash Redis integration
- ✅ Automatic fallback to in-memory if Redis unavailable
- ✅ All 4 API endpoints use Redis:
  - POST /api/record-article
  - POST /api/check-eligibility
  - POST /api/record-claim
  - GET /api/user-stats/:fid

**How it works:**
```typescript
const db = await getRedis();

if (db) {
  // ✅ Use Redis (production)
  await db.set('user:12345:articles:2025-10-02', ['1', '2', '3'])
} else {
  // ⚠️ Use in-memory (development)
  memoryArticles.set('12345:2025-10-02', Set(['1', '2', '3']))
}
```

---

## 📦 Installation Steps

### Step 1: Install Upstash Redis Package

```bash
npm install @upstash/redis
```

### Step 2: Create Redis Database in Vercel

1. Go to Vercel dashboard
2. Select your project
3. Click **"Storage"** tab
4. Click **"Create Database"**
5. Select **"KV"** (Upstash Redis)
6. Name it: `crypto-news-redis`
7. Click **"Create"**

### Step 3: Copy Environment Variables

Vercel will show you these variables:
```bash
KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=AY...
KV_REST_API_READ_ONLY_TOKEN=Ak...
```

**For Local Development:**
1. Copy these to your `.env` file
2. Restart server: `npm run dev`
3. Check console: Should show "✅ Connected to Upstash Redis"

**For Production:**
- Vercel automatically injects these variables
- No manual setup needed!

---

## 🗄️ Redis Data Structure

### Keys Used:

```
user:{fid}:articles:{date}
  → Array of article IDs read today
  → Example: ["1", "2", "3"]
  → Expires: 24 hours

user:{fid}:claims
  → Claim data object
  → Example: { lastClaimDate: "2025-10-02", claimedToday: true, tokens: ["CATCH"], txHash: "0x..." }
  → Expires: 48 hours

user:{fid}:lastArticleTime
  → Timestamp of last article read
  → Example: 1727890234567
  → Used for 10-second timer
```

---

## 🔧 How Fallback Works

### Development (No Redis)
```
Server starts
  ↓
getRedis() tries to connect
  ↓
Redis not available
  ↓
Console: "⚠️ Redis not available, using in-memory storage"
  ↓
Uses Map() for storage (resets on restart)
```

### Production (With Redis)
```
Server starts
  ↓
getRedis() connects to Upstash
  ↓
Console: "✅ Connected to Upstash Redis"
  ↓
Uses Redis for storage (persistent)
```

---

## 🎯 Benefits of Redis

### Before (In-Memory):
- ❌ Data lost on server restart
- ❌ Each Vercel instance has separate data
- ❌ Users might see inconsistent state

### After (Redis):
- ✅ Data persists across restarts
- ✅ All Vercel instances share same data
- ✅ Consistent user experience
- ✅ Automatic expiration (no cleanup needed)

---

## 🧪 Testing

### Test Locally (Without Redis):
```bash
npm run dev
# Console should show: "⚠️ Redis not available, using in-memory storage"
# App works normally with in-memory fallback
```

### Test Locally (With Redis):
```bash
# Add Redis env vars to .env
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...

npm run dev
# Console should show: "✅ Connected to Upstash Redis"
```

### Test in Production:
```bash
vercel --prod
# Redis automatically connected via Vercel environment
# Check logs: vercel logs
```

---

## 📋 Deployment Checklist Update

### Before Deploying:

1. **Install Upstash Redis:**
   ```bash
   npm install @upstash/redis
   ```

2. **Create Redis Database in Vercel:**
   - Storage → Create Database → KV
   - Copy environment variables

3. **Test Locally:**
   - Add Redis vars to `.env`
   - Run `npm run dev`
   - Check console for "✅ Connected to Upstash Redis"

4. **Deploy:**
   ```bash
   vercel --prod
   ```

5. **Verify:**
   - Check Vercel logs: `vercel logs`
   - Should see "✅ Connected to Upstash Redis"

---

## 🚀 Ready to Deploy!

**With Redis:**
- ✅ Persistent storage
- ✅ Multi-instance support
- ✅ Automatic expiration
- ✅ Production-ready

**Without Redis:**
- ⚠️ In-memory fallback works
- ⚠️ Data resets on restart
- ⚠️ Only for development

**Next step:** `npm install @upstash/redis` and you're done! 🎉
