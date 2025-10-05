# Railway Production Environment Setup

## 🚀 Critical: Set Environment Variables

Your production app is showing "Deploy a contract" because **Railway doesn't have the environment variables set**.

### 1. Go to Railway Dashboard
```
https://railway.app/
```

### 2. Select Your Project
Click on: **farcaster-miniapp-production**

### 3. Go to Variables Tab
- Click on your service
- Click **"Variables"** tab
- Click **"+ New Variable"**

### 4. Add These Variables ONE BY ONE

**Contract Addresses:**
```
VITE_CONTRACT_ADDRESS
0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
```

**Token Addresses:**
```
VITE_CATCH_TOKEN
0xbc4c97fb9befaa8b41448e1dfcc5236da543217f
```

```
VITE_BOOP_TOKEN
0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3
```

```
VITE_ARB_TOKEN
0x912CE59144191C1204E64559FE8253a0e49E6548
```

**Network Configuration:**
```
VITE_CHAIN_ID
42161
```

```
VITE_RPC_URL
https://arb1.arbitrum.io/rpc
```

### 5. Save and Redeploy

After adding all variables:
1. Railway will auto-redeploy
2. Wait for deployment to complete (~2-3 minutes)
3. Check deployment logs for any errors

### 6. Verify in Production

Open your production URL:
```
https://farcaster-miniapp-production.up.railway.app
```

Open browser console (F12) and check for:
```
🔐 Contract Address: 0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
🔐 All env vars: { VITE_CONTRACT_ADDRESS: "0xFe14...", ... }
```

**If you see:**
```
❌ CONTRACT_ADDRESS is empty!
```
Then Railway didn't pick up the variables - redeploy manually.

### 7. Test Claim

1. Navigate to article 1, 4, or 7
2. Click "Claim"
3. Wallet should show:
   ```
   ✅ Call contract
   Contract: 0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
   Function: claimTokens
   ```

## 📱 Quick Copy-Paste for Railway

**Variable Name:** `VITE_CONTRACT_ADDRESS`  
**Value:** `0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`

**Variable Name:** `VITE_CATCH_TOKEN`  
**Value:** `0xbc4c97fb9befaa8b41448e1dfcc5236da543217f`

**Variable Name:** `VITE_BOOP_TOKEN`  
**Value:** `0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3`

**Variable Name:** `VITE_ARB_TOKEN`  
**Value:** `0x912CE59144191C1204E64559FE8253a0e49E6548`

**Variable Name:** `VITE_CHAIN_ID`  
**Value:** `42161`

**Variable Name:** `VITE_RPC_URL`  
**Value:** `https://arb1.arbitrum.io/rpc`

## 🔍 How to Check Current Variables

In Railway:
1. Go to your service
2. Click "Variables" tab
3. You should see all 6 `VITE_*` variables

If any are missing, add them!

## ⚠️ Common Issues

### Issue 1: Variables not picked up
**Solution:** After adding variables, manually trigger a redeploy:
- Go to "Deployments" tab
- Click "⋮" (three dots) on latest deployment
- Click "Redeploy"

### Issue 2: Still shows "Deploy a contract"
**Check:**
1. Are ALL 6 variables set in Railway?
2. Did you wait for redeploy to complete?
3. Did you hard refresh browser (Ctrl+Shift+R)?
4. Check browser console for contract address

### Issue 3: Contract address shows as empty
**Solution:** 
- Check variable spelling: `VITE_CONTRACT_ADDRESS` (exact)
- Check value has no extra spaces
- Redeploy after fixing

## 🎯 Success Checklist

- [ ] All 6 VITE_* variables added to Railway
- [ ] Railway redeployed successfully  
- [ ] Production URL loads without errors
- [ ] Browser console shows contract address: `0xFe14...`
- [ ] Wallet shows "Call contract" not "Deploy"
- [ ] Claim transaction goes through
- [ ] Tokens received successfully

## 📝 Screenshot Guide

When in Railway Variables:
```
[+ New Variable]

Name: VITE_CONTRACT_ADDRESS
Value: 0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9

[Add] ✅
```

Repeat for all 6 variables!

---

**After this is done, your production app will work correctly!** 🚀
