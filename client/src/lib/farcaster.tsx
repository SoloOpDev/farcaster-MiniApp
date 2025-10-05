import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import sdk from '@farcaster/frame-sdk';

interface FarcasterContextType {
  fid: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const FarcasterContext = createContext<FarcasterContextType>({
  fid: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
});

export const useFarcaster = () => useContext(FarcasterContext);

interface FarcasterProviderProps {
  children: ReactNode;
}

export const FarcasterProvider: React.FC<FarcasterProviderProps> = ({ children }) => {
  const [fid, setFid] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initFarcaster = async () => {
      try {
        // Initialize Farcaster SDK
        await sdk.actions.ready();
        
        // Get user context (it's a Promise)
        const context = await sdk.context;
        
        if (context?.user?.fid) {
          // Real Farcaster FID from SDK
          setFid(context.user.fid);
          setIsAuthenticated(true);
          console.log('✅ Farcaster FID retrieved:', context.user.fid);
          console.log('👤 User:', context.user.username || 'Unknown');
        } else {
          // Fallback to mock FID for development
          const mockFid = 12345;
          setFid(mockFid);
          setIsAuthenticated(true);
          console.log('⚠️ Using mock FID for development:', mockFid);
        }
      } catch (err) {
        // Error - fallback to mock FID for local development
        const mockFid = 12345;
        setFid(mockFid);
        setIsAuthenticated(true);
        setError(err instanceof Error ? err.message : 'Failed to initialize Farcaster SDK');
        console.error('Farcaster SDK error:', err);
        console.log('⚠️ Using mock FID due to error:', mockFid);
      } finally {
        setIsLoading(false);
      }
    };

    initFarcaster();
  }, []);

  return (
    <FarcasterContext.Provider value={{ fid, isAuthenticated, isLoading, error }}>
      {children}
    </FarcasterContext.Provider>
  );
};
