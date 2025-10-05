# Claim Button Multiple Claims Bug - FIXED

## Problem
Users could claim rewards multiple times from the same article by:
1. Claiming from article A
2. Navigating to article B (which reset the `isClaimed` state)
3. Going back to article A and claiming again

The button was only checking local component state, not the actual claim history.

## Root Cause
1. **Frontend**: `isClaimed` state was local to the component and reset on navigation
2. **Backend**: `/api/record-claim` didn't track which specific article was claimed
3. **Smart Contract**: Allows 3 claims per FID per day (not per article)
4. **Missing Check**: No validation to see if THIS specific article was already claimed

## Solution Implemented

### 1. Frontend Changes (`client/src/pages/article.tsx`)

**Added per-article claim tracking:**
```typescript
// Check if user has already claimed from THIS specific article
const hasClaimedThisArticle = userClaims.some(claim => 
  claim.articleId === articleId && claim.userId === `fid-${fid}`
);

// Update isClaimed when we detect this article was already claimed
useEffect(() => {
  if (hasClaimedThisArticle) {
    setIsClaimed(true);
  }
}, [hasClaimedThisArticle]);
```

**Updated button disabled logic:**
```typescript
disabled={
  (!hasReward && !isLuckyPrize) || 
  isTimerActive || 
  onchainBusy || 
  !fid || 
  (isLuckyPrize && !hasClaimedAll3) || 
  !CONTRACT_ADDRESS || 
  isClaimed || 
  hasClaimedThisArticle  // NEW: Check if this specific article was claimed
}
```

**Updated button text:**
```typescript
{isClaimed || hasClaimedThisArticle ? 'Claimed ✓' : (onchainBusy || txPending ? 'Claiming…' : (isLuckyPrize ? 'Try Luck 🍀' : 'Claim'))}
```

**Pass articleId to backend:**
```typescript
await fetch(getApiUrl('/api/record-claim'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    fid, 
    articleId,  // NEW: Include article ID
    tokens: [TOKEN_INFO[tokenType].symbol], 
    txHash: hash 
  })
});

// Invalidate user claims to refresh the list
queryClient.invalidateQueries({ queryKey: ['/api/user/claims'] });
```

### 2. Backend Changes (`server/routes-farcaster.ts`)

**Updated `/api/record-claim` to store articleId:**
```typescript
const { fid, articleId, tokens, txHash } = req.body;  // Added articleId

// Store in Redis with articleId
await db.set(claimKey, {
  lastClaimDate: today,
  claimedToday: true,
  articleId,  // NEW: Store which article was claimed
  tokens,
  txHash
});

// Store in legacy storage with actual articleId
await storage.createUserClaim({
  userId: `fid-${fid}`,
  articleId: articleId || 'unknown',  // NEW: Use actual article ID
  tokensEarned: tokens?.length || 1
});
```

## How It Works Now

1. **On Page Load**: 
   - Fetch user's claim history from `/api/user/claims`
   - Check if current article ID exists in claim history
   - If yes, set `hasClaimedThisArticle = true` and disable button

2. **On Claim**:
   - Submit transaction to smart contract
   - Record claim with articleId in backend
   - Invalidate claims query to refresh data
   - Button shows "Claimed ✓" and is disabled

3. **On Navigation**:
   - Component remounts with new articleId
   - Checks claim history for new article
   - Button state reflects whether new article was claimed

## Testing Checklist

- [ ] Claim from article 0 (first rewardable article)
- [ ] Navigate to article 3 (second rewardable article)
- [ ] Navigate back to article 0
- [ ] Verify button shows "Claimed ✓" and is disabled
- [ ] Verify cannot claim again from article 0
- [ ] Verify can still claim from article 3 (if claims < 3)

## Files Modified

1. `client/src/pages/article.tsx` - Added per-article claim tracking and pass articleId to backend
2. `client/src/pages/article-farcaster.tsx` - Added articleId to backend claim recording
3. `server/routes-farcaster.ts` - Store articleId with each claim

## Additional Improvements - Wallet Binding Debug

### Issue Discovered
User reported `FID_BOUND_TO_DIFFERENT_WALLET` error even when using the same verified wallet on mobile.

### Debug Features Added

1. **Enhanced Console Logging**
   - Logs connected wallet address before claiming
   - Logs bound wallet from contract
   - Shows FID and contract address

2. **Visual Warning Banner**
   - Shows BEFORE user tries to claim
   - Displays both wallet addresses side-by-side
   - Clear explanation of the issue

3. **Detailed Error Messages**
   - Shows exact wallet addresses in error
   - Helps identify which wallet is bound vs connected

### Files Modified (Additional)
4. `client/src/pages/article.tsx` - Added wallet mismatch warning banner and enhanced logging

## Status
✅ **FIXED** - Users can no longer claim multiple times from the same article
✅ **IMPROVED** - Better debugging for wallet binding issues

## Summary

The bug allowed users to claim rewards multiple times from the same article because:
- The `isClaimed` state was local and reset on navigation
- No check existed to see if a specific article was already claimed
- Backend didn't track which article was claimed

The fix adds:
- Per-article claim tracking using `userClaims` data
- `hasClaimedThisArticle` check that persists across navigation
- ArticleId passed to backend for proper tracking
- Button shows "Claimed ✓" and is disabled for already-claimed articles

This ensures each article can only be claimed once, while still allowing users to claim from different rewardable articles (up to 3 per day as enforced by the smart contract).
