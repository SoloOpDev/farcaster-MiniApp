# Railway Environment Variable Debug Steps

## The Issue
Warning shows: "⚠️ Contract not configured" even after adding VITE_CONTRACT_ADDRESS to Railway

## Why This Happens
**Vite variables are injected at BUILD time**, not runtime!

When Railway builds your app (`vite build`), it replaces `import.meta.env.VITE_CONTRACT_ADDRESS` with the actual value. If the variable wasn't set when the build ran, it gets replaced with `undefined`.

## 🔍 Check These Things:

### 1. Is the variable name EXACT?
In Railway Variables, verify:
- **Name**: `VITE_CONTRACT_ADDRESS` (exact, case-sensitive)
- **Value**: `0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`

### 2. Did Railway rebuild AFTER you added the variable?
**Critical**: Adding a variable doesn't automatically rebuild the app!

Check Railway Deployments:
- Look at timestamp of latest deployment
- Was it AFTER you added the variable?
- If not, you need to manually redeploy

### 3. Force a Redeploy
Railway → Deployments → Latest deployment → "⋮" menu → **Redeploy**

This will rebuild the app WITH the environment variable included.

## 📋 Step-by-Step Fix

### Step 1: Verify Variable
Railway → Your service → Variables tab

Should see:
```
VITE_CONTRACT_ADDRESS = 0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9
```

### Step 2: Check Last Deployment Time
Railway → Deployments tab

Note the time. Did you add the variable BEFORE or AFTER this deployment?

### Step 3: Trigger New Deployment
**Method A: Change Something**
- Go to Variables
- Add a dummy variable: `REBUILD=1`
- Save (Railway auto-redeploys)
- Delete the dummy variable after

**Method B: Manual Redeploy**
- Deployments → "⋮" on latest → Redeploy

**Method C: Push to Git**
- Make any small change
- Git push (triggers Railway webhook)

### Step 4: Wait for Build
Watch the deployment logs:
```
Building...
Running: npm run build
vite build
✓ built in XXXms
```

### Step 5: Verify Build Logs
In Railway deployment logs, look for:
```
VITE_CONTRACT_ADDRESS is available during build
```

If you don't see your env var mentioned, it might not be loading.

### Step 6: Test Production
After successful deployment:
1. Hard refresh: `Ctrl + Shift + R`
2. Open console (F12)
3. Check for: `🔐 Contract Address: 0xFe14...`

## 🚨 Common Mistakes

### Mistake 1: Wrong Variable Name
❌ `CONTRACT_ADDRESS`
❌ `VITE_CONTRACT_ADDR`
❌ `REACT_APP_CONTRACT_ADDRESS`
✅ `VITE_CONTRACT_ADDRESS`

### Mistake 2: Not Rebuilding
Adding variable doesn't trigger rebuild automatically in some cases.
**Solution**: Force redeploy

### Mistake 3: Wrong Timing
Variable added after last build = not included in build
**Solution**: Rebuild after adding variable

### Mistake 4: Cached Browser
Old bundle cached in browser
**Solution**: Hard refresh (Ctrl + Shift + R)

## 🔧 Alternative: Add Variable to Build Command

If Railway isn't picking up variables, you can add them inline:

Railway → Settings → Build Command:
```bash
VITE_CONTRACT_ADDRESS=0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9 npm run build
```

**NOT RECOMMENDED** - env vars are better, but this is a workaround.

## 🎯 Verification Checklist

After redeploying, check:

- [ ] Railway shows deployment successful
- [ ] Deployment timestamp is AFTER adding env var
- [ ] Production URL loads
- [ ] Hard refreshed browser (Ctrl + Shift + R)
- [ ] Console shows: `🔐 Contract Address: 0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`
- [ ] Warning "Contract not configured" is GONE
- [ ] Claim button is enabled (not grayed out)
- [ ] Clicking Claim shows wallet with "Call contract"

## 📝 Quick Test

Open production URL console and run:
```javascript
console.log(import.meta.env.VITE_CONTRACT_ADDRESS);
```

**If it shows `undefined`**: Variable wasn't available during build
**If it shows address**: Variable is loaded correctly

## 🆘 If Still Not Working

### Check Build Logs
Railway → Deployments → Click deployment → View logs

Look for errors during `vite build`

### Verify Railway Service Settings
- Is the variable in the CORRECT service?
- Do you have multiple services? Variable needs to be in the one that builds the frontend

### Check Vite Config
Variable should work automatically with Vite, no special config needed.

### Last Resort: Hardcode for Testing
Temporarily in `article.tsx`:
```typescript
const CONTRACT_ADDRESS = '0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9';
```

If this works, confirms Railway env var issue. Revert after confirming.

---

## Summary

1. ✅ Variable name: `VITE_CONTRACT_ADDRESS`
2. ✅ Value: `0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9`
3. ⚠️ **REBUILD AFTER ADDING VARIABLE** (critical!)
4. ✅ Hard refresh browser
5. ✅ Verify in console

**Most likely issue: Railway didn't rebuild after you added the variable!**
