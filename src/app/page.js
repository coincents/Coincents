"use client";

import styles from "../styles/Landing.module.css";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useUser } from "../contexts/UserContext";
import { generateUserIdFromAddress } from "@/lib/user-id";

export default function LandingPage() {
  const { address: rkAddress, isConnected } = useAccount();
  const { userId, walletAddress, updateUser, clearUser } = useUser();

  useEffect(() => {
    const sync = async () => {
      if (!isConnected || !rkAddress) return;
      const newUserId = generateUserIdFromAddress(rkAddress);
      updateUser(newUserId, rkAddress);
      try {
        await fetch("/api/auth/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: rkAddress }),
        });
      } catch (e) {
        console.warn("Wallet upsert failed", e);
      }
    };
    sync();
  }, [isConnected, rkAddress]);

  // Wallet Gate - Show only connection screen if no wallet is connected
  if (!walletAddress && !isConnected) {
    return (
      <main className={styles.container}>
        <div className={styles.walletGate}>
          <div className={styles.walletGateContent}>
            <div className={styles.walletGateLogo}>
              <div className={styles.logo}>WalletBase</div>
            </div>

            <div className={styles.walletGateTitle}>
              <h1>Welcome to WalletBase</h1>
              <p>
                Connect your wallet to access the decentralized trading platform
              </p>
            </div>

            <div className={styles.walletGateFeatures}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🔐</div>
                <div className={styles.featureText}>
                  <h3>Secure Wallet Connection</h3>
                  <p>
                    Connect with any Web3 wallet for secure, decentralized
                    access
                  </p>
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>📊</div>
                <div className={styles.featureText}>
                  <h3>Live Market Data</h3>
                  <p>Real-time cryptocurrency prices and market analysis</p>
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🤖</div>
                <div className={styles.featureText}>
                  <h3>AI Trading</h3>
                  <p>Intelligent trading strategies powered by AI</p>
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>💎</div>
                <div className={styles.featureText}>
                  <h3>Multi-Chain Support</h3>
                  <p>Trade ETH, BTC, and other cryptocurrencies</p>
                </div>
              </div>
            </div>

            <div className={styles.walletGateConnect}>
              <div className={styles.walletGateButton}>
                <ConnectButton />
              </div>

              <div className={styles.walletGateInfo}>
                <p>
                  Don't have a wallet?{" "}
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download MetaMask
                  </a>
                </p>
                <p>
                  By connecting, you agree to our Terms of Service and Privacy
                  Policy
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Connected: show redirect CTA to portfolio
  if (walletAddress && isConnected) {
    return (
      <main className={styles.container}>
        <div className={styles.quickActions}>
          <a href="/portfolio" className={styles.quickActionButton}>
            Go to Portfolio
          </a>
        </div>
      </main>
    );
  }
}
