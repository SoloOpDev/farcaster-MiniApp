# Automatic Flow - What Happens Without User Action

## ✅ YES - Everything is Automatic!

### 1. **Chain Switching to Arbitrum Mainnet** ✅

**When it happens:**
- User clicks "Claim" button
- Before sending transaction

**What happens automatically:**
```
1. Check current chain via eth_chainId
2. If NOT Arbitrum (42161):
   → Show "Switching to Arbitrum Mainnet..."
   → Call wallet_switchEthereumChain with chainId 0xa4b1
   → If network not in wallet (error 4902):
     → Call wallet_addEthereumChain with full Arbitrum config
     → Call wallet_switchEthereumChain again
   → Wait 1.5 seconds for switch to complete
   → Verify chain is now 42161
3. If chain is correct → Send transaction
```

**User sees:**
- MetaMask popup: "Switch to Arbitrum One?" → Click approve
- (If needed) MetaMask popup: "Add Arbitrum One?" → Click approve
- MetaMask popup: "Sign transaction" → Click sign
- Done!

**No manual network switching needed!** ✅

---

### 2. **FID Retrieval and Sending to Backend** ✅

**When it happens:**
- App loads
- User opens any article
- User checks eligibility
- User claims tokens

**What happens automatically:**

#### **A. FID Retrieved on App Load**
```typescript
// client/src/lib/farcaster.tsx
useEffect(() => {
  // ✅ Automatically checks for Farcaster frame context
  if (window.frameContext?.user?.fid) {
    setFid(frameContext.user.fid); // Real FID in production
  } else {
    setFid(12345); // Mock FID for development
  }
}, []);
```

**User sees:** Nothing - happens silently in background

---

#### **B. FID Sent When User Opens Article**
```typescript
// client/src/pages/article-farcaster.tsx
useEffect(() => {
  if (fid && articleId && isAuthenticated) {
    // ✅ Automatically sends FID + article ID to backend
    fetch('/api/record-article', {
      method: 'POST',
      body: JSON.stringify({ fid, articleId })
    });
  }
}, [fid, articleId]);
```

**Backend receives:**
```json
POST /api/record-article
{
  "fid": 12345,
  "articleId": "1"
}
```

**Backend stores:**
```typescript
userArticles.set('12345:2025-10-02', Set(['1']))
lastArticleTime.set('12345', 1727890234567)
```

**User sees:** Nothing - happens silently

---

#### **C. FID Sent Every 5 Seconds to Check Eligibility**
```typescript
// client/src/pages/article-farcaster.tsx
useEffect(() => {
  if (fid && isAuthenticated) {
    const checkEligibility = async () => {
      // ✅ Automatically sends FID to check eligibility
      const res = await fetch('/api/check-eligibility', {
        method: 'POST',
        body: JSON.stringify({ fid })
      });
      const data = await res.json();
      setEligible(data.eligible); // Updates UI automatically
      setArticlesRead(data.articlesRead); // Shows "Read 2/3 articles"
    };
    checkEligibility();
    setInterval(checkEligibility, 5000); // ✅ Checks every 5 seconds
  }
}, [fid]);
```

**Backend receives every 5 seconds:**
```json
POST /api/check-eligibility
{
  "fid": 12345
}
```

**Backend returns:**
```json
{
  "eligible": true,
  "articlesRead": 3,
  "hasClaimedToday": false,
  "tenSecondsPasssed": true,
  "timeRemaining": 0
}
```

**User sees:** 
- "Read 3/3 articles" updates automatically
- Claim button enables automatically when eligible

---

#### **D. FID Sent to Smart Contract When Claiming**
```typescript
// client/src/pages/article-farcaster.tsx
const handleOnchainClaim = async () => {
  // ✅ Automatically uses FID in contract call
  const hash = await writeContractAsync({
    abi: NEWS_REWARD_ABI_V2,
    address: CONTRACT_ADDRESS,
    functionName: 'claimTokens',
    args: [BigInt(fid), tokenType] // ✅ FID sent to contract
  });
  
  // ✅ Automatically records claim in backend
  await fetch('/api/record-claim', {
    method: 'POST',
    body: JSON.stringify({ 
      fid,
      tokens: [TOKEN_INFO[tokenType].symbol],
      txHash: hash
    })
  });
}
```

**Smart contract receives:**
```solidity
claimTokens(uint256 fid, uint8 tokenType)
// fid = 12345
// tokenType = 0 (CATCH) or 1 (BOOP) or 2 (ARB)
```

**Backend receives after transaction:**
```json
POST /api/record-claim
{
  "fid": 12345,
  "tokens": ["CATCH"],
  "txHash": "0xabc123..."
}
```

