# 🚨 PRODUCTION FIX - DO THIS NOW

## The Problem
Your production app shows "**Deploy a contract**" because **VITE_CONTRACT_ADDRESS is not set in Railway**.

## ✅ The Solution (5 Minutes)

### Step 1: Go to Railway
1. Open: https://railway.app/
2. Login
3. Click: **farcaster-miniapp-production**

### Step 2: Add Environment Variable
1. Click your service name
2. Click **"Variables"** tab
3. Click **"+ New Variable"**
4. Enter:
   - **Variable Name**: `VITE_CONTRACT_ADDRESS`
   - **Value**: `0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`
5. Click **"Add"**

### Step 3: Redeploy
Railway will auto-redeploy. Wait 2-3 minutes.

### Step 4: Verify
1. Go to: https://farcaster-miniapp-production.up.railway.app
2. Open browser console (F12)
3. Look for: `🔐 Contract Address: 0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`
4. Go to reward article (1, 4, or 7)
5. Click "Claim"
6. Wallet should show: **"Call contract"** ✅ NOT "Deploy a contract" ❌

---

## What Was Fixed in Code (Just Pushed)

### 1. Contract Address Validation ✅
```typescript
// Before calling writeContractAsync, check:
if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '') {
  setOnchainResult('Error: Contract address not configured');
  return;
}
```

### 2. Address Format Validation ✅
```typescript
// Ensures address starts with 0x
if (!CONTRACT_ADDRESS.startsWith('0x')) {
  throw new Error('Invalid contract address');
}
```

### 3. Visual Warning ✅
Red warning box appears when contract not configured:
```
⚠️ Contract not configured. Set VITE_CONTRACT_ADDRESS and redeploy.
```

### 4. Disabled Button ✅
Claim button is disabled when `!CONTRACT_ADDRESS`

### 5. Enhanced Logging ✅
```typescript
console.log('🔐 Contract Address:', CONTRACT_ADDRESS);
console.log('🚀 About to call writeContractAsync with:', {
  contract: CONTRACT_ADDRESS,
  function: 'claimTokens',
  fid, tokenType
});
```

---

## Why This Fixes It

**Before:**
- `CONTRACT_ADDRESS` was empty (`""`)
- Wagmi saw empty address
- Wallet thought you wanted to **deploy new contract**

**After:**
- `CONTRACT_ADDRESS` = `0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`
- Wagmi sees valid address
- Wallet calls `claimTokens()` on **existing contract** ✅

---

## Complete Environment Variables Checklist

Add ALL these to Railway:

```
VITE_CONTRACT_ADDRESS=0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
VITE_CATCH_TOKEN=0xbc4c97fb9befaa8b41448e1dfcc5236da543217f
VITE_BOOP_TOKEN=0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3
VITE_ARB_TOKEN=0x912CE59144191C1204E64559FE8253a0e49E6548
VITE_CHAIN_ID=42161
VITE_RPC_URL=https://arb1.arbitrum.io/rpc
```

---

## Verification Checklist

After deploying:

- [ ] Railway redeploy completed
- [ ] Production URL loads: https://farcaster-miniapp-production.up.railway.app
- [ ] Browser console shows: `🔐 Contract Address: 0xFe14...`
- [ ] NO red warning box visible
- [ ] Claim button is enabled (not grayed out)
- [ ] Clicking "Claim" shows wallet with "**Call contract**"
- [ ] Transaction parameters show:
  - Contract: `0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`
  - Function: `claimTokens`
  - Args: `[fid, tokenType]`

---

## If Still Showing "Deploy a contract"

### Check 1: Is variable set?
Railway → Variables → Should see `VITE_CONTRACT_ADDRESS`

### Check 2: Did Railway redeploy?
Railway → Deployments → Check latest deployment status

### Check 3: Browser cache?
Hard refresh: `Ctrl + Shift + R`

### Check 4: Console logs?
```
❌ CONTRACT_ADDRESS is empty!
```
Means Railway didn't load the variable. Redeploy manually.

---

## Summary

**Root Cause**: Missing `VITE_CONTRACT_ADDRESS` in Railway environment variables

**Fix**: 
1. Add variable to Railway
2. Code now validates and prevents empty addresses
3. Clear error messages guide users
4. Forces use of existing deployed contract

**Commit**: `d698b80`
**Status**: ✅ Pushed to main
**Action Required**: Set environment variable in Railway and redeploy

---

**DO THIS NOW → Go to Railway and add VITE_CONTRACT_ADDRESS** 🚀
