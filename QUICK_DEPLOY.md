# 🚀 QUICK DEPLOY GUIDE

## ⚡ 5-Minute Deployment

### 1️⃣ Deploy Contract (Remix)
```
Network: Arbitrum One
Contract: NewsRewardContract.sol
Constructor:
  _catch: 0xbc4c97fb9befaa8b41448e1dfcc5236da543217f
  _boop:  0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3
  _arb:   0x912CE59144191C1204E64559FE8253a0e49E6548
```
**→ Copy contract address!**

### 2️⃣ Fund Contract
Transfer to contract address:
- 1M CATCH tokens
- 1B BOOP tokens  
- 1K ARB tokens

### 3️⃣ Set Environment
```bash
cp .env.example .env
# Edit .env:
VITE_CONTRACT_ADDRESS=[your contract address]
```

### 4️⃣ Deploy to Vercel
```bash
vercel
# Add env vars in dashboard
vercel --prod
```

### 5️⃣ Test
Open in Farcaster → Read 3 articles → Claim tokens ✅

---

## 📋 Token Addresses (Arbitrum Mainnet)

```
CATCH: 0xbc4c97fb9befaa8b41448e1dfcc5236da543217f
BOOP:  0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3
ARB:   0x912CE59144191C1204E64559FE8253a0e49E6548
```

---

## ✅ What's Ready

- ✅ Smart contract (FID-based)
- ✅ Frontend (Arbitrum mainnet)
- ✅ Backend (FID tracking)
- ✅ Farcaster SDK (installed)
- ✅ Auto chain switching
- ✅ No testnet code

---

## 🔧 Troubleshooting

**Contract not working?**
- Check contract is funded: `getBalance(tokenAddress)`
- Verify on Arbiscan: https://arbiscan.io

**FID not working?**
- Check console logs
- Dev: Should show "⚠️ Using mock FID: 12345"
- Prod: Should show "✅ Farcaster FID retrieved: [FID]"

**Chain not switching?**
- Check MetaMask has Arbitrum One added
- Manually add: chainId 42161, RPC https://arb1.arbitrum.io/rpc

---

## 📞 Quick Commands

```bash
# Local dev
npm run dev

# Build
npm run build

# Deploy
vercel --prod

# Check contract balance (in Remix)
getBalance(0xbc4c97fb9befaa8b41448e1dfcc5236da543217f)
```

---

**Ready to launch!** 🚀
