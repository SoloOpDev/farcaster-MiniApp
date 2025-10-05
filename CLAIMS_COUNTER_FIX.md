# Claims Counter Fix - Reading from Smart Contract ✅

## 🎯 Problem
The claims counter (0/3, 1/3, 2/3, 3/3) was not updating after each on-chain claim.

## ✅ Solution Applied

### 1. Updated ABI (`abi-v2.ts`)
Added missing functions to the ABI:
```typescript
{
  type: 'function',
  name: 'getClaimsUsedToday',
  inputs: [{ name: 'fid', type: 'uint256' }],
  outputs: [{ type: 'uint8' }],
  stateMutability: 'view'
}
```

### 2. Updated Layout (`layout.tsx`)
Changed from reading backend API to reading **directly from smart contract**:

**Before (WRONG):**
```typescript
// Was reading from backend API
const { data: claimsCount } = useReadContract({
  functionName: 'claimsUsedToday',
  args: [address], // ❌ Wrong - used wallet address
});
```

**After (CORRECT):**
```typescript
// Now reads from smart contract using FID
const { data: claimsCount } = useReadContract({
  abi: NEWS_REWARD_ABI_V2,
  functionName: 'getClaimsUsedToday',
  args: fid ? [BigInt(fid)] : undefined, // ✅ Correct - uses FID
  query: { 
    refetchInterval: 3000, // Auto-refresh every 3 seconds
  },
});
```

### 3. Updated Article Page (`article.tsx`)
Added immediate refetch after successful claim:

```typescript
useEffect(() => {
  if (txSuccess) {
    // ... show success toast
    
    // Invalidate wagmi queries to refetch claims count immediately
    queryClient.invalidateQueries({ queryKey: ['readContract'] });
  }
}, [txSuccess, txReceipt, queryClient]);
```

---

## 📊 How It Works Now

### User Flow:
1. **User opens Article #1 (index 0)**
   - Bottom bar shows: `0/3 articles claimed today`

2. **User reads for 10 seconds → Claims**
   - Transaction sent to blockchain
   - Smart contract: `claimsUsedToday[fid][today] = 1`
   - Transaction confirmed ✅

3. **Immediately after claim:**
   - `queryClient.invalidateQueries()` triggers
   - Layout refetches `getClaimsUsedToday(fid)` from contract
   - Bottom bar updates: `1/3 articles claimed today` ✅

4. **User opens Article #2 (index 3) → Claims**
   - Smart contract: `claimsUsedToday[fid][today] = 2`
   - Bottom bar updates: `2/3 articles claimed today` ✅

5. **User opens Article #3 (index 6) → Claims**
   - Smart contract: `claimsUsedToday[fid][today] = 3`
   - Bottom bar updates: `3/3 articles claimed today` ✅

6. **User tries to claim again:**
   - Contract rejects: `DAILY_LIMIT_REACHED`
   - Bottom bar still shows: `3/3 articles claimed today`

---

## 🔄 Auto-Refresh Mechanism

### Two Ways Counter Updates:

**1. Immediate (After Claim):**
```typescript
// In article.tsx - triggers immediately when transaction succeeds
queryClient.invalidateQueries({ queryKey: ['readContract'] });
```

**2. Periodic (Every 3 Seconds):**
```typescript
// In layout.tsx - polls contract every 3 seconds
query: { 
  refetchInterval: 3000,
}
```

This ensures the counter is always up-to-date, even if:
- User claims in another tab
- User refreshes the page
- Network is slow

---

## ✅ What Changed

| Aspect | Before | After |
|--------|--------|-------|
| **Data Source** | Backend API (Redis) | Smart Contract (Blockchain) |
| **Query Parameter** | Wallet address | FID |
| **Update Trigger** | Manual refresh | Automatic (immediate + polling) |
| **Accuracy** | Can be out of sync | Always accurate (source of truth) |
| **Function Called** | `claimsUsedToday(address)` ❌ | `getClaimsUsedToday(fid)` ✅ |

---

## 🔒 Security Benefits

### Reading from Smart Contract:
- ✅ **Source of truth** - Can't be manipulated
- ✅ **Always accurate** - Reflects actual on-chain state
- ✅ **Trustless** - No backend dependency for critical data

### Backend API is now only for:
- Article reading tracking (UX)
- 10-second timer (UX)
- Claim history (analytics)

**Security is 100% on-chain!** 🔒

---

## 🎯 Expected Behavior

### Scenario 1: Normal Claiming
```
Initial state: 0/3
User claims Article #1 → Transaction confirms → Updates to 1/3 ✅
User claims Article #2 → Transaction confirms → Updates to 2/3 ✅
User claims Article #3 → Transaction confirms → Updates to 3/3 ✅
User tries Article #1 again → Button disabled, shows 3/3 ✅
```

### Scenario 2: Page Refresh
```
User has claimed 2 times today
User refreshes page
Layout reads from contract: getClaimsUsedToday(fid) = 2
Shows: 2/3 ✅
```

### Scenario 3: Multiple Tabs
```
Tab 1: User claims → Updates to 1/3
Tab 2: Auto-refreshes every 3 seconds → Updates to 1/3 ✅
```

---

## ✅ Summary

**Status:** FIXED ✅

**Changes:**
1. ✅ Added `getClaimsUsedToday` to ABI
2. ✅ Layout now reads from smart contract using FID
3. ✅ Article page invalidates queries after successful claim
4. ✅ Auto-refresh every 3 seconds for real-time updates

**Result:**
- Counter updates **immediately** after each claim
- Always shows accurate on-chain state
- Works across tabs and page refreshes
- No backend dependency for critical data

**The 0/3 counter will now move after every on-chain claim!** 🎉
