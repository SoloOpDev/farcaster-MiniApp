# Farcaster Mini App Deployment Checklist

## ✅ Code Fixes Applied

- [x] Fixed Wagmi connector to use `farcasterMiniApp()` from `@farcaster/miniapp-wagmi-connector`
- [x] Fixed Farcaster SDK initialization to use `await sdk.actions.ready()` and `await sdk.context`
- [x] Removed wallet address display from UI (Farcaster handles this automatically)
- [x] Content loads immediately while Farcaster connects in background
- [x] Removed "read 3 articles to unlock" logic - only 3 specific articles (indices 0, 3, 6) have rewards
- [x] Fixed date parsing error with validation

## 🚀 Pre-Deployment Steps

### 1. Environment Variables
Ensure you have set:
```bash
VITE_CONTRACT_ADDRESS=<your-deployed-contract-address>
```

### 2. Build the App
```bash
npm run build
```

### 3. Deploy to HTTPS Endpoint
Mini Apps **MUST** be served over HTTPS. Options:
- Vercel
- Netlify
- Railway
- Your own server with SSL

### 4. Enable Developer Mode in Farcaster
1. Visit: https://farcaster.xyz/~/settings/developer-tools
2. Toggle on "Developer Mode"
3. Access developer tools from left sidebar (desktop)

### 5. Create Mini App Manifest
In Farcaster Developer Tools:
- **Name**: Crypto News - Learn & Earn
- **URL**: Your HTTPS deployment URL
- **Description**: Read crypto news and earn tokens on Arbitrum
- **Icon**: Upload app icon (512x512 recommended)

### 6. Test in Farcaster
- Open your Mini App in Farcaster mobile app
- Open your Mini App in Farcaster desktop app
- Verify FID is retrieved correctly
- Test wallet auto-connection
- Test reading articles
- Test claiming tokens on rewardable articles (indices 0, 3, 6)

## 🧪 Testing Scenarios

### Scenario 1: First Time User
1. User opens Mini App in Farcaster
2. ✅ Content loads immediately
3. ✅ Farcaster connects in background (small blue indicator shows)
4. ✅ FID is retrieved automatically
5. ✅ Wallet auto-connects (no manual connection needed)
6. User opens article at index 0, 3, or 6
7. ✅ 10-second timer starts
8. ✅ After timer, "Claim" button becomes active
9. User clicks "Claim"
10. ✅ Transaction prompt appears in their wallet
11. ✅ User approves transaction
12. ✅ Tokens are sent to their wallet
13. ✅ "Tokens Claimed!" message appears

### Scenario 2: Non-Rewardable Article
1. User opens article at index 1, 2, 4, 5, etc.
2. ✅ Content loads normally
3. ✅ No claim button appears (just reading experience)

### Scenario 3: Already Claimed Today
1. User who already claimed 3 times today opens rewardable article
2. ✅ "Tokens Claimed!" message shows
3. ✅ "Come back tomorrow for more rewards" message

## 📊 Key Metrics to Monitor

- **FID Retrieval Rate**: % of users where FID is successfully retrieved
- **Wallet Connection Rate**: % of users successfully connected
- **Claim Success Rate**: % of claim attempts that succeed
- **Transaction Failures**: Monitor for network/gas issues
- **Article Read Rate**: Which articles get the most engagement

## 🐛 Common Issues & Solutions

### Issue: FID not retrieved
**Solution**: Check console logs. In production, SDK should work. In development, mock FID (12345) is used.

### Issue: Wallet not connecting
**Solution**: Ensure user has a connected wallet in Farcaster settings. The connector auto-connects to their preferred wallet.

### Issue: Transaction fails
**Solution**: 
- Check user has enough ETH for gas on Arbitrum
- Verify contract address is correct
- Check contract has enough tokens to distribute

### Issue: "Not on Arbitrum" error
**Solution**: App auto-switches to Arbitrum. If it fails, user needs to manually switch in their wallet.

### Issue: Date parsing error
**Solution**: Already fixed with validation. If article has invalid date, timestamp won't show (no error).

## 🔐 Security Checklist

- [x] Contract address stored in environment variable (not hardcoded)
- [x] User FID from SDK is used for claims (not client-side input)
- [x] Backend validates claims before recording
- [x] Daily limit enforced (3 claims per day per FID)
- [x] Only specific articles (indices 0, 3, 6) are rewardable
- [x] 10-second timer prevents instant claims

## 📱 Mobile Optimization

- [x] Max width: 420px (Farcaster frame width)
- [x] Touch-friendly buttons (min 44px height)
- [x] Fast loading (content shows immediately)
- [x] Responsive images
- [x] Smooth scrolling

## 🎨 UI/UX Verification

- [x] No wallet address shown (Farcaster handles this)
- [x] Content loads immediately (no blocking on auth)
- [x] Subtle "Connecting Farcaster..." indicator (non-intrusive)
- [x] Clear claim button on rewardable articles
- [x] Timer shows countdown (10 seconds)
- [x] Success message after claim
- [x] Dark mode support

## 📝 Final Pre-Launch Checklist

- [ ] Contract deployed to Arbitrum Mainnet
- [ ] Contract funded with tokens (CATCH, BOOP, ARB)
- [ ] Environment variables set correctly
- [ ] App built and deployed to HTTPS endpoint
- [ ] Mini App manifest created in Farcaster
- [ ] Tested in Farcaster mobile app
- [ ] Tested in Farcaster desktop app
- [ ] Verified FID retrieval works
- [ ] Verified wallet auto-connects
- [ ] Verified claims work end-to-end
- [ ] Verified daily limits work
- [ ] Verified only rewardable articles show claim button
- [ ] Verified non-rewardable articles work normally
- [ ] Monitoring/analytics set up
- [ ] Error logging configured

## 🎉 Launch!

Once all checkboxes are complete, you're ready to share your Mini App on Farcaster!

**Share URL Format:**
```
https://warpcast.com/~/compose?embeds[]=<your-mini-app-url>
```

Or create a cast with your Mini App embedded directly in the Farcaster feed.

---

## 📚 Resources

- Farcaster Mini Apps Docs: https://miniapps.farcaster.xyz/
- Wagmi Docs: https://wagmi.sh/
- Arbitrum Docs: https://docs.arbitrum.io/
- Contract Deployment Guide: See `contracts/README.md`
