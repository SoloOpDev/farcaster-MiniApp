import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useAccount, useReadContract, useConnect, useSwitchChain, useChainId } from "wagmi";
import { NEWS_REWARD_ABI_V2 } from "@/lib/abi-v2";
import { useFarcaster } from "@/lib/farcaster";

export function Layout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [claimsUsed, setClaimsUsed] = useState<number>(0);
  const { address, isConnected } = useAccount();
  const { connect, connectors, status: connectStatus } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const activeChainId = useChainId();
  const { fid } = useFarcaster();
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';
  const REQUIRED_CHAIN_ID = 42161;

  const addAndSwitchChain = async () => {
    const eth: any = (window as any)?.ethereum;
    if (!eth?.request) return;
    
    try {
      await eth.request({ 
        method: 'wallet_switchEthereumChain', 
        params: [{ chainId: '0xa4b1' }] 
      });
      return;
    } catch (switchError: any) {
      if (switchError.code === 4902 || switchError.code === -32603) {
        try {
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
        } catch {}
      }
    }
    
    try { 
      await switchChainAsync({ chainId: 42161 }); 
    } catch {}
  };

  const { data: claimsCount, refetch: refetchClaims } = useReadContract({
    abi: NEWS_REWARD_ABI_V2,
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: 'getClaimsUsedToday',
    args: fid ? [BigInt(fid)] : undefined,
    query: { 
      enabled: Boolean(CONTRACT_ADDRESS && fid),
      refetchInterval: 3000,
    },
  });

  useEffect(() => {
    if (typeof claimsCount === 'number') setClaimsUsed(claimsCount);
    else if (claimsCount != null) setClaimsUsed(Number(claimsCount));
    console.log('💰 Claims count:', claimsCount, 'claimsUsed:', claimsUsed);
  }, [claimsCount, claimsUsed]);

  useEffect(() => {
    if (!isConnected && fid && connectors.length > 0) {
      const farcasterConnector = connectors[0];
      if (farcasterConnector) {
        connect({ connector: farcasterConnector });
      }
    }
  }, [isConnected, fid, connectors, connect]);

  useEffect(() => {
    if (isConnected && activeChainId && activeChainId !== 42161) {
      addAndSwitchChain();
    }
  }, [isConnected, activeChainId]);

  type UserProfile = {
    id: string;
    username: string;
    tokenBalance: number;
  };

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
  });

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-200/50 bg-white/70 backdrop-blur-lg dark:bg-gray-900 dark:border-gray-800">
        <div className="flex h-8 items-center px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="p-0 text-lg font-bold hover:bg-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
              onClick={() => setLocation("/")}
            >
              EarnReads$
            </Button>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-3 py-1 text-xs font-medium text-purple-700">
              Learn & Earn
            </span>
            {/* Network switch button (only show if on wrong network) */}
            {isConnected && activeChainId !== REQUIRED_CHAIN_ID && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={addAndSwitchChain}
              >
                Switch to Arbitrum
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content (constrained to Farcaster mini app width) */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[420px]">
          {children}
        </div>
      </main>

      {/* Bottom nav */}
      <div className="sticky bottom-0 left-0 right-0 z-50 border-t border-gray-200/50 bg-white/70 backdrop-blur-lg dark:bg-gray-900 dark:border-gray-800">
        <div className="flex h-14 items-center px-4 mx-auto max-w-screen-xl">
          <div className="mx-auto flex w-full max-w-[800px] items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                <span className="font-bold text-purple-700">{Math.min(claimsUsed, 1)}/1</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Articles Claimed Today To Unlock A Lucky Reward 🎁 🏆
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
