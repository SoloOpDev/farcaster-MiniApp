# Claim Logic Changes for article.tsx

## Changes to Make:

### 1. Add claimsCount from contract (after line 66)

```typescript
// Read claims count from smart contract
const { data: claimsCount } = useReadContract({
  abi: NEWS_REWARD_ABI_V2,
  address: CONTRACT_ADDRESS as `0x${string}`,
  functionName: 'getClaimsUsedToday',
  args: fid ? [BigInt(fid)] : undefined,
  query: { 
    enabled: Boolean(CONTRACT_ADDRESS && fid),
    refetchInterval: 3000,
  },
});

const hasClaimedAll3 = claimsCount ? Number(claimsCount) >= 3 : false;
```

### 2. REMOVE eligibility check useEffect (lines 140-159)

DELETE THIS ENTIRE BLOCK:
```typescript
useEffect(() => {
  if (fid && isAuthenticated) {
    const checkClaimed = async () => {
      try {
        const res = await fetch('/api/check-eligibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid })
        });
        const data = await res.json();
        setIsClaimed(data.hasClaimedToday);
      } catch (err) {
        console.error('Failed to check claim status:', err);
      }
    };
    checkClaimed();
    const interval = setInterval(checkClaimed, 5000);
    return () => clearInterval(interval);
  }
}, [fid, isAuthenticated]);
```

### 3. Fix timer logic (lines 176-189)

REPLACE WITH:
```typescript
useEffect(() => {
  // Regular rewards (articles 0, 3, 6): Start timer immediately
  if (hasReward && !isClaimed && !luckyPrizeFailed) {
    setIsTimerActive(true);
    setTimer(10);
  }
  // Lucky prize (article 2): Only start timer if 3 claims are done
  else if (isLuckyPrize && !isClaimed && !luckyPrizeFailed) {
    if (hasClaimedAll3) {
      setIsTimerActive(true);
      setTimer(10);
    } else {
      setIsTimerActive(false);
      setTimer(10);
    }
  } else {
    setIsTimerActive(false);
    setTimer(10);
    setShowClaimHint(false);
  }
  return () => {
    setIsTimerActive(false);
    setShowClaimHint(false);
  };
}, [hasReward, isClaimed, isLuckyPrize, luckyPrizeFailed, hasClaimedAll3]);
```

### 4. Change visibility check (line 556)

REPLACE:
```typescript
{!isClaimed && !luckyPrizeFailed ? (
```

WITH:
```typescript
{(hasReward || isLuckyPrize) && !luckyPrizeFailed ? (
```

### 5. Update button disabled logic (line 603)

REPLACE:
```typescript
disabled={(!hasReward && !isLuckyPrize) || isTimerActive || onchainBusy || !fid}
```

WITH:
```typescript
disabled={
  (!hasReward && !isLuckyPrize) || 
  isTimerActive || 
  onchainBusy || 
  !fid ||
  (isLuckyPrize && !hasClaimedAll3)  // Lucky prize requires 3 claims first
}
```

### 6. Update button text for lucky prize (line 584-586)

REPLACE:
```typescript
{isLuckyPrize 
  ? (isTimerActive ? 'Read timer in progress…' : 'Try your luck!')
  : (hasReward ? (isTimerActive ? 'Read timer in progress…' : 'Claim your tokens!') : 'Read to earn on selected articles')
}
```

WITH:
```typescript
{isLuckyPrize 
  ? (!hasClaimedAll3 ? 'Complete 3 claims first' : (isTimerActive ? 'Read timer in progress…' : 'Try your luck!'))
  : (hasReward ? (isTimerActive ? 'Read timer in progress…' : 'Claim your tokens!') : 'Read to earn on selected articles')
}
```

## Summary:
- ✅ Removed eligibility API check
- ✅ Added contract-based claimsCount
- ✅ Lucky prize timer only starts after 3 claims
- ✅ Claim section always shows for rewardable articles
- ✅ Button shows "Complete 3 claims first" for lucky prize
