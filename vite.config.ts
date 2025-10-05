import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async ({ mode }) => ({
  // Inject environment variables explicitly for Railway
  define: {
    'import.meta.env.VITE_CONTRACT_ADDRESS': JSON.stringify(process.env.VITE_CONTRACT_ADDRESS || ''),
    'import.meta.env.VITE_CATCH_TOKEN': JSON.stringify(process.env.VITE_CATCH_TOKEN || ''),
    'import.meta.env.VITE_BOOP_TOKEN': JSON.stringify(process.env.VITE_BOOP_TOKEN || ''),
    'import.meta.env.VITE_ARB_TOKEN': JSON.stringify(process.env.VITE_ARB_TOKEN || ''),
    'import.meta.env.VITE_CHAIN_ID': JSON.stringify(process.env.VITE_CHAIN_ID || '42161'),
    'import.meta.env.VITE_RPC_URL': JSON.stringify(process.env.VITE_RPC_URL || 'https://arb1.arbitrum.io/rpc'),
  },
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
}));
