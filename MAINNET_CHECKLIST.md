# Mainnet Readiness Checklist

## ✅ DONE - Already Mainnet Ready:
1. ✅ `client/src/lib/wagmi.ts` - Arbitrum mainnet (42161)
2. ✅ `client/src/components/layout.tsx` - Arbitrum mainnet (42161)
3. ✅ `client/src/pages/article-farcaster.tsx` - Arbitrum mainnet (42161)
4. ✅ `client/src/utils/contract.js` - Arbitrum mainnet (42161)
5. ✅ `contracts/NewsRewardContractV2.sol` - FID-based, mainnet ready
6. ✅ `server/routes-farcaster.ts` - FID tracking APIs

## ❌ TODO - Needs Fixing:
1. ❌ `client/src/pages/article.tsx` - Still on Sepolia (11155111)
2. ❌ Delete testnet contracts: TestARB.sol, TestCATCH.sol, TestBOOP.sol
3. ❌ Replace article.tsx with article-farcaster.tsx

## 🔧 Quick Fixes:

### Fix 1: Replace Old Article Page
```bash
# Backup old version
mv client/src/pages/article.tsx client/src/pages/article-OLD-SEPOLIA.tsx

# Use Farcaster version
mv client/src/pages/article-farcaster.tsx client/src/pages/article.tsx
```

### Fix 2: Delete Testnet Contracts
```bash
rm contracts/TestARB.sol
rm contracts/TestCATCH.sol
rm contracts/TestBOOP.sol
rm contracts/NewsRewardContract.sol
```

### Fix 3: Update Environment Variables
```bash
# .env
VITE_CONTRACT_ADDRESS=0x... # Your deployed NewsRewardContractV2 address
VITE_CHAIN_ID=42161
VITE_CATCH_TOKEN=0x... # Real CATCH token address
VITE_BOOP_TOKEN=0x... # Real BOOP token address
VITE_ARB_TOKEN=0x... # Real ARB token address
```

## 🎯 Final Verification:

All files now use:
- Chain ID: 42161 (Arbitrum Mainnet)
- RPC: https://arb1.arbitrum.io/rpc
- Explorer: https://arbiscan.io
- FID-based claims
- Automatic chain switching
