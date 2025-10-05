# Farcaster Mini App Integration - Implementation Guide

## ✅ What's Already Done

### 1. Files Created
- ✅ `client/src/lib/farcaster.tsx` - Farcaster provider with FID authentication
- ✅ `client/src/main.tsx` - Updated with Farcaster provider wrapper
- ✅ `server/routes-farcaster.ts` - API routes for eligibility, article tracking, claims
- ✅ `server/index.ts` - Registered Farcaster routes
- ✅ `contracts/NewsRewardContractV2.sol` - New contract with FID tracking
- ✅ `client/src/lib/abi-v2.ts` - ABI for new contract
- ✅ `client/src/pages/article-farcaster.tsx` - Updated article page with FID integration

### 2. Key Features Implemented
- ✅ Farcaster FID authentication (mock for dev, real in production)
- ✅ Article read tracking per FID
- ✅ Eligibility checking (3 articles + 10 second timer)
- ✅ Daily claim limits tracked by FID
- ✅ Smart contract with FID-based claims
- ✅ Random token selection (CATCH/BOOP/ARB)

## 🔧 What You Need To Do Next

### Step 1: Install Farcaster Frame SDK (Optional for Production)
```bash
npm install @farcaster/frame-sdk
```

Then update `client/src/lib/farcaster.tsx` to use real SDK instead of mock FID.

### Step 2: Deploy New Smart Contract

1. Open Remix IDE
2. Copy `contracts/NewsRewardContractV2.sol`
3. Deploy with constructor args:
   - `_catch`: Your CATCH token mainnet address
   - `_boop`: Your BOOP token mainnet address
   - `_arb`: Your ARB token mainnet address
4. Copy deployed contract address

### Step 3: Fund the Contract

After deployment, send tokens to the contract:
```solidity
// Transfer tokens directly to contract address
CATCH.transfer(contractAddress, 1000000 * 10**18);
BOOP.transfer(contractAddress, 1000000 * 10**18);
ARB.transfer(contractAddress, 1000 * 10**18);
```

### Step 4: Update Environment Variables

Create `.env` file:
```bash
# Contract address from Step 2
VITE_CONTRACT_ADDRESS=0x...

# Mainnet token addresses (you'll provide these)
VITE_CATCH_TOKEN=0x...
VITE_BOOP_TOKEN=0x...
VITE_ARB_TOKEN=0x...

# Chain (use Arbitrum mainnet)
VITE_CHAIN_ID=42161
VITE_RPC_URL=https://arb1.arbitrum.io/rpc
```

### Step 5: Update Wagmi Config for Arbitrum

Edit `client/src/lib/wagmi.ts`:
```typescript
import { arbitrum } from 'wagmi/chains'

const REQUIRED_CHAIN_ID = 42161 // Arbitrum mainnet
const chains = [arbitrum] as const

export const wagmiConfig = createConfig({
  chains,
  connectors: [/* same as before */],
  transports: {
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
  },
})
```

### Step 6: Replace Old Article Page

Rename files:
```bash
# Backup old version
mv client/src/pages/article.tsx client/src/pages/article-old.tsx

# Use new Farcaster version
mv client/src/pages/article-farcaster.tsx client/src/pages/article.tsx
```

Update imports in `article.tsx`:
```typescript
import { NEWS_REWARD_ABI_V2 } from "@/lib/abi-v2";
// Change all NEWS_REWARD_ABI to NEWS_REWARD_ABI_V2
```

### Step 7: Remove Old Testnet Stuff

Delete these files:
- `contracts/TestARB.sol`
- `contracts/TestCATCH.sol`
- `contracts/TestBOOP.sol`
- `contracts/NewsRewardContract.sol` (old version)

Remove from `client/src/components/layout.tsx`:
- All "Connect Wallet" button code
- All "Switch to Sepolia" code
- Keep only FID display

### Step 8: Update Token Info with Real Addresses

