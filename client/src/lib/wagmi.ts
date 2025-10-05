import { http, createConfig } from 'wagmi'
import { arbitrum } from 'wagmi/chains'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

export const wagmiConfig = createConfig({
  chains: [arbitrum],
  connectors: [
    farcasterMiniApp()
  ],
  transports: {
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
  },
})
