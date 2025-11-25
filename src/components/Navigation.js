"use client";

import { useUser } from "../contexts/UserContext";
import styles from "./Navigation.module.css";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export default function Navigation() {
  const { userId, walletAddress } = useUser();

  return (
    <header className={styles.header}>
      <div className={styles.navLeft}>
        <Link href="/" className={styles.navLink}>
          <div className={styles.logo}>WalletBase</div>
        </Link>
        <nav className={styles.nav}>
          <Link href="/market" className={styles.navLink}>
            Market
          </Link>
          {/* <Link href="/orders" className={styles.navLink}>
            Orders
          </Link> */}
          <Link href="/ai-trading" className={styles.navLink}>
            AI Trading
          </Link>
          <Link href="/settings" className={styles.navLink}>
            Settings
          </Link>
        </nav>
      </div>

      <div className={styles.navRight}>
        <ConnectButton />
      </div>
    </header>
  );
}
