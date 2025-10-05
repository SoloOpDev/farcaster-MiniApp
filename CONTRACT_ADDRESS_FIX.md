# Contract Address Fix - 2025-10-05T15:05

## 🔴 Problem
When clicking "Claim" button, wallet showed:
```
Deploy a contract
This site wants you to deploy a contract
```

Instead of calling an existing contract function.

## 🔍 Root Cause
`.env` file had **empty** contract address:
```env
VITE_CONTRACT_ADDRESS=
```

When the contract address is empty, the wallet thinks you're trying to deploy a NEW contract instead of calling an EXISTING one.

## ✅ Solution Applied
Updated `.env` file with your deployed contract address:

```env
VITE_CONTRACT_ADDRESS=0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9

VITE_CATCH_TOKEN=0xbc4c97fb9befaa8b41448e1dfcc5236da543217f
VITE_BOOP_TOKEN=0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3
VITE_ARB_TOKEN=0x912CE59144191C1204E64559FE8253a0e49E6548

VITE_CHAIN_ID=42161
VITE_RPC_URL=https://arb1.arbitrum.io/rpc
```

## 🧪 Test Now

### 1. Refresh Browser
**IMPORTANT**: Hard refresh the browser to pick up new contract address
- Chrome/Firefox: `Ctrl + Shift + R`
- Or open Incognito/Private window

### 2. Navigate to Reward Article
- Open `http://localhost:3001`
- Click on **article 1, 4, or 7** (positions 0, 3, 6)

### 3. Click Claim
You should now see:
```
✅ Call contract
This site wants you to call a function on:
0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9

Function: claimTokens
Parameters:
  - fid: [Your FID]
  - tokenType: [0, 1, or 2]
```

**NOT** "Deploy a contract"

### 4. Expected Flow
1. Wallet shows "Call contract" ✅
2. Shows function `claimTokens` ✅
3. Shows gas estimate (< $0.01) ✅
4. You approve transaction ✅
5. Transaction confirms ✅
6. UI shows "Tokens Claimed!" ✅
7. Shows which token and amount ✅

## 🔐 Contract Details

### Deployed Contract
- **Address**: `0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`
- **Network**: Arbitrum Mainnet (Chain ID: 42161)
- **Function**: `claimTokens(uint256 fid, uint8 tokenType)`

### Token Types
- `tokenType = 0` → 3 CATCH tokens
- `tokenType = 1` → 4000 BOOP tokens
- `tokenType = 2` → 0.3 ARB tokens

### Daily Limit
- 3 claims per FID per day
- Tracked on-chain via `getClaimsUsedToday(fid)`

## 📋 Verify Contract on Arbiscan

Check your contract:
```
https://arbiscan.io/address/0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
```

Verify it has:
- ✅ Token balances (CATCH, BOOP, ARB)
- ✅ Correct constructor arguments
- ✅ Can call `claimTokens` function

## ⚠️ Important Notes

### For Production Deployment
When deploying to Railway/Vercel, add these environment variables:

```bash
VITE_CONTRACT_ADDRESS=0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
VITE_CATCH_TOKEN=0xbc4c97fb9befaa8b41448e1dfcc5236da543217f
VITE_BOOP_TOKEN=0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3
VITE_ARB_TOKEN=0x912CE59144191C1204E64559FE8253a0e49E6548
VITE_CHAIN_ID=42161
VITE_RPC_URL=https://arb1.arbitrum.io/rpc
```

### Contract Funding
Make sure your contract has tokens:
1. Go to Arbiscan
2. Check token balances
3. If empty, send tokens to contract address:
   - Send CATCH tokens
   - Send BOOP tokens
   - Send ARB tokens

## 🎉 Summary

**Issue**: Empty contract address caused "Deploy a contract" error
**Fix**: Updated `.env` with deployed contract address `0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`
**Status**: ✅ Ready to test
**Action**: Hard refresh browser and try claiming!
