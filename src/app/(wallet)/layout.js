"use client";

import dynamic from "next/dynamic";

const WalletProviders = dynamic(
  () => import("@/components/WalletProviders"),
  { ssr: false }
);

export default function WalletLayout({ children }) {
  return <WalletProviders>{children}</WalletProviders>;
}
