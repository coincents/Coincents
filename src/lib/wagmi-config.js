import { mainnet, polygon, optimism, arbitrum, base } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const rainbowKitConfig = getDefaultConfig({
  appName: "WalletBase",
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  chains: [mainnet, polygon, optimism, arbitrum, base],
  ssr: true,
});
