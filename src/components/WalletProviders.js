"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { rainbowKitConfig } from "@/lib/wagmi-config";
import { UserProvider } from "@/contexts/UserContext";

export default function WalletProviders({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={rainbowKitConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme()}>
          <UserProvider>{children}</UserProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
