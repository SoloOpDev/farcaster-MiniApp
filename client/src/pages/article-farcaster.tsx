import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, DollarSign, Clock, Coins, CheckCircle } from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId, useSwitchChain } from "wagmi";
import { decodeEventLog } from "viem";
import { NEWS_REWARD_ABI_V2 } from "@/lib/abi-v2";
import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useFarcaster } from "@/lib/farcaster";
import type { CryptoPanicResponse, UserClaim } from "@shared/schema";

// Token info - Arbitrum Mainnet addresses
const TOKEN_INFO: Record<number, { symbol: string; address: string; amountPerClaim: string }> = {
  0: { symbol: 'CATCH', address: '0xbc4c97fb9befaa8b41448e1dfcc5236da543217f', amountPerClaim: '5' },
  1: { symbol: 'BOOP', address: '0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3', amountPerClaim: '4000' },
  2: { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', amountPerClaim: '0.001' },
};

export default function ArticlePage({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [timer, setTimer] = useState(10);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [showClaimHint, setShowClaimHint] = useState(false);
  const [onchainBusy, setOnchainBusy] = useState(false);
  const [onchainResult, setOnchainResult] = useState<string | null>(null);
  const [eligible, setEligible] = useState(false);
  const [articlesRead, setArticlesRead] = useState(0);
  const { address, isConnected } = useAccount();
  const activeChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { fid, isAuthenticated, isLoading: farcasterLoading } = useFarcaster();

  // Contract address - direct Vite env access
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';
  
  // Get cached news data
  const { data: newsData } = useQuery<CryptoPanicResponse>({
    queryKey: ["/api/news"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: userClaims = [] } = useQuery<UserClaim[]>({
    queryKey: ["/api/user/claims"],
    staleTime: 30 * 1000,
  });

  const articleId = params.id;
  const article = newsData?.results?.find(a => a.id.toString() === articleId);

  const { data: articleDetail } = useQuery<any>({
    queryKey: ["/api/article", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/article/${params.id}`);
      if (!res.ok) throw new Error('Failed to fetch article details');
      return res.json();
    },
    enabled: !!params.id && !!newsData && (!article || !(article as any).content || (article as any).content.length < 100),
    staleTime: 5 * 60 * 1000,
  });

  const articleIndex = newsData?.results?.findIndex(a => a.id.toString() === params.id) ?? -1;
  const rewardableIndices = [0, 3, 6];
  const hasReward = articleIndex >= 0 && 
    rewardableIndices.includes(articleIndex) &&
    !userClaims.some(claim => claim.articleId === params.id);

  // Record article read when user opens it
  useEffect(() => {
    if (fid && articleId && isAuthenticated) {
      fetch('/api/record-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, articleId })
      }).catch(console.error);
    }
  }, [fid, articleId, isAuthenticated]);

  // Check eligibility
  useEffect(() => {
    if (fid && isAuthenticated) {
      const checkEligibility = async () => {
        try {
          const res = await fetch('/api/check-eligibility', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fid })
          });
          const data = await res.json();
          setEligible(data.eligible);
          setArticlesRead(data.articlesRead);
          setIsClaimed(data.hasClaimedToday);
        } catch (err) {
          console.error('Failed to check eligibility:', err);
        }
      };
      checkEligibility();
      const interval = setInterval(checkEligibility, 5000); // Check every 5s
      return () => clearInterval(interval);
    }
  }, [fid, isAuthenticated]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer(timer - 1);
      }, 1000);
    } else if (timer === 0 && isTimerActive) {
      setIsTimerActive(false);
      console.log('⏰ Timer ended! Button enabled?', 'hasReward:', hasReward, 'isConnected:', isConnected, 'eligible:', eligible);
      if (hasReward && !isClaimed) {
        setShowClaimHint(true);
      }
    }
    return () => clearInterval(interval);
  }, [timer, isTimerActive]);

  useEffect(() => {
    if (hasReward && !isClaimed) {
      setIsTimerActive(true);
      setTimer(10);
      console.log('✓ Timer started - hasReward:', hasReward, 'isClaimed:', isClaimed);
    } else {
      setIsTimerActive(false);
      setTimer(10);
      setShowClaimHint(false);
      console.log('✗ Timer NOT started - hasReward:', hasReward, 'isClaimed:', isClaimed, 'articleIndex:', articleIndex, 'isConnected:', isConnected);
    }
    return () => {
      setIsTimerActive(false);
      setShowClaimHint(false);
    };
  }, [hasReward, isClaimed]);

  const { writeContractAsync } = useWriteContract();
  const [pendingHash, setPendingHash] = useState<`0x${string}` | null>(null);
  const { isLoading: txPending, isSuccess: txSuccess, data: txReceipt } = useWaitForTransactionReceipt({ hash: pendingHash ?? undefined });

  const handleOnchainClaim = async () => {
    try {
      if (!isConnected || !address) throw new Error('Wallet not connected');
      if (!fid) throw new Error('Farcaster FID not found');
      if (!eligible) throw new Error('Not eligible to claim yet');
      
      // Force switch to Arbitrum Mainnet
      const eth: any = (window as any)?.ethereum;
      const getCurrentChain = async () => {
        if (!eth?.request) return null;
        try {
          const chainId = await eth.request({ method: 'eth_chainId' });
          return parseInt(chainId, 16);
        } catch {
          return null;
        }
      };
      
      const currentChain = await getCurrentChain();
      if (currentChain !== 42161 && eth?.request) {
        setOnchainBusy(true);
        setOnchainResult('Switching to Arbitrum Mainnet...');
        try {
          await eth.request({ 
            method: 'wallet_switchEthereumChain', 
            params: [{ chainId: '0xa4b1' }] 
          });
        } catch (switchError: any) {
          if (switchError.code === 4902 || switchError.code === -32603) {
            await eth.request({ 
              method: 'wallet_addEthereumChain', 
              params: [{
                chainId: '0xa4b1',
                chainName: 'Arbitrum One',
                nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://arb1.arbitrum.io/rpc'],
                blockExplorerUrls: ['https://arbiscan.io'],
              }]
            });
            await eth.request({ 
              method: 'wallet_switchEthereumChain', 
              params: [{ chainId: '0xa4b1' }] 
            });
          } else {
            setOnchainBusy(false);
            throw new Error('Network switch failed. Please switch to Arbitrum Mainnet manually in MetaMask');
          }
        }
        
        setOnchainResult('Verifying network switch...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        const newChain = await getCurrentChain();
        if (newChain !== 42161) {
          setOnchainBusy(false);
          throw new Error('Still on wrong network. Please manually switch to Arbitrum Mainnet in MetaMask and try again');
        }
        
        setOnchainBusy(false);
        setOnchainResult(null);
      }
      
      setOnchainBusy(true);
      setOnchainResult(null);
      
      // Randomize token type: 0=CATCH, 1=BOOP, 2=ARB
      const tokenType = Math.floor(Math.random() * 3);
      
      const hash = await writeContractAsync({
        abi: NEWS_REWARD_ABI_V2,
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'claimTokens',
        args: [BigInt(fid), tokenType],
      });
      
      setPendingHash(hash as `0x${string}`);
      setOnchainResult(`Submitted. Tx: ${hash}`);
      
      // Record claim in backend
      await fetch('/api/record-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, articleId, tokens: [TOKEN_INFO[tokenType].symbol], txHash: hash })
      });
      
    } catch (e: any) {
      let errorMsg = e?.message || 'Failed to submit on-chain claim';
      
      // User-friendly error messages
      if (e?.message?.includes('FID_BOUND_TO_DIFFERENT_WALLET')) {
        errorMsg = 'Your FID is bound to a different wallet today. Please use the same wallet you used for your first claim, or wait until tomorrow to use a different wallet.';
      } else if (e?.message?.includes('rejected') || e?.message?.includes('denied') || e?.code === 4001) {
        errorMsg = 'Transaction cancelled by user.';
      } else if (e?.message?.includes('insufficient funds') || e?.message?.includes('insufficient fee')) {
        errorMsg = 'Insufficient ETH for gas fees.';
      }
      
      setOnchainResult(errorMsg);
      toast({ title: 'Claim failed', description: errorMsg, variant: 'destructive' });
    } finally {
      setOnchainBusy(false);
    }
  };

  useEffect(() => {
    if (txSuccess) {
      setIsClaimed(true);
      let tokenTypeLabel: string | undefined;
      let tokenInfo: typeof TOKEN_INFO[0] | undefined;
      
      try {
        const logs = txReceipt?.logs || [];
        for (const log of logs) {
          try {
            const ev = decodeEventLog({
              abi: NEWS_REWARD_ABI_V2 as any,
              data: log.data as `0x${string}`,
              topics: (log.topics as unknown as [`0x${string}`, ...`0x${string}`[]]),
            }) as any;
            if (ev?.eventName === 'TokensClaimed') {
              const t = Number(ev?.args?.tokenType);
              if (!Number.isNaN(t)) {
                const info = TOKEN_INFO[t];
                tokenTypeLabel = info?.symbol ?? `Token ${t}`;
                tokenInfo = info;
                break;
              }
            }
          } catch {}
        }
      } catch {}
      
      const details = tokenInfo
        ? `${tokenInfo.amountPerClaim} ${tokenInfo.symbol}`
        : (tokenTypeLabel ? tokenTypeLabel : undefined);
      const desc = details ? `You received ${details}. ${pendingHash ? `Tx: ${pendingHash}` : ''}` : (pendingHash ? `Tx: ${pendingHash}` : undefined);
      toast({ title: 'On-chain claim complete', description: desc });
    }
  }, [txSuccess, txReceipt]);

  // Content loading logic (same as before)
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`article:${articleId}`);
      if (cached) {
        const parsed = JSON.parse(cached) as { content?: string };
        if (parsed?.content && parsed.content.length > 50) {
          setFullContent((prev) => (prev ?? parsed.content) ?? null);
        }
      }
    } catch {}
  }, [articleId]);

  useEffect(() => {
    if (!article) return;
    
    const initial = (article as any).content as string | undefined;
    if (initial && initial.length > 50) {
      setFullContent(initial);
    }

    if (article.original_url) {
      const ctrl = new AbortController();
      fetch(`/api/scrape?url=${encodeURIComponent(article.original_url)}`, { signal: ctrl.signal })
        .then(res => res && res.ok ? res.json() : null)
        .then(data => {
          if (data?.content && data.content.length > 100) {
            setFullContent(prev => {
              const prevLen = (prev?.length ?? 0);
              return data.content.length > prevLen ? data.content : prev ?? data.content;
            });
            try {
              sessionStorage.setItem(`article:${articleId}` , JSON.stringify({ content: data.content, ts: Date.now() }));
            } catch {}
          }
        })
        .catch(() => {});
      return () => ctrl.abort();
    }
  }, [article]);

  useEffect(() => {
    if (articleDetail?.content && typeof articleDetail.content === 'string') {
      setFullContent((prev) => {
        const prevLen = prev?.length ?? 0;
        return articleDetail.content.length > prevLen ? articleDetail.content : prev ?? articleDetail.content;
      });
      try {
        sessionStorage.setItem(`article:${articleId}` , JSON.stringify({ content: articleDetail.content, ts: Date.now() }));
      } catch {}
    }
  }, [articleDetail]);

  if (farcasterLoading) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Authenticating with Farcaster...</p>
      </div>
    );
  }

  if (!isAuthenticated || !fid) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-4">
        <p className="text-lg font-semibold">Farcaster Authentication Required</p>
        <p className="mt-2 text-sm text-muted-foreground">Please open this app in Farcaster</p>
      </div>
    );
  }

  if (!newsData && !article) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="sticky top-[49px] z-40 -mt-px border-b bg-background px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-2 h-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="sticky top-[49px] z-40 -mt-px border-b bg-background px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-2 h-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Article not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col w-full relative">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-lg dark:bg-gray-900/70">
        <div className="flex h-12 items-center justify-between px-4 mx-auto max-w-[400px] border-b border-gray-200 dark:border-gray-800">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-2 h-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {hasReward && !isClaimed && (
            isTimerActive ? (
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-green-600">
                  <Clock className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-medium tabular-nums">{timer}s</span>
              </div>
            ) : (
              showClaimHint && (
                <div className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-900 shadow-sm">
                  Scroll down to claim
                </div>
              )
            )
          )}
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-black">
        {article.image && (
          <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <img
              src={article.image}
              alt={article.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="mx-auto max-w-[400px] px-4 py-6">
          <div className="mb-4 flex items-center gap-2 text-xs text-gray-600 dark:text-white/70">
            <Badge variant="secondary" className="text-xs">
              {article.source?.title || 'CoinDesk'}
            </Badge>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(article.published_at))} ago</span>
          </div>

          <h1 className="mb-4 text-2xl font-bold leading-tight text-gray-900 dark:text-white">
            {article.title}
          </h1>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            {fullContent ? (
              <article className="prose prose-sm sm:prose md:prose-base prose-img:rounded-lg prose-p:leading-relaxed dark:prose-invert">
                <div dangerouslySetInnerHTML={{ __html: fullContent }} />
              </article>
            ) : articleDetail?.content ? (
              <article className="prose prose-sm sm:prose md:prose-base prose-img:rounded-lg prose-p:leading-relaxed dark:prose-invert">
                <div dangerouslySetInnerHTML={{ __html: articleDetail.content }} />
              </article>
            ) : article.description ? (
              <div className="bg-black/[0.02] rounded-xl p-4 mb-4 border border-black/[0.03] dark:bg-white/10 dark:border-white/10">
                <p className="text-base text-black/80 dark:text-white/80 leading-relaxed">{article.description}</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Claim section */}
        <div className="px-4 pb-24">
          <div className="mx-auto max-w-[400px]">
            {!isClaimed ? (
              <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm border border-black/10 dark:bg-gray-900 dark:border-gray-800">
                <div className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 shadow-md">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Earn Rewards</h3>
                      <p className="text-sm text-gray-600 dark:text-white/80">
                        {hasReward ? (isTimerActive ? 'Read timer in progress…' : `Read ${articlesRead}/3 articles`) : 'Read to earn on selected articles'}
                      </p>
                    </div>
                  </div>

                  {!eligible && articlesRead < 3 && (
                    <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                      Read {3 - articlesRead} more article{3 - articlesRead > 1 ? 's' : ''} to unlock claim
                    </div>
                  )}
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-white/70">
                      FID: {fid}
                    </div>
                    <Button
                      size="sm"
                      className="h-9 bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700"
                      disabled={!hasReward || isTimerActive || onchainBusy || !eligible || !isConnected}
                      onClick={handleOnchainClaim}
                    >
                      {onchainBusy || txPending ? 'Claiming…' : (!eligible ? 'Not Eligible' : 'Claim')}
                    </Button>
                  </div>

                  {onchainResult && (
                    <div className="mt-3 text-xs text-gray-600 dark:text-white/70">
                      {onchainResult}
                    </div>
                  )}
                </div>
                <div className="h-1.5 w-full bg-gradient-to-r from-green-500 to-green-600" />
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg">
                <div className="px-6 py-5 text-white">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-10 w-10" />
                    <div>
                      <h3 className="text-lg font-semibold">Tokens Claimed!</h3>
                      <p className="text-sm opacity-90">Come back tomorrow for more rewards</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
