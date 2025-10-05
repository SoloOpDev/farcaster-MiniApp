// In development, use relative URLs (proxied by Vite)
// In production, use the full Railway URL
export const API_URL = import.meta.env.MODE === 'development' 
  ? '' 
  : (import.meta.env.VITE_API_URL || 'https://farcaster-miniapp-production.up.railway.app');

export function getApiUrl(path: string) {
  return `${API_URL}${path}`;
}