In `article.tsx`, update:
```typescript
const TOKEN_INFO: Record<number, { symbol: string; amountPerClaim: string }> = {
  0: { symbol: 'CATCH', amountPerClaim: '5' },
  1: { symbol: 'BOOP', amountPerClaim: '4000' },
  2: { symbol: 'ARB', amountPerClaim: '0.001' },
};
```

### Step 9: Test Locally

1. Start server: `npm run dev`
2. Open in browser
3. Check console for FID (should show mock FID: 12345)
4. Read 3 articles
5. Wait 10 seconds
6. Click Claim
7. Should prompt for network switch to Arbitrum
8. Sign transaction

### Step 10: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard:
# - VITE_CONTRACT_ADDRESS
# - VITE_CATCH_TOKEN
# - VITE_BOOP_TOKEN
# - VITE_ARB_TOKEN
# - VITE_CHAIN_ID=42161
```

## 📝 API Endpoints Available

### POST /api/record-article
Records when user reads an article
```json
{
  "fid": 12345,
  "articleId": "1"
}
```

### POST /api/check-eligibility
Checks if user can claim
```json
{
  "fid": 12345
}
```
Returns:
```json
{
  "eligible": true,
  "articlesRead": 3,
  "hasClaimedToday": false,
  "tenSecondsPasssed": true,
  "timeRemaining": 0
}
```

### POST /api/record-claim
Records successful claim
```json
{
  "fid": 12345,
  "tokens": ["CATCH"],
  "txHash": "0x..."
}
```

### GET /api/user-stats/:fid
Get user statistics
```json
{
  "fid": 12345,
  "articlesReadToday": 3,
  "hasClaimedToday": true,
  "lastClaimDate": "2025-10-02"
}
```

## 🔄 User Flow

1. User opens app in Farcaster → Auto-authenticated with FID
2. User reads articles → Backend tracks via `/api/record-article`
3. After 3 articles + 10s → Frontend checks `/api/check-eligibility`
4. User clicks Claim → Frontend calls contract `claimTokens(fid, tokenType)`
5. User signs transaction → Tokens transferred
6. Frontend calls `/api/record-claim` → Backend marks as claimed

## 🎯 Smart Contract Functions

### claimTokens(uint256 fid, uint8 tokenType)
- `fid`: User's Farcaster ID
- `tokenType`: 0=CATCH, 1=BOOP, 2=ARB
- Checks: Not claimed today, sufficient balance
- Transfers tokens to msg.sender

### hasClaimedToday(uint256 fid) → bool
Returns true if FID has claimed today

## 🚀 Production Checklist

- [ ] Deploy NewsRewardContractV2 to Arbitrum mainnet
- [ ] Fund contract with tokens
- [ ] Update all token addresses to mainnet
- [ ] Change chain to Arbitrum (42161)
- [ ] Remove testnet contracts and files
- [ ] Remove "Connect Wallet" UI
- [ ] Test with real Farcaster Frame
- [ ] Deploy to Vercel
- [ ] Set environment variables
- [ ] Test end-to-end flow

## 📦 Storage

Currently using **in-memory storage** (resets on server restart).

For production, replace with **Vercel KV**:
```bash
# In Vercel dashboard: Storage → Create KV Database
# Copy environment variables to .env

# Update server/routes-farcaster.ts:
import { kv } from '@vercel/kv'

// Replace Map with kv.get/kv.set
await kv.set(`user:${fid}:articles:${today}`, articles)
const articles = await kv.get(`user:${fid}:articles:${today}`) || []
```

## 🎨 UI Changes

The new article page shows:
- FID in claim card
- Articles read count (X/3)
- "Not Eligible" until 3 articles read
- 10 second timer after reading
- Random token claim (no selection needed)
- Success message after claim

## ⚡ Performance

All optimizations from previous work are preserved:
- 30-minute RSS cache
- 12-hour article scraping cache
- HTTP cache headers
- Only 3 articles prefetched
- Stale-while-revalidate

---

**Next Steps:** Follow the checklist above. When you have the mainnet token addresses, I'll help you update everything and deploy!
