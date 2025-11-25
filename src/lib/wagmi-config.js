"use client";

import { http, createConfig } from "wagmi";
import { mainnet, polygon, optimism, arbitrum, base } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
  },
});

export const rainbowKitConfig = getDefaultConfig({
  appName: "WalletBase",
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  chains: [mainnet, polygon, optimism, arbitrum, base],
  ssr: true,
});
