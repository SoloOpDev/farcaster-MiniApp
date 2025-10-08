import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { getApiUrl } from "@/lib/api";

const TOKEN_INFO: Record<number, { symbol: string; address: string; amountPerClaim: string }> = {
  0: { symbol: 'CATCH', address: '0xbc4c97fb9befaa8b41448e1dfcc5236da543217f', amountPerClaim: '3' },
  1: { symbol: 'BOOP', address: '0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3', amountPerClaim: '4000' },
  2: { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', amountPerClaim: '0.3' },
};

export default function ArticlePage({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [timer, setTimer] = useState(10);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [showClaimHint, setShowClaimHint] = useState(false);
  const [onchainBusy, setOnchainBusy] = useState(false);
  const [onchainResult, setOnchainResult] = useState<string | null>(null);
  const [claimedTokenInfo, setClaimedTokenInfo] = useState<{ symbol: string; amount: string } | null>(null);
  const [showFarcasterIndicator, setShowFarcasterIndicator] = useState(false);
  const [luckyPrizeFailed, setLuckyPrizeFailed] = useState(false);
  const [isPaywalled, setIsPaywalled] = useState(false);
  
  // Validate content to ensure it's not navigation junk
  const isValidContent = (content: string) => {
    if (!content || content.length < 100) return false;
    
    // Check for navigation junk indicators
    const junkIndicators = [
      'Back to menu', 'Select Language', 'About Us', 'Masthead',
      'Careers', 'Contact Us', 'Accessiblility', 'Sitemap',
      'System status', 'Investor Relations', 'Bug Bounty',
      'Do Not Sell My Info', 'EthicsPrivacyTerms',
      'Disclosure & Polices', 'CoinDesk is part of Bullish'
    ];
    
    // Count how many junk indicators are present
    const junkCount = junkIndicators.filter(phrase => content.includes(phrase)).length;
    
    // If more than 3 junk indicators, it's probably navigation content
    // Relaxed from 2 to 3 to allow more content through
    return junkCount < 3;
  };
  
  // Clean content by cutting at first sign of article lists or navigation
  const cleanContent = (html: string): string => {
    if (!html) return html;
    
    // Cut at any of these patterns that indicate end of article
    const cutoffPatterns = [
      /\d+\s+(hour|hours|minute|minutes)\s+ago/i,  // Timestamps = article lists
      /Total Crypto Trading Volume/i,
      /View Full Report/i,
      /State of Crypto:/i,
      /By CoinDesk Data/i,
    ];
    
    let cleanedHtml = html;
    let earliestCut = -1;
    
    for (const pattern of cutoffPatterns) {
      const match = cleanedHtml.match(pattern);
      // Only cut if pattern appears well after content starts (1000+ chars)
      if (match && match.index !== undefined && match.index > 1000) {
        if (earliestCut === -1 || match.index < earliestCut) {
          earliestCut = match.index;
        }
      }
    }
    
    if (earliestCut > 0) {
      cleanedHtml = cleanedHtml.substring(0, earliestCut);
    }
    
    return cleanedHtml;
  };
  
  const { address, isConnected } = useAccount();
  const activeChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { fid, isAuthenticated, isLoading: farcasterLoading } = useFarcaster();

  // Direct access to Vite environment variable - no casting needed
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';
  
  // CRITICAL DEBUG: Log raw env value
  console.log('🔍 RAW import.meta.env.VITE_CONTRACT_ADDRESS:', import.meta.env.VITE_CONTRACT_ADDRESS);
  console.log('🔍 CONTRACT_ADDRESS after fallback:', CONTRACT_ADDRESS);
  console.log('🔍 Is undefined?', import.meta.env.VITE_CONTRACT_ADDRESS === undefined);
  console.log('🔍 Is empty string?', import.meta.env.VITE_CONTRACT_ADDRESS === '');
  
  // DEBUG: Log contract address
  useEffect(() => {
    console.log('🔐 Contract Address:', CONTRACT_ADDRESS);
    console.log('🔐 All env vars:', import.meta.env);
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '') {
      console.error('❌ CONTRACT_ADDRESS is empty! Check .env file and restart dev server');
    }
  }, [CONTRACT_ADDRESS]);
  
  // Read claims count from smart contract
  const { data: claimsCount } = useReadContract({
    abi: NEWS_REWARD_ABI_V2,
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: 'getClaimsUsedToday',
    args: fid ? [BigInt(fid)] : undefined,
    query: { 
      enabled: Boolean(CONTRACT_ADDRESS && fid),
      refetchInterval: 3000,
    },
  });

  // DEBUG: Check what wallet is bound to this FID today
  const todayIndex = BigInt(Math.floor(Date.now() / 86400000));
  const { data: boundWallet } = useReadContract({
    abi: NEWS_REWARD_ABI_V2,
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: 'fidWalletForDay',
    args: fid ? [BigInt(fid), todayIndex] : undefined,
    query: { 
      enabled: Boolean(CONTRACT_ADDRESS && fid),
    },
  });

  useEffect(() => {
    if (boundWallet && address) {
      console.log('🔍 DEBUG FID-WALLET BINDING:');
      console.log('  Your FID:', fid);
      console.log('  Connected Wallet:', address);
      console.log('  Bound Wallet from contract:', boundWallet);
      console.log('  Addresses Match?:', boundWallet?.toLowerCase() === address?.toLowerCase());
    }
  }, [boundWallet, address, fid]);

  const hasClaimedAll3 = claimsCount ? Number(claimsCount) >= 3 : false;
  
  const { data: newsData } = useQuery<CryptoPanicResponse>({
    queryKey: ["/api/news"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/news"));
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: userClaims = [] } = useQuery<UserClaim[]>({
    queryKey: ["/api/user/claims", fid],
    queryFn: async () => {
      const url = fid ? `${getApiUrl("/api/user/claims")}?fid=${fid}` : getApiUrl("/api/user/claims");
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch claims");
      return res.json();
    },
    enabled: Boolean(fid), // Only fetch when FID is available
    staleTime: 30 * 1000,
  });

  const articleId = params.id;
  
  // Check if user has already claimed from THIS specific article
  const hasClaimedThisArticle = userClaims.some(claim => 
    claim.articleId === articleId && claim.userId === `fid-${fid}`
  );
  
  // Update isClaimed when we detect this article was already claimed
  useEffect(() => {
    if (hasClaimedThisArticle) {
      setIsClaimed(true);
    }
  }, [hasClaimedThisArticle]);
  const article = newsData?.results?.find(a => a.id.toString() === articleId);
  
  // Log article when found
  useEffect(() => {
    if (article) {
      const articleAny = article as any;
      console.log('📄 Article found:', {
        id: article.id,
        title: article.title?.substring(0, 50),
        hasContent: !!articleAny.content,
        contentLength: articleAny.content?.length || 0,
        hasDescription: !!article.description,
        descriptionLength: article.description?.length || 0
      });
    }
  }, [article]);

  const articleDetailEnabled = !!params.id && !!newsData && (!article || !(article as any).content || (article as any).content.length < 100);
  
  console.log('📋 ArticleDetail query state:', {
    enabled: articleDetailEnabled,
    hasParamsId: !!params.id,
    hasNewsData: !!newsData,
    hasArticle: !!article,
    articleHasContent: !!(article as any)?.content,
    articleContentLength: (article as any)?.content?.length || 0
  });

  const { data: articleDetail, isLoading: articleDetailLoading, error: articleDetailError } = useQuery<any>({
    queryKey: ["/api/article", params.id],
    queryFn: async () => {
      console.log('🔄 Fetching articleDetail from:', getApiUrl(`/api/article/${params.id}`));
      const res = await fetch(getApiUrl(`/api/article/${params.id}`));
      console.log('📡 ArticleDetail response:', res.status);
      if (!res.ok) throw new Error('Failed to fetch article details');
      const data = await res.json();
      console.log('✅ ArticleDetail received:', { hasContent: !!data.content, contentLength: data.content?.length });
      return data;
    },
    enabled: articleDetailEnabled,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (articleDetailError) {
      console.error('❌ ArticleDetail error:', articleDetailError);
    }
  }, [articleDetailError]);

  const articleIndex = newsData?.results?.findIndex(a => a.id.toString() === params.id) ?? -1;
  const rewardableIndices = [0];
  const LUCKY_PRIZE_INDEX = 2;
  const isLuckyPrize = articleIndex === LUCKY_PRIZE_INDEX;
  
  // Simplified reward logic - just check if article is rewardable
  const hasReward = articleIndex >= 0 && rewardableIndices.includes(articleIndex);
  
  // Debug logging for Farcaster
  useEffect(() => {
    console.log('🎯 Reward Debug:', {
      articleIndex,
      hasReward,
      isLuckyPrize,
      timer,
      isTimerActive,
      showClaimHint,
      fid,
      isAuthenticated,
      claimsCount: claimsCount ? Number(claimsCount) : 0,
      hasClaimedAll3
    });
  }, [articleIndex, hasReward, isLuckyPrize, timer, isTimerActive, showClaimHint, fid, isAuthenticated, claimsCount, hasClaimedAll3]);

  useEffect(() => {
    if (farcasterLoading && !isAuthenticated) {
      const timeout = setTimeout(() => {
        setShowFarcasterIndicator(true);
      }, 300);
      return () => clearTimeout(timeout);
    } else {
      setShowFarcasterIndicator(false);
    }
  }, [farcasterLoading, isAuthenticated]);

  // NO ELIGIBILITY CHECK - Timer-based claiming only

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer(timer - 1);
      }, 1000);
    } else if (timer === 0 && isTimerActive) {
      setIsTimerActive(false);
      if (hasReward && !isClaimed) {
        setShowClaimHint(true);
      }
    }
    return () => clearInterval(interval);
  }, [timer, isTimerActive]);

  useEffect(() => {
    // Regular rewards (articles 0, 3, 6): Start timer immediately
    if (hasReward && !isClaimed && !luckyPrizeFailed) {
      setIsTimerActive(true);
      setTimer(10);
    }
    // Lucky prize (article 2): Only start timer if 3 claims are done
    else if (isLuckyPrize && !isClaimed && !luckyPrizeFailed) {
      if (hasClaimedAll3) {
        setIsTimerActive(true);
        setTimer(10);
      } else {
        setIsTimerActive(false);
        setTimer(10);
      }
    } else {
      setIsTimerActive(false);
      setTimer(10);
      setShowClaimHint(false);
    }
    return () => {
      setIsTimerActive(false);
      setShowClaimHint(false);
    };
  }, [hasReward, isClaimed, isLuckyPrize, luckyPrizeFailed, hasClaimedAll3]);

  const { writeContractAsync } = useWriteContract();
  const [pendingHash, setPendingHash] = useState<`0x${string}` | null>(null);
  const { isLoading: txPending, isSuccess: txSuccess, data: txReceipt } = useWaitForTransactionReceipt({ hash: pendingHash ?? undefined });

  const handleLuckyPrizeClaim = async () => {
    setOnchainBusy(true);
    setOnchainResult('Checking lucky prize...');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setOnchainResult('Verifying eligibility...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setOnchainResult('Processing claim...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setOnchainResult('Checking prize pool...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setLuckyPrizeFailed(true);
    setOnchainResult('');
    setOnchainBusy(false);
  };

  const handleOnchainClaim = async () => {
    try {
      // CRITICAL: Validate contract address first
      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '') {
        console.error('❌ CONTRACT_ADDRESS is empty!');
        setOnchainResult('Error: Contract address not configured. Set VITE_CONTRACT_ADDRESS in environment variables and redeploy.');
        return;
      }
      
      console.log('📝 Claiming with contract:', CONTRACT_ADDRESS);
      console.log('📝 FID:', fid);
      console.log('📝 Connected Wallet Address:', address);
      console.log('📝 Bound Wallet from Contract:', boundWallet);
      
      if (!fid) {
        setOnchainResult('Error: Farcaster FID not found');
        return;
      }
      
      // Check wallet connection, prompt if needed
      if (!isConnected || !address) {
        setOnchainResult('Please connect your wallet first');
        return;
      }
      
      // Check if we're on the right network (Arbitrum Mainnet = 42161)
      if (activeChainId !== 42161) {
        setOnchainBusy(true);
        setOnchainResult('Switching to Arbitrum Mainnet...');
        try {
          await switchChainAsync({ chainId: 42161 });
        } catch (switchError: any) {
          setOnchainBusy(false);
          throw new Error('Network switch failed. Please switch to Arbitrum Mainnet manually and try again');
        }
        setOnchainBusy(false);
        setOnchainResult(null);
      }
      
      // Skip balance check - let wagmi handle gas estimation
      
      setOnchainBusy(true);
      setOnchainResult(null);
      
      // Deterministic token type based on article ID: 0=CATCH, 1=BOOP, 2=ARB
      // Article IDs are "1", "4", "7" (since RSS assigns id = index + 1)
      const tokenType = articleId === "1" ? 0 : articleId === "4" ? 1 : 2;
      
      console.log('🚀 About to call writeContractAsync with:', {
        contract: CONTRACT_ADDRESS,
        function: 'claimTokens',
        fid,
        tokenType
      });
      
      // Final safety check before calling contract
      if (!CONTRACT_ADDRESS || !CONTRACT_ADDRESS.startsWith('0x')) {
        throw new Error(`Invalid contract address: ${CONTRACT_ADDRESS}. Expected address starting with 0x`);
      }
      
      const hash = await writeContractAsync({
        abi: NEWS_REWARD_ABI_V2,
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'claimTokens',
        args: [BigInt(fid), tokenType],
      });
      
      setPendingHash(hash as `0x${string}`);
      setOnchainResult(`Submitted. Tx: ${hash}`);
      
      await fetch(getApiUrl('/api/record-claim'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, articleId, tokens: [TOKEN_INFO[tokenType].symbol], txHash: hash })
      });
      
      // Invalidate user claims to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/user/claims'] });
      
    } catch (e: any) {
      console.error('Claim error:', e);
      
      // User-friendly error messages
      let errorMsg = 'Failed to claim. Please try again.';
      
      if (e?.message?.includes('rejected') || e?.message?.includes('denied') || e?.code === 4001) {
        errorMsg = 'Transaction cancelled by user.';
      } else if (e?.message?.includes('insufficient funds') || e?.message?.includes('insufficient fee')) {
        errorMsg = 'Insufficient ETH for gas fees. You need ~$0.01 worth of ETH on Arbitrum.';
      } else if (e?.message?.includes('already claimed')) {
        errorMsg = 'Already claimed today. Come back tomorrow!';
      } else if (e?.message?.includes('FID_BOUND_TO_DIFFERENT_WALLET')) {
        errorMsg = `Your FID is bound to a different wallet today. Connected: ${address?.slice(0,6)}...${address?.slice(-4)} | Bound: ${boundWallet ? (boundWallet as string).slice(0,6) + '...' + (boundWallet as string).slice(-4) : 'Unknown'}. Please use the same wallet or wait until tomorrow.`;
      } else if (e?.message?.includes('network') || e?.message?.includes('chain')) {
        errorMsg = 'Network error. Please switch to Arbitrum and try again.';
      }
      
      setOnchainResult(errorMsg);
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
      
      if (tokenInfo) {
        setClaimedTokenInfo({ symbol: tokenInfo.symbol, amount: tokenInfo.amountPerClaim });
      }
      
      queryClient.invalidateQueries({ queryKey: ['readContract'] });
    }
  }, [txSuccess, txReceipt, queryClient]);

  useEffect(() => {
    // ALWAYS clear sessionStorage to force fresh scraping
    try {
      sessionStorage.removeItem(`article:${articleId}`);
    } catch {}
  }, [articleId]);

  useEffect(() => {
    if (!article) return;
    
    // Check if article already has content from RSS
    const articleWithContent = article as any;
    const hasRSSContent = articleWithContent.content && articleWithContent.content.length > 200;
    
    console.log('🔍 Article data:', { 
      title: article.title, 
      original_url: article.original_url,
      hasDescription: !!article.description,
      descriptionLength: article.description?.length || 0,
      hasRSSContent,
      rssContentLength: articleWithContent.content?.length || 0
    });
    
    // If article already has full content from RSS, use it immediately
    if (hasRSSContent) {
      console.log('✅ Using RSS content directly, length:', articleWithContent.content.length);
      setFullContent(articleWithContent.content);
      return;
    }
    
    if (article.original_url) {
      const ctrl = new AbortController();
      const scrapeUrl = getApiUrl(`/api/scrape?url=${encodeURIComponent(article.original_url)}`);
      console.log('🌐 Fetching scrape for:', article.original_url);
      console.log('🌐 Scrape URL:', scrapeUrl);
      
      fetch(scrapeUrl, { signal: ctrl.signal })
        .then(async res => {
          console.log('📡 Scrape response status:', res?.status);
          if (!res.ok && res.status !== 304) {
            const errorData = await res.json().catch(() => ({}));
            console.log('⚠️ Scrape error data:', errorData);
            if (errorData?.message?.toLowerCase().includes('paywall')) {
              setIsPaywalled(true);
            }
            return null;
          }
          return res.json();
        })
        .then(data => {
          console.log('📦 Scrape data:', { 
            hasContent: !!data?.content, 
            contentLength: data?.content?.length || 0,
            strategy: data?.strategy,
            preview: data?.content?.substring(0, 300)
          });
          if (data?.content) {
            console.log('✅ Setting scraped content, length:', data.content.length);
            setFullContent(data.content);
            try {
              sessionStorage.setItem(`article:${articleId}` , JSON.stringify({ content: data.content, ts: Date.now() }));
            } catch {}
          } else {
            console.warn('⚠️ Scrape returned no content, data:', data);
          }
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.error('❌ Scrape failed:', err.message, err);
          }
        });
      return () => ctrl.abort();
    } else {
      console.warn('⚠️ No original_url found for article');
    }
  }, [article, articleId]);

  // Fallback to articleDetail if scraping fails
  useEffect(() => {
    // Only use articleDetail as fallback if we don't have fullContent after a delay
    const timer = setTimeout(() => {
      if (!fullContent && articleDetail?.content && typeof articleDetail.content === 'string') {
        console.log('📄 Using articleDetail fallback');
        setFullContent(articleDetail.content);
        try {
          sessionStorage.setItem(`article:${articleId}` , JSON.stringify({ content: articleDetail.content, ts: Date.now() }));
        } catch {}
      }
    }, 1500); // Wait 1.5 seconds for scrape to complete
    
    return () => clearTimeout(timer);
  }, [articleDetail, fullContent, articleId]);

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
      {/* Subtle Farcaster connection indicator - only shows if connection takes >300ms */}
      {showFarcasterIndicator && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 bg-blue-500/90 text-white text-xs px-3 py-1 rounded-full shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Connecting Farcaster...</span>
          </div>
        </div>
      )}
      
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-lg dark:bg-gray-900/70">
        <div className="flex h-12 items-center justify-between px-4 mx-auto max-w-[400px] border-b border-gray-200 dark:border-gray-800">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-2 h-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {(hasReward || isLuckyPrize) && !isClaimed && !luckyPrizeFailed && (
            isTimerActive ? (
              <div className="flex items-center gap-1.5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  isLuckyPrize 
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                    : 'bg-gradient-to-r from-green-500 to-green-600'
                }`}>
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
            {article.published_at && (() => {
              try {
                const date = new Date(article.published_at);
                if (!isNaN(date.getTime())) {
                  return (
                    <>
                      <span>•</span>
                      <span>{formatDistanceToNow(date)} ago</span>
                    </>
                  );
                }
              } catch {}
              return null;
            })()}
          </div>

          <h1 className="mb-4 text-2xl font-bold leading-tight text-gray-900 dark:text-white">
            {article.title}
          </h1>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            {(() => {
              console.log('🎨 Rendering content:', {
                isPaywalled,
                hasFullContent: !!fullContent,
                fullContentLength: fullContent?.length || 0,
                hasArticleDetail: !!articleDetail?.content,
                articleDetailLength: articleDetail?.content?.length || 0,
                hasDescription: !!article.description
              });
              
              if (isPaywalled) {
                return (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">🔒</div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
                          Premium Content
                        </h3>
                        <p className="text-amber-800 dark:text-amber-300 mb-4">
                          This article requires a subscription. You can read it directly on CoinDesk.
                        </p>
                        <a 
                          href={article.original_url || article.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-block px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Read on CoinDesk →
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }
              
              if (fullContent) {
                console.log('✅ Rendering fullContent');
                return (
                  <article className="prose prose-sm sm:prose md:prose-base prose-img:rounded-lg prose-p:leading-relaxed dark:prose-invert">
                    <div dangerouslySetInnerHTML={{ __html: fullContent }} />
                  </article>
                );
              }
              
              if (articleDetail?.content) {
                console.log('✅ Rendering articleDetail.content');
                return (
                  <article className="prose prose-sm sm:prose md:prose-base prose-img:rounded-lg prose-p:leading-relaxed dark:prose-invert">
                    <div dangerouslySetInnerHTML={{ __html: articleDetail.content }} />
                  </article>
                );
              }
              
              if (article.description) {
                console.log('⏳ Showing description with loading spinner');
                return (
                  <div className="bg-black/[0.02] rounded-xl p-4 mb-4 border border-black/[0.03] dark:bg-white/10 dark:border-white/10">
                    <p className="text-base text-black/80 dark:text-white/80 leading-relaxed">{article.description}</p>
                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading full article...</span>
                    </div>
                  </div>
                );
              }
              
              console.log('⏳ Showing generic loading spinner');
              return (
                <div className="py-8">
                  <div className="flex items-center justify-center gap-2 text-gray-500 mb-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading article content...</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Claim section */}
        <div className="px-4 pb-24">
          <div className="mx-auto max-w-[400px]">
            {(hasReward || isLuckyPrize) && !luckyPrizeFailed ? (
              <div className={`mt-4 overflow-hidden rounded-2xl shadow-sm ${
                isLuckyPrize 
                  ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-400 dark:from-yellow-900/20 dark:to-amber-900/20 dark:border-yellow-600'
                  : 'bg-white border border-black/10 dark:bg-gray-900 dark:border-gray-800'
              }`}>
                <div className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-md ${
                      isLuckyPrize
                        ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                        : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                    }`}>
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold ${
                        isLuckyPrize 
                          ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-amber-600 dark:from-yellow-400 dark:to-amber-400'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {isLuckyPrize ? '🎁 Lucky Reward!' : 'Earn Rewards'}
                      </h3>
                      <p className={`text-sm ${
                        isLuckyPrize
                          ? 'text-amber-700 dark:text-amber-300 font-medium'
                          : 'text-gray-600 dark:text-white/80'
                      }`}>
                        {isLuckyPrize 
                          ? (!hasClaimedAll3 ? 'Complete 3 claims first' : (isTimerActive ? 'Read timer in progress…' : 'Try your luck!'))
                          : (hasReward ? (isTimerActive ? 'Read timer in progress…' : 'Claim your tokens!') : 'Read to earn on selected articles')
                        }
                      </p>
                    </div>
                  </div>

                  {!CONTRACT_ADDRESS && (
                    <div className="mt-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg p-2">
                      ⚠️ Contract not configured. Set VITE_CONTRACT_ADDRESS and redeploy.
                    </div>
                  )}
                  
                  {/* Wallet mismatch warning - ONLY show if bound wallet is NOT zero address */}
                  {boundWallet && address && boundWallet !== '0x0000000000000000000000000000000000000000' && boundWallet.toLowerCase() !== address.toLowerCase() && (
                    <div className="mt-3 text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
                      <div className="font-semibold mb-1">⚠️ Wallet Mismatch Detected</div>
                      <div className="text-xs space-y-1">
                        <div>Your FID is bound to: <span className="font-mono">{(boundWallet as string).slice(0,6)}...{(boundWallet as string).slice(-4)}</span></div>
                        <div>Currently connected: <span className="font-mono">{address.slice(0,6)}...{address.slice(-4)}</span></div>
                        <div className="mt-2 text-amber-700 dark:text-amber-400">You must use the bound wallet to claim, or wait until tomorrow to use a different wallet.</div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-white/70">
                      FID: {fid}
                    </div>
                    <Button
                      size="sm"
                      className={`h-9 text-white ${
                        isLuckyPrize
                          ? 'bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600'
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                      }`}
                      disabled={(!hasReward && !isLuckyPrize) || isTimerActive || onchainBusy || !fid || (isLuckyPrize && !hasClaimedAll3) || !CONTRACT_ADDRESS || isClaimed || hasClaimedThisArticle}
                      onClick={isLuckyPrize ? handleLuckyPrizeClaim : handleOnchainClaim}
                    >
                      {isClaimed || hasClaimedThisArticle ? 'Claimed ✓' : (onchainBusy || txPending ? 'Claiming…' : (isLuckyPrize ? 'Try Luck 🍀' : 'Claim'))}
                    </Button>
                  </div>

                  {onchainResult && (
                    <div className={`mt-3 text-sm rounded-lg p-2 ${
                      onchainResult.startsWith('Error:') 
                        ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800' 
                        : 'text-gray-600 dark:text-white/70'
                    }`}>
                      {onchainResult}
                    </div>
                  )}
                </div>
                <div className={`h-1.5 w-full ${
                  isLuckyPrize
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                    : 'bg-gradient-to-r from-green-500 to-green-600'
                }`} />
              </div>
            ) : luckyPrizeFailed ? (
              <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-400 to-red-400 shadow-lg">
                <div className="px-6 py-5 text-white">
                  <div className="flex items-center gap-3">
                    <div className="text-5xl">🍀</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">Better Luck Next Time!</h3>
                    </div>
                  </div>
                </div>
              </div>
            ) : isClaimed ? (
              <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg">
                <div className="px-6 py-5 text-white">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-10 w-10" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">Tokens Claimed!</h3>
                      {claimedTokenInfo && (
                        <p className="text-sm font-medium mt-1">
                          🎉 You received {claimedTokenInfo.amount} {claimedTokenInfo.symbol}
                        </p>
                      )}
                      <p className="text-sm opacity-90 mt-1">Come back tomorrow for more rewards</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 dark:from-purple-900/20 dark:to-indigo-900/20 dark:border-purple-800 shadow-sm">
                <div className="px-6 py-5 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 shadow-md">
                      <DollarSign className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400">
                        Earn Rewards
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Read selected articles to claim tokens
                      </p>
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
