"use client";

import styles from "./ai-trading.module.css";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { authClient } from "@/lib/auth-client";
import { useAccount, useDisconnect, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ethers } from "ethers";
import { fetchBTCBalance, isValidBTCAddress } from "@/lib/bitcoin";

export default function AITradingPage() {
  const { userId, walletAddress, backendUser, clearUser } = useUser();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [balances, setBalances] = useState({
    ETH: "0.0000",
    BTC: "0.00000000",
  });
  const [usdBalances, setUsdBalances] = useState({
    ETH: 0,
    BTC: 0,
    total: 0,
  });
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
  const [authUser, setAuthUser] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await authClient.getSession();
        if (data?.user) {
          setAuthUser(data.user);
        }
      } catch (error) {
        // No active session
      }
    };
    checkSession();
  }, []);
  const [livePrices, setLivePrices] = useState({
    BTC: null,
    ETH: null,
    SOL: null,
  });
  const [aiPredictions, setAiPredictions] = useState([]);
  const [tradingStrategies, setTradingStrategies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [strategyConfig, setStrategyConfig] = useState({
    name: "",
    riskLevel: "medium",
    investmentAmount: "",
    targetProfit: "",
    stopLoss: "",
  });

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Fetch live prices from Binance API
  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
        const promises = symbols.map((s) =>
          fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`)
            .then((r) => r.json())
            .catch(() => null)
        );
        const results = await Promise.all(promises);
        const newPrices = {};
        results.forEach((r, i) => {
          if (r && r.price) {
            const sym = symbols[i].replace("USDT", "");
            newPrices[sym] = parseFloat(r.price);
          }
        });
        if (Object.keys(newPrices).length > 0) {
          setLivePrices((prev) => ({ ...prev, ...newPrices }));
          setLastPriceUpdate(new Date());
        }
      } catch (e) {
        console.warn("Failed to fetch live prices:", e);
      }
    };

    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Generate AI predictions based on live prices
  useEffect(() => {
    if (!livePrices.BTC && !livePrices.ETH && !livePrices.SOL) return;

    // Demo AI predictions - use live prices for current, generate plausible predictions
    const generatePrediction = (symbol, name, currentPrice, direction, confidence, reasoning) => {
      const multiplier = direction === "up" ? 1 + (Math.random() * 0.05 + 0.02) : 1 - (Math.random() * 0.03 + 0.01);
      return {
        id: symbol,
        symbol,
        name,
        currentPrice: currentPrice || 0,
        predictedPrice: currentPrice ? currentPrice * multiplier : 0,
        confidence,
        timeframe: "24h",
        direction,
        reasoning,
      };
    };

    const predictions = [
      generatePrediction(
        "BTC",
        "Bitcoin",
        livePrices.BTC,
        "up",
        85,
        "Strong technical indicators and institutional buying pressure"
      ),
      generatePrediction(
        "ETH",
        "Ethereum",
        livePrices.ETH,
        "down",
        72,
        "Market correction expected after recent rally"
      ),
      generatePrediction(
        "SOL",
        "Solana",
        livePrices.SOL,
        "up",
        78,
        "Positive momentum and growing DeFi adoption"
      ),
    ];

    setAiPredictions(predictions);
  }, [livePrices]);

  // Fetch trading strategies on component mount
  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const strategies = [
          {
            id: 1,
            name: "Conservative Growth",
            description:
              "Low-risk strategy focusing on stable coins and blue-chip cryptocurrencies",
            riskLevel: "low",
            expectedReturn: "5-15%",
            minInvestment: 100,
            maxInvestment: 10000,
            active: true,
          },
          {
            id: 2,
            name: "Balanced Portfolio",
            description: "Medium-risk strategy with diversified crypto assets",
            riskLevel: "medium",
            expectedReturn: "15-30%",
            minInvestment: 500,
            maxInvestment: 50000,
            active: true,
          },
          {
            id: 3,
            name: "Aggressive Growth",
            description:
              "High-risk strategy targeting maximum returns through active trading",
            riskLevel: "high",
            expectedReturn: "30-60%",
            minInvestment: 1000,
            maxInvestment: 100000,
            active: false,
          },
        ];

        setTradingStrategies(strategies);
      } catch (error) {
        console.error("Failed to fetch strategies:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStrategies();
  }, []);

  // Calculate USD balances from token balances using live prices
  const calculateUSDBalances = () => {
    const ethPrice = livePrices.ETH || 0;
    const btcPrice = livePrices.BTC || 0;
    const ethValue = parseFloat(balances.ETH) * ethPrice;
    const btcValue = parseFloat(balances.BTC) * btcPrice;
    const total = ethValue + btcValue;

    setUsdBalances({
      ETH: ethValue,
      BTC: btcValue,
      total: total,
    });
  };

  // Fetch wallet balances when connected
  useEffect(() => {
    const fetchBalances = async () => {
      if (walletAddress && publicClient) {
        try {
          // Validate wallet address first
          if (!ethers.isAddress(walletAddress)) {
            console.error(
              "Invalid wallet address in AI trading:",
              walletAddress
            );
            return;
          }

          const ethBalance = await publicClient.getBalance({ address: walletAddress });
          const ethBalanceFormatted = ethers.formatEther(ethBalance);

          let btcBalance = "0.00000000";
          try {
            if (isValidBTCAddress(walletAddress)) {
              const btcBalanceValue = await fetchBTCBalance(walletAddress);
              btcBalance = btcBalanceValue.toFixed(8);
            }
          } catch (btcError) {
            console.warn("Error fetching BTC balance:", btcError);
          }

          setBalances({
            ETH: parseFloat(ethBalanceFormatted).toFixed(4),
            BTC: btcBalance,
          });
        } catch (error) {
          console.error("Failed to fetch balances:", error);
        }
      }
    };

    fetchBalances();
  }, [walletAddress, publicClient]);

  // Update USD balances when token balances or live prices change
  useEffect(() => {
    calculateUSDBalances();
  }, [balances, livePrices]);

  const handleDisconnect = () => {
    disconnect();
    clearUser();
    setBalances({
      ETH: "0.0000",
      BTC: "0.00000000",
    });
  };

  const handleCreateStrategy = () => {
    if (!walletAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    if (!strategyConfig.name || !strategyConfig.investmentAmount) {
      alert("Please fill in all required fields.");
      return;
    }

    const newStrategy = {
      id: Date.now(),
      ...strategyConfig,
      active: false,
      createdAt: new Date().toISOString(),
    };

    setTradingStrategies((prev) => [...prev, newStrategy]);
    setShowStrategyModal(false);
    setStrategyConfig({
      name: "",
      riskLevel: "medium",
      investmentAmount: "",
      targetProfit: "",
      stopLoss: "",
    });
    alert("Trading strategy created successfully!");
  };

  const handleActivateStrategy = (strategyId) => {
    if (!walletAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    setTradingStrategies((prev) =>
      prev.map((strategy) =>
        strategy.id === strategyId
          ? { ...strategy, active: !strategy.active }
          : strategy
      )
    );

    const strategy = tradingStrategies.find((s) => s.id === strategyId);
    const action = strategy.active ? "deactivated" : "activated";
    alert(`Strategy ${action} successfully!`);
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return styles.highConfidence;
    if (confidence >= 60) return styles.mediumConfidence;
    return styles.lowConfidence;
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case "low":
        return styles.lowRisk;
      case "medium":
        return styles.mediumRisk;
      case "high":
        return styles.highRisk;
      default:
        return styles.mediumRisk;
    }
  };

  const formatPrice = (price) => {
    if (price >= 1000)
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
  };

  return (
    <main className={styles.container}>
      {/* Wallet Connection Section */}
      {!walletAddress ? (
        <section className={styles.walletSection}>
          <div className={styles.walletCard}>
            <div className={styles.walletHeader}>
              <h2>🔗 Connect Your Wallet</h2>
              <p>Connect your Web3 wallet to access AI trading features</p>
            </div>
            <div className={styles.walletActions}>
              <ConnectButton />
            </div>
          </div>
        </section>
      ) : (
        // Wallet Information Section - Enhanced with stats and actions
        <section className={styles.walletSection}>
          <div className={styles.walletCard}>
            <div className={styles.walletHeader}>
              <span className={styles.walletStatus}>
                {walletAddress
                  ? userId
                    ? `User ID: ${userId}`
                    : "User ID: Loading..."
                  : "No Wallet Connected"}
              </span>
              <div className={styles.welcomeText}>
                Welcome!{" "}
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}{" "}
                at{" "}
                {currentTime.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>

            <div className={styles.walletBalance}>
              <div className={styles.balanceHeader}>
                <div className={styles.balanceLabel}>
                  Portfolio Balance (USD)
                </div>
              </div>

              <div className={styles.balanceDisplay}>
                <div className={styles.totalUSD}>
                  Total Portfolio Value:{" "}
                  <span className={styles.totalUSDValue}>
                    $
                    {typeof backendUser?.balance === "number"
                      ? backendUser.balance.toFixed(2)
                      : typeof authUser?.balance === "number"
                      ? authUser.balance.toFixed(2)
                      : usdBalances.total?.toFixed(2) || "0.00"}
                  </span>
                </div>
                {lastPriceUpdate && (
                  <div className={styles.priceUpdate}>
                    Last updated:{" "}
                    {new Date(lastPriceUpdate).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.walletStats}>
              <div className={styles.stat}>
                <div className={styles.statValue}>
                  <span className={styles.statPositive}>+$0.00</span>
                  <span className={styles.statArrow}>↗</span>
                </div>
                <div className={styles.statLabel}>Today's P&L (USD)</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>
                  <span className={styles.statPositive}>+0.00%</span>
                  <span className={styles.statArrow}>↗</span>
                </div>
                <div className={styles.statLabel}>ROI</div>
                <div className={styles.statDate}>
                  Today,{" "}
                  {currentTime.toLocaleDateString("en-US", {
                    month: "numeric",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* AI Trading Overview */}
      <section className={styles.aiOverview}>
        <div className={styles.overviewCard}>
          <h2>🤖 Intelligent AI Trading</h2>
          <p>
            Leverage advanced AI algorithms for automated cryptocurrency trading
          </p>
          <div className={styles.aiStats}>
            <div className={styles.aiStat}>
              <span className={styles.aiStatValue}>85%</span>
              <span className={styles.aiStatLabel}>Prediction Accuracy</span>
            </div>
            <div className={styles.aiStat}>
              <span className={styles.aiStatValue}>$2.4M</span>
              <span className={styles.aiStatLabel}>Total Profit Generated</span>
            </div>
            <div className={styles.aiStat}>
              <span className={styles.aiStatValue}>1,247</span>
              <span className={styles.aiStatLabel}>Successful Trades</span>
            </div>
            <div className={styles.aiStat}>
              <span className={styles.aiStatValue}>24/7</span>
              <span className={styles.aiStatLabel}>Active Monitoring</span>
            </div>
          </div>
        </div>
      </section>

      {/* AI Predictions - Only show when wallet is connected */}
      {walletAddress && (
        <section className={styles.predictionsSection}>
          <div className={styles.sectionHeader}>
            <h3>🎯 AI Market Predictions</h3>
            <p>
              Real-time predictions based on advanced machine learning
              algorithms
            </p>
          </div>

          {isLoading ? (
            <div className={styles.loading}>Loading AI predictions...</div>
          ) : (
            <div className={styles.predictionsGrid}>
              {aiPredictions.map((prediction) => (
                <div key={prediction.id} className={styles.predictionCard}>
                  <div className={styles.predictionHeader}>
                    <div className={styles.cryptoInfo}>
                      <h4>{prediction.symbol}</h4>
                      <span className={styles.cryptoName}>
                        {prediction.name}
                      </span>
                    </div>
                    <div
                      className={`${styles.direction} ${
                        prediction.direction === "up" ? styles.up : styles.down
                      }`}
                    >
                      {prediction.direction === "up" ? "↗" : "↘"}
                    </div>
                  </div>

                  <div className={styles.priceInfo}>
                    <div className={styles.currentPrice}>
                      <span className={styles.priceLabel}>Current:</span>
                      <span className={styles.priceValue}>
                        ${formatPrice(prediction.currentPrice)}
                      </span>
                    </div>
                    <div className={styles.predictedPrice}>
                      <span className={styles.priceLabel}>Predicted:</span>
                      <span className={styles.priceValue}>
                        ${formatPrice(prediction.predictedPrice)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.predictionDetails}>
                    <div className={styles.confidence}>
                      <span className={styles.confidenceLabel}>
                        Confidence:
                      </span>
                      <span
                        className={`${
                          styles.confidenceValue
                        } ${getConfidenceColor(prediction.confidence)}`}
                      >
                        {prediction.confidence}%
                      </span>
                    </div>
                    <div className={styles.timeframe}>
                      <span className={styles.timeframeLabel}>Timeframe:</span>
                      <span className={styles.timeframeValue}>
                        {prediction.timeframe}
                      </span>
                    </div>
                  </div>

                  <div className={styles.reasoning}>
                    <span className={styles.reasoningLabel}>Analysis:</span>
                    <p className={styles.reasoningText}>
                      {prediction.reasoning}
                    </p>
                  </div>

                  <button className={styles.tradeButton}>
                    Trade {prediction.symbol}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Trading Strategies - Only show when wallet is connected */}
      {walletAddress && (
        <section className={styles.strategiesSection}>
          <div className={styles.sectionHeader}>
            <h3>📊 Trading Strategies</h3>
            <div className={styles.strategyControls}>
              {walletAddress && (
                <button
                  className={styles.createStrategyButton}
                  onClick={() => setShowStrategyModal(true)}
                >
                  + Create Strategy
                </button>
              )}
            </div>
          </div>

          <div className={styles.strategiesGrid}>
            {tradingStrategies.map((strategy) => (
              <div key={strategy.id} className={styles.strategyCard}>
                <div className={styles.strategyHeader}>
                  <h4>{strategy.name}</h4>
                  <span
                    className={`${styles.riskLevel} ${getRiskColor(
                      strategy.riskLevel
                    )}`}
                  >
                    {strategy.riskLevel.toUpperCase()}
                  </span>
                </div>

                <p className={styles.strategyDescription}>
                  {strategy.description}
                </p>

                <div className={styles.strategyStats}>
                  <div className={styles.strategyStat}>
                    <span className={styles.statLabel}>Expected Return:</span>
                    <span className={styles.statValue}>
                      {strategy.expectedReturn}
                    </span>
                  </div>
                  <div className={styles.strategyStat}>
                    <span className={styles.statLabel}>Min Investment:</span>
                    <span className={styles.statValue}>
                      ${strategy.minInvestment}
                    </span>
                  </div>
                  <div className={styles.strategyStat}>
                    <span className={styles.statLabel}>Max Investment:</span>
                    <span className={styles.statValue}>
                      ${strategy.maxInvestment}
                    </span>
                  </div>
                </div>

                <div className={styles.strategyActions}>
                  <button
                    className={`${styles.activateButton} ${
                      strategy.active ? styles.deactivate : ""
                    }`}
                    onClick={() => handleActivateStrategy(strategy.id)}
                  >
                    {strategy.active ? "Deactivate" : "Activate"}
                  </button>
                  <button className={styles.editButton}>Edit</button>
                </div>

                {strategy.active && (
                  <div className={styles.activeIndicator}>
                    <span className={styles.activeDot}></span>
                    Active
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Strategy Creation Modal - Only show when wallet is connected */}
      {walletAddress && showStrategyModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowStrategyModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Create Trading Strategy</h3>
              <button
                className={styles.modalClose}
                onClick={() => setShowStrategyModal(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.inputGroup}>
                <label>Strategy Name</label>
                <input
                  type="text"
                  value={strategyConfig.name}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Enter strategy name"
                  className={styles.modalInput}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Risk Level</label>
                <select
                  value={strategyConfig.riskLevel}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({
                      ...prev,
                      riskLevel: e.target.value,
                    }))
                  }
                  className={styles.modalSelect}
                >
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label>Investment Amount ($)</label>
                <input
                  type="number"
                  value={strategyConfig.investmentAmount}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({
                      ...prev,
                      investmentAmount: e.target.value,
                    }))
                  }
                  placeholder="Enter amount"
                  className={styles.modalInput}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Target Profit (%)</label>
                <input
                  type="number"
                  value={strategyConfig.targetProfit}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({
                      ...prev,
                      targetProfit: e.target.value,
                    }))
                  }
                  placeholder="Enter target profit"
                  className={styles.modalInput}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Stop Loss (%)</label>
                <input
                  type="number"
                  value={strategyConfig.stopLoss}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({
                      ...prev,
                      stopLoss: e.target.value,
                    }))
                  }
                  placeholder="Enter stop loss"
                  className={styles.modalInput}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => setShowStrategyModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles.modalButtonPrimary}
                onClick={handleCreateStrategy}
              >
                Create Strategy
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