**Backend stores:**
```typescript
userClaims.set('12345', {
  lastClaimDate: '2025-10-02',
  claimedToday: true
})
```

**User sees:**
- "Tokens Claimed!" success message
- Can't claim again until tomorrow

---

## 📊 Complete Automatic Timeline

```
00:00 - User opens app in Farcaster
  ✅ FID retrieved: 12345
  ✅ Farcaster connector auto-connects wallet
  ✅ If wrong chain → Auto-switches to Arbitrum

00:05 - User opens Article 1 (index 0 - rewardable)
  ✅ POST /api/record-article { fid: 12345, articleId: "1" }
  ✅ Backend stores: FID 12345 read 1 article today
  ✅ Every 5s: POST /api/check-eligibility
  ✅ Backend returns: { eligible: false, articlesRead: 1 }
  ✅ UI shows: "Read 1/3 articles"

00:10 - User opens Article 2
  ✅ POST /api/record-article { fid: 12345, articleId: "2" }
  ✅ Backend stores: FID 12345 read 2 articles today
  ✅ Every 5s: POST /api/check-eligibility
  ✅ Backend returns: { eligible: false, articlesRead: 2 }
  ✅ UI shows: "Read 2/3 articles"

00:15 - User opens Article 3 (index 3 - rewardable)
  ✅ POST /api/record-article { fid: 12345, articleId: "3" }
  ✅ Backend stores: FID 12345 read 3 articles today
  ✅ 10-second timer starts automatically
  ✅ Every 5s: POST /api/check-eligibility
  ✅ Backend returns: { eligible: false, tenSecondsPasssed: false, timeRemaining: 7 }

00:25 - 10 seconds pass
  ✅ POST /api/check-eligibility
  ✅ Backend returns: { eligible: true, articlesRead: 3, tenSecondsPasssed: true }
  ✅ UI automatically enables Claim button

00:26 - User clicks "Claim"
  ✅ Check chain → If not Arbitrum, auto-switch
  ✅ MetaMask: "Switch to Arbitrum One?" → User approves
  ✅ Random token selected: tokenType = 1 (BOOP)
  ✅ Call contract: claimTokens(12345, 1)
  ✅ MetaMask: "Sign transaction" → User signs
  ✅ Transaction sent to Arbitrum mainnet
  ✅ POST /api/record-claim { fid: 12345, tokens: ["BOOP"], txHash: "0x..." }
  ✅ Backend stores: FID 12345 claimed today
  ✅ UI shows: "Tokens Claimed! Come back tomorrow"

Next Day 00:00 UTC
  ✅ Smart contract resets: hasClaimed[12345][today] = false
  ✅ Backend resets: userArticles clears for new day
  ✅ User can claim again
```

---

## 🎯 What User Does vs What Happens Automatically

| User Action | What Happens Automatically |
|-------------|---------------------------|
| Opens app | ✅ FID retrieved, wallet connected, chain checked |
| Reads article | ✅ FID + article ID sent to backend, stored in DB |
| Waits | ✅ Eligibility checked every 5s, UI updates automatically |
| Clicks Claim | ✅ Chain switches to Arbitrum, FID sent to contract, claim recorded |
| Signs transaction | ✅ Tokens transferred, backend updated, UI shows success |

**User only does 3 things:**
1. Read articles
2. Click "Claim"
3. Sign transaction

**Everything else is automatic!** ✅

---

## 🔧 Current Configuration

**Chain:** Arbitrum Mainnet (42161)
- chainId: 0xa4b1
- RPC: https://arb1.arbitrum.io/rpc
- Explorer: https://arbiscan.io

**FID:** Auto-retrieved from Farcaster frame context
- Production: Real FID from Farcaster
- Development: Mock FID (12345)

**Backend Storage:** In-memory (ready for Vercel KV)
- Article reads: `userArticles.set('fid:date', Set of article IDs)`
- Claims: `userClaims.set('fid', { lastClaimDate, claimedToday })`
- Timers: `lastArticleTime.set('fid', timestamp)`

**Smart Contract:** NewsRewardContractV2
- Function: `claimTokens(uint256 fid, uint8 tokenType)`
- Tracks: `hasClaimed[fid][dayIndex]`
- Transfers: Tokens directly from contract balance

---

## ✅ Summary

**YES to both your questions:**

1. **Chain switches automatically** ✅
   - From any chain → Arbitrum Mainnet
   - Happens when user clicks Claim
   - User just approves MetaMask popups

2. **FID retrieved and sent to backend automatically** ✅
   - Retrieved on app load
   - Sent when reading articles
   - Sent when checking eligibility (every 5s)
   - Sent when claiming tokens
   - Stored in backend database

**Zero manual configuration needed from user!** 🚀
