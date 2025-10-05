import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { DollarSign, Coins, CheckCircle, Clock, ArrowLeft, Loader2 } from "lucide-react";
import type { CryptoPanicResponse } from "@shared/schema";

export default function Article({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [timer, setTimer] = useState(10);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);

  // Fetch article data
  const { data: article, isLoading } = useQuery({
    queryKey: ["/api/article", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/article/${params.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch article");
      }
      return response.json();
    },
  });

  // Check if article is rewardable
  const { data: newsData } = useQuery<CryptoPanicResponse>({
    queryKey: ["/api/news"],
  });

  const { data: userClaims = [] } = useQuery({
    queryKey: ["/api/user/claims"],
  });

  const hasReward = newsData?.results?.some(
    a => a.id.toString() === params.id && 
    !userClaims.some((claim: { articleId: string }) => claim.articleId === params.id)
  );

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer(timer - 1);
      }, 1000);
    } else if (timer === 0 && isTimerActive) {
      setIsTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timer, isTimerActive]);

  // Start timer when article loads
  useEffect(() => {
    if (article && hasReward && !isClaimed) {
      setIsTimerActive(true);
    }
  }, [article, hasReward, isClaimed]);

  const handleClaimReward = async () => {
    try {
      const response = await fetch("/api/user/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          articleId: params.id,
          tokensEarned: 0.5 
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to claim tokens");
      }
      
      const data = await response.json();
      toast({
        title: "Tokens Claimed!",
        description: `You earned ${data.claim.tokensEarned} ARB tokens`,
      });
      
      setIsClaimed(true);
    } catch (error) {
      toast({
        title: "Claim Failed",
        description: error instanceof Error ? error.message : "Failed to claim tokens",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => setLocation("/")} className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to News
          </Button>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => setLocation("/")} className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to News
          </Button>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Article not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => setLocation("/")} className="mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to News
        </Button>

        <article className="prose prose-sm dark:prose-invert max-w-none">
          <h1 className="text-2xl font-bold mb-4">{article.title}</h1>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
            <span>{article.sourceTitle}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}</span>
          </div>

          {article.image && (
            <img
              src={article.image}
              alt={article.title}
              className="w-full aspect-video object-cover rounded-lg mb-6"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}

          <div className="text-foreground space-y-4 mb-8">
            {article.content.split('\n').map((paragraph: string, index: number) => (
              paragraph.trim() ? (
                <p key={index} className="text-base leading-relaxed">
                  {paragraph}
                </p>
              ) : (
                <div key={index} className="h-4" />
              )
            ))}
          </div>

          {hasReward && !isClaimed && (
            <div className="bg-card border border-border rounded-lg p-6 mt-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">Earn 0.5 ARB Tokens</p>
                    <p className="text-sm text-muted-foreground">Read for 10 seconds to claim</p>
                  </div>
                </div>

                {isTimerActive && timer > 0 ? (
                  <div className="flex items-center space-x-2 text-primary">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">{timer}s</span>
                  </div>
                ) : !isTimerActive && timer === 0 ? (
                  <Button
                    onClick={handleClaimReward}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    Claim Reward
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {isClaimed && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-8">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-600">Reward claimed successfully!</p>
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
