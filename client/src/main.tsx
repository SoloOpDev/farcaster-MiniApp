import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "./lib/wagmi";
import { FarcasterProvider } from "./lib/farcaster";

console.log('🚀 App initializing...');

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error('❌ Root element not found!');
  throw new Error('Root element not found');
}

console.log('✅ Root element found, rendering app...');

try {
  createRoot(rootElement).render(
    <WagmiProvider config={wagmiConfig}>
      <FarcasterProvider>
        <App />
      </FarcasterProvider>
    </WagmiProvider>
  );
  console.log('✅ App rendered successfully');
} catch (error) {
  console.error('❌ Failed to render app:', error);
  throw error;
}
