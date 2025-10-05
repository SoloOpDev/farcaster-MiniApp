# FID to Wallet Binding - How It Works

## The Issue You Encountered

**Error**: `FID_BOUND_TO_DIFFERENT_WALLET`

This happens when you try to claim using a different wallet than the one you used for your first claim of the day.

## How the Smart Contract Works

Your smart contract has a **security feature** that binds one Farcaster ID (FID) to one wallet address per day:

```solidity
mapping(uint256 => mapping(uint256 => address)) public fidWalletForDay;

function claimTokens(uint256 fid, uint8 tokenType) external {
    uint256 today = _today();
    
    address registeredWallet = fidWalletForDay[fid][today];
    if (registeredWallet == address(0)) {
        // First claim today - bind FID to this wallet
        fidWalletForDay[fid][today] = msg.sender;
    } else {
        // Subsequent claims - must use same wallet
        require(registeredWallet == msg.sender, "FID_BOUND_TO_DIFFERENT_WALLET");
    }
    
    // ... rest of claim logic
}
```

## Why This Design?

This prevents abuse where someone could:
1. Use one wallet to claim
2. Switch to another wallet to claim again
3. Repeat with multiple wallets

By binding FID to wallet for the day, it ensures **one person (FID) = max 3 claims per day**, regardless of how many wallets they control.

## Your Specific Case

1. **Desktop (First Claim)**: Used MetaMask wallet `0x93Fa...637F` ✅
2. **Smart Contract**: Bound your FID to `0x93Fa...637F` for today
3. **Mobile (Second Claim)**: Tried to use Farcaster Wallet (different address) ❌
4. **Result**: Transaction rejected with `FID_BOUND_TO_DIFFERENT_WALLET`

## Solutions

### Option 1: Use Same Wallet (Recommended)
On mobile, connect to the **same MetaMask wallet** (`0x93Fa...637F`) instead of using Farcaster Wallet.

### Option 2: Wait Until Tomorrow
The binding resets at midnight UTC. Tomorrow you can use a different wallet.

### Option 3: Always Use Same Wallet
Pick one wallet (MetaMask or Farcaster Wallet) and use it consistently for all claims.

## User Experience Improvement

Added friendly error message to both article pages:

```typescript
if (e?.message?.includes('FID_BOUND_TO_DIFFERENT_WALLET')) {
  errorMsg = 'Your FID is bound to a different wallet today. Please use the same wallet you used for your first claim, or wait until tomorrow to use a different wallet.';
}
```

Now users will see a clear explanation instead of a cryptic error code.

## Technical Details

- **Binding Duration**: 24 hours (resets at midnight UTC based on `block.timestamp / 1 days`)
- **Storage**: `fidWalletForDay[fid][dayIndex] = walletAddress`
- **Check**: Every claim verifies `msg.sender == fidWalletForDay[fid][today]`

## Files Modified

1. `client/src/pages/article.tsx` - Added FID_BOUND_TO_DIFFERENT_WALLET error handling
2. `client/src/pages/article-farcaster.tsx` - Added FID_BOUND_TO_DIFFERENT_WALLET error handling

## Status
✅ **IMPROVED** - Users now see a friendly error message explaining the wallet binding restriction
