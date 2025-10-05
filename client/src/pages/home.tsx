import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Sparkles, Gift } from "lucide-react";
import type { CryptoPanicResponse, UserClaim } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useReadContract } from "wagmi";
import { NEWS_REWARD_ABI_V2 } from "@/lib/abi-v2";
import { useFarcaster } from "@/lib/farcaster";
import { getApiUrl } from "@/lib/api";

const getRewardIndices = () => {
  return [0, 3, 6];
};

const LUCKY_PRIZE_INDEX = 2;
const TEST_MODE = true;

export default function Home() {
  const [, setLocation] = useLocation();
  const { fid } = useFarcaster();
  const { data: userClaims = [] } = useQuery<UserClaim[]>({
    queryKey: ["/api/user/claims", fid],
    queryFn: async () => {
      const url = fid ? `${getApiUrl("/api/user/claims")}?fid=${fid}` : getApiUrl("/api/user/claims");
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch claims");
      return res.json();
    },
    enabled: Boolean(fid), // Only fetch when FID is available
  });

  const { data: newsData, isLoading, error } = useQuery<CryptoPanicResponse>({
    queryKey: ["/api/news"],
    queryFn: async () => {
      console.log('🔄 Fetching news from:', getApiUrl("/api/news"));
      const res = await fetch(getApiUrl("/api/news"));
      console.log('📡 News fetch response:', res.status, res.statusText);
      if (!res.ok) throw new Error("Failed to fetch news");
      const data = await res.json();
      console.log('✅ News data received:', data.results?.length, 'articles');
      
      // Log first article to verify content is present
      if (data.results?.[0]) {
        const firstArticle = data.results[0] as any;
        console.log('📰 First article structure:', {
          id: firstArticle.id,
          title: firstArticle.title?.substring(0, 50),
          hasContent: !!firstArticle.content,
          contentLength: firstArticle.content?.length || 0,
          hasDescription: !!firstArticle.description
        });
      }
      
      return data;
    },
  });

  useEffect(() => {
    if (error) {
      console.error('❌ News fetch error:', error);
    }
  }, [error]);

  // Direct access to Vite environment variable
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

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

  const hasClaimedAll3 = claimsCount ? Number(claimsCount) >= 3 : false;
  const rewardIndices = useMemo(getRewardIndices, []);
  
  useEffect(() => {
    console.log('🎁 Lucky Prize Debug:', {
      fid,
      claimsCount: claimsCount ? Number(claimsCount) : 'undefined',
      hasClaimedAll3,
      CONTRACT_ADDRESS,
      luckyPrizeIndex: LUCKY_PRIZE_INDEX
    });
  }, [fid, claimsCount, hasClaimedAll3, CONTRACT_ADDRESS]);

  useEffect(() => {
    if (!newsData?.results?.length) return;
    const rewardableArticles = newsData.results.filter((_, idx) => rewardIndices.includes(idx));
    rewardableArticles.forEach((a) => {
      queryClient
        .prefetchQuery({
          queryKey: ["/api/article", String(a.id)],
          queryFn: async () => {
            const res = await fetch(getApiUrl(`/api/article/${String(a.id)}`));
            if (!res.ok) throw new Error("Failed to prefetch article details");
            return res.json();
          },
          staleTime: 5 * 60 * 1000,
        })
        .catch(() => {});
    });
  }, [newsData, rewardIndices]);

  if (isLoading) {
    return (
      <div className="min-h-full">
        <div className="divide-y">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="h-16 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!newsData) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <div className="text-center py-12">
          <p className="text-muted-foreground">No news available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full max-w-3xl mx-auto">
      <div className="space-y-4 p-4 pt-0">
        {[...Array(Math.max(10, newsData.results.length))].map((_, i) => {
          const article = newsData.results[i % newsData.results.length];
          const isLuckyPrize = i === LUCKY_PRIZE_INDEX && (TEST_MODE || hasClaimedAll3);

          const prefetchArticle = () => {
            queryClient
              .prefetchQuery({
                queryKey: ["/api/article", String(article.id)],
                queryFn: async () => {
                  const res = await fetch(getApiUrl(`/api/article/${String(article.id)}`));
                  if (!res.ok) throw new Error("Failed to prefetch article details");
                  return res.json();
                },
                staleTime: 5 * 60 * 1000,
              })
              .catch(() => {});
          };

          const isRewardable = rewardIndices.includes(i);

          return (
            <Card
              key={article.id}
              className={`relative group cursor-pointer backdrop-blur-sm transition-all duration-300 rounded-2xl hover:-translate-y-1 ${
                isLuckyPrize
                  ? 'bg-white/80 border-[3px] border-yellow-500 hover:border-yellow-600 shadow-[0_0_25px_rgba(251,191,36,0.5)] hover:shadow-[0_0_35px_rgba(251,191,36,0.7)] dark:bg-black dark:border-yellow-500'
                  : 'bg-white/80 border border-black/[0.2] hover:border-black/[0.35] hover:bg-white/95 dark:bg-black dark:border-gray-800 dark:hover:border-gray-700 shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)]'
              }`}
              onMouseEnter={prefetchArticle}
              onMouseDown={prefetchArticle}
              onTouchStart={prefetchArticle}
              onClick={() => setLocation(`/article/${article.id}`)}
            >
              {isLuckyPrize && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full px-3 py-1.5 shadow-md">
                  <Gift className="h-4 w-4 text-white" />
                  <span className="text-xs font-bold text-white whitespace-nowrap">LUCKY REWARD</span>
                  <span className="text-sm">🏆</span>
                </div>
              )}
              <div className="flex gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-black/5 text-black/70 font-medium text-xs dark:bg-white/10 dark:text-white/80">
                        {article.source && article.source.title ? article.source.title : ""}
                      </Badge>
                    </div>
                    <span className="text-xs text-black/40 dark:text-white/40">
                      {article.published_at && !isNaN(new Date(article.published_at).getTime())
                        ? formatDistanceToNow(new Date(article.published_at), {
                            addSuffix: true,
                          })
                        : ""}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                    {article.title}
                  </h3>
                  
                  <p className="text-sm text-black/70 dark:text-white/80">
                    {article.description}
                  </p>
                </div>

                <div className="flex flex-none items-center gap-3 relative">
                  {isRewardable && !isLuckyPrize && (
                    <div className="absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-green-600 shadow-sm">
                      <DollarSign className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  {article.image && (
                    <div className="relative w-24 h-24 overflow-hidden rounded-lg">
                      <img
                        src={article.image}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
