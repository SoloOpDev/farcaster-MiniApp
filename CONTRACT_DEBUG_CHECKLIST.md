# Contract Address Debug Checklist

## 🔴 Issue
Wallet still shows "Deploy a contract" when claiming

## ✅ Step 1: Verify .env File

Run this command:
```bash
Get-Content .env
```

**Expected output:**
```
VITE_CONTRACT_ADDRESS=0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
VITE_CATCH_TOKEN=0xbc4c97fb9befaa8b41448e1dfcc5236da543217f
VITE_BOOP_TOKEN=0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3
VITE_ARB_TOKEN=0x912CE59144191C1204E64559FE8253a0e49E6548
VITE_CHAIN_ID=42161
VITE_RPC_URL=https://arb1.arbitrum.io/rpc
```

✅ Contract address is present and correct

## ✅ Step 2: RESTART Dev Server (CRITICAL!)

Vite only reads `.env` file at startup! You MUST restart:

```bash
# Stop all node processes
Get-Process -Name node | Stop-Process -Force

# Start dev server fresh
npm run dev
```

Wait for server to fully start (~5 seconds)

## ✅ Step 3: Hard Refresh Browser

**IMPORTANT**: Browser caches the old code!

- Chrome/Firefox: `Ctrl + Shift + R`
- Or close tab and reopen
- Or use Incognito/Private window

## ✅ Step 4: Check Browser Console

Open DevTools (F12) → Console tab

You should see:
```
🔐 Contract Address: 0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
🔐 All env vars: { VITE_CONTRACT_ADDRESS: "0xFe14CfE...", ... }
```

**If you see:**
```
❌ CONTRACT_ADDRESS is empty! Check .env file and restart dev server
```

Then the server wasn't restarted or .env wasn't loaded.

## ✅ Step 5: Check Wallet Transaction Details

When you click "Claim", the wallet should show:

### ✅ CORRECT (What you want):
```
Call contract
Contract: 0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
Function: claimTokens
Parameters:
  - fid: 123456
  - tokenType: 0/1/2
```

### ❌ WRONG (Current issue):
```
Deploy a contract
This site wants you to deploy a contract
```

## 🔍 Root Cause Analysis

### Why "Deploy a contract" appears:

1. **Empty contract address**
   ```typescript
   CONTRACT_ADDRESS = '' or undefined
   ```
   When Wagmi sees empty address, it thinks you're deploying new contract

2. **Environment variable not loaded**
   - `.env` file exists but Vite didn't read it
   - Dev server started before `.env` was updated
   - Need to restart server

3. **Browser cache**
   - Old JS bundle cached with empty CONTRACT_ADDRESS
   - Hard refresh needed

## 🔧 Complete Fix Steps

### 1. Verify .env exists and has content
```bash
ls .env
Get-Content .env | Select-String "VITE_CONTRACT_ADDRESS"
```

Should output:
```
VITE_CONTRACT_ADDRESS=0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
```

### 2. Kill ALL node processes
```bash
Get-Process -Name node | Stop-Process -Force
```

### 3. Start fresh dev server
```bash
npm run dev
```

### 4. Wait for startup messages
Look for:
```
VITE ready in XXX ms
➜ Local: http://localhost:5173/
```

### 5. Hard refresh browser
```
Ctrl + Shift + R
```

### 6. Check console logs
```
🔐 Contract Address: 0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
```

### 7. Test claim
- Click reward article
- Click "Claim"
- Check wallet popup

## 🎯 Alternative: Check at Runtime

Add this temporary debug button to see what the app sees:

```typescript
<button onClick={() => {
  console.log('CONTRACT_ADDRESS:', CONTRACT_ADDRESS);
  console.log('import.meta.env:', import.meta.env);
  alert(`Contract: ${CONTRACT_ADDRESS}`);
}}>
  Debug Contract Address
</button>
```

## 📋 Checklist

- [ ] `.env` file has correct contract address
- [ ] Stopped all node processes
- [ ] Started `npm run dev` fresh
- [ ] Hard refreshed browser (Ctrl+Shift+R)
- [ ] Console shows contract address: `0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`
- [ ] Wallet shows "Call contract" not "Deploy a contract"

## 🚨 If Still Broken

Check these possibilities:

### 1. Wrong .env location
File must be at **root** of project:
```
g:\RenderPreview\.env  ✅ CORRECT
g:\RenderPreview\client\.env  ❌ WRONG
```

### 2. .env.local overriding
Check if you have:
```bash
ls .env*
```

If you see `.env.local` or `.env.development`, they might override `.env`

### 3. Hardcoded empty string
Check if code has:
```typescript
const CONTRACT_ADDRESS = ''; // ❌ WRONG - hardcoded
```

Should be:
```typescript
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
```

### 4. Vite config issue
Check `vite.config.ts` doesn't have:
```typescript
define: {
  'import.meta.env.VITE_CONTRACT_ADDRESS': '""'  // ❌ WRONG
}
```

## 📝 Current Code Location

File: `client/src/pages/article.tsx`
Lines: 97-110

```typescript
const CONTRACT_ADDRESS = (
  (import.meta as any)?.env?.VITE_CONTRACT_ADDRESS || 
  (import.meta as any)?.env?.NEXT_PUBLIC_CONTRACT_ADDRESS || 
  ''
) as string;

// DEBUG: Log contract address
useEffect(() => {
  console.log('🔐 Contract Address:', CONTRACT_ADDRESS);
  console.log('🔐 All env vars:', import.meta.env);
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '') {
    console.error('❌ CONTRACT_ADDRESS is empty!');
  }
}, [CONTRACT_ADDRESS]);
```

## ✅ Success Criteria

You'll know it's fixed when:

1. ✅ Console shows: `🔐 Contract Address: 0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`
2. ✅ Wallet shows: `Call contract` with function `claimTokens`
3. ✅ Transaction goes through and claims tokens
4. ✅ UI shows "Tokens Claimed!" with amount
