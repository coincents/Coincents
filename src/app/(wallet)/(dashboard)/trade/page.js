"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import styles from "./trade.module.css";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { useCandles } from "./useCandles";
import ApexCharts from "apexcharts";

// Dynamic import to avoid SSR issues with ApexCharts
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const sortTrades = (list = []) => {
  return [...list].sort((a, b) => {
    const aTime = new Date(a?.createdAt || a?.priceOpenAt || 0).getTime();
    const bTime = new Date(b?.createdAt || b?.priceOpenAt || 0).getTime();
    return bTime - aTime;
  });
};

const mergeTrades = (incoming = [], existing = []) => {
  const normalizedIncoming = sortTrades(incoming);
  const incomingMap = new Map(
    normalizedIncoming.map((trade) => [trade.id, trade])
  );
  const optimisticCarry = existing.filter(
    (trade) => trade.__optimistic && !incomingMap.has(trade.id)
  );
  return sortTrades([...normalizedIncoming, ...optimisticCarry]);
};

export default function TradePage({ params = {} }) {
  const { userId, walletAddress, refreshUserFromBackend, backendUser } =
    useUser();
  const searchParams = useSearchParams();
  const querySymbol = searchParams?.get("symbol");
  const symbol = (params?.symbol || querySymbol || "BTC").toUpperCase();
  const [series, setSeries] = useState([]);
  const [price, setPrice] = useState(null);
  const [interval, setIntervalState] = useState("1m");
  const [amountInput, setAmountInput] = useState("50");
  const [timeframe, setTimeframe] = useState(60);
  const [expectedReturn, setExpectedReturn] = useState(10);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTrades, setActiveTrades] = useState([]);
  const [completedTrades, setCompletedTrades] = useState([]);
  const [tradesTab, setTradesTab] = useState("active"); // "active" | "history"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingDirection, setPendingDirection] = useState(null);
  const [countdowns, setCountdowns] = useState({});

  // Candlestick data (historical + realtime)
  const {
    series: candleSeries,
    price: livePrice,
    loading,
    error: chartError,
    reconnecting,
    retry: retryChart,
  } = useCandles(symbol, interval);

  // Preserve zoom/pan range across data updates
  const viewRangeRef = useRef({ min: null, max: null });
  const latestSeriesRef = useRef([]);
  const updateTimerRef = useRef(null);
  const latestFetchRef = useRef(0);

  const parsedAmount = useMemo(() => {
    const value = parseFloat(amountInput);
    if (!Number.isFinite(value)) return 0;
    return value;
  }, [amountInput]);
  const isAmountValid = parsedAmount > 0;
  const availableBalance =
    typeof backendUser?.balance === "number" ? backendUser.balance : null;
  const exceedsBalance =
    availableBalance !== null && isAmountValid && parsedAmount > availableBalance;
  const formattedAmountForDisplay = useMemo(() => {
    if (isAmountValid) {
      return parsedAmount.toFixed(2);
    }
    if (!amountInput || amountInput === ".") {
      return "0.00";
    }
    return amountInput;
  }, [amountInput, isAmountValid, parsedAmount]);
  const loadTrades = useCallback(async () => {
    if (!userId) return;
    const fetchId = ++latestFetchRef.current;
    try {
      const [activeRes, historyRes] = await Promise.all([
        fetch(`/api/trades?userId=${userId}&status=PENDING`, {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(`/api/trades?userId=${userId}&completed=true`, {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      const [activeData, historyData] = await Promise.all([
        activeRes.json(),
        historyRes.json(),
      ]);

      if (fetchId !== latestFetchRef.current) {
        return;
      }

      if (activeRes.ok && activeData?.success) {
        setActiveTrades((prev) =>
          mergeTrades(activeData.trades || [], prev)
        );
      }
      if (historyRes.ok && historyData?.success) {
        setCompletedTrades((prev) =>
          mergeTrades(historyData.trades || [], prev)
        );
      }
    } catch (error) {
      console.error("Failed to fetch trades:", error);
    }
  }, [userId]);

  useEffect(() => {
    if (walletAddress && refreshUserFromBackend) {
      refreshUserFromBackend();
    }
  }, [walletAddress, refreshUserFromBackend]);

  useEffect(() => {
    latestSeriesRef.current = candleSeries;
    setSeries(candleSeries);
    setPrice(livePrice);
    setIsConnected(!reconnecting && !!candleSeries.length);
    if (updateTimerRef.current) return;
    updateTimerRef.current = setTimeout(() => {
      try {
        ApexCharts.exec(
          "candles",
          "updateSeries",
          [{ data: latestSeriesRef.current }],
          false
        );
        const { min, max } = viewRangeRef.current || {};
        if (min && max) {
          ApexCharts.exec(
            "candles",
            "updateOptions",
            { xaxis: { min, max } },
            false,
            false
          );
        }
      } catch {}
      updateTimerRef.current = null;
    }, 250);
    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [candleSeries, livePrice, reconnecting]);

  // Calculate expected return when amount or timeframe changes
  useEffect(() => {
    const pct = getReturnPercentage(timeframe) / 100;
    setExpectedReturn(isAmountValid ? parsedAmount * pct : 0);
  }, [parsedAmount, timeframe, isAmountValid]);

  const getReturnPercentage = (tf) => {
    if (tf <= 60) return 20;
    if (tf <= 120) return 30;
    if (tf <= 180) return 40;
    if (tf <= 360) return 50;
    if (tf <= 600) return 60;
    if (tf <= 1200) return 70;
    return 80;
  };

  // Chart configuration
  const options = useMemo(
    () => ({
      chart: {
        id: "candles",
        type: "candlestick",
        height: 400,
        background: "#1a1a1a",
        animations: { enabled: false },
        toolbar: { show: true },
        events: {
          mounted: () => {
            try {
              ApexCharts.exec(
                "candles",
                "updateSeries",
                [{ data: latestSeriesRef.current }],
                false
              );
            } catch {}
          },
          zoomed: (ctx, { xaxis }) => {
            viewRangeRef.current = { min: xaxis.min, max: xaxis.max };
          },
          scrolled: (ctx, { xaxis }) => {
            viewRangeRef.current = { min: xaxis.min, max: xaxis.max };
          },
          selection: (ctx, { xaxis }) => {
            viewRangeRef.current = { min: xaxis.min, max: xaxis.max };
          },
        },
      },
      title: {
        text: `${symbol}/USDT`,
        align: "left",
        style: { color: "#fff", fontSize: "18px" },
      },
      xaxis: {
        type: "datetime",
        labels: {
          style: {
            colors: "#888",
          },
        },
      },
      yaxis: {
        tooltip: { enabled: true },
        decimalsInFloat: 2,
        labels: {
          style: {
            colors: "#888",
          },
        },
      },
      grid: {
        borderColor: "#333",
      },
      theme: {
        mode: "dark",
      },
      plotOptions: {
        candlestick: {
          colors: { upward: "#16a34a", downward: "#dc2626" },
        },
      },
      tooltip: {
        shared: false,
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          try {
            const d = w.globals.seriesCandleC[seriesIndex][dataPointIndex];
            const t = w.globals.seriesX[seriesIndex][dataPointIndex];
            const [o, h, l, c] = d;
            return `<div class="apex-tooltip">${new Date(
              t
            ).toLocaleString()}<br/>O: ${o}<br/>H: ${h}<br/>L: ${l}<br/>C: ${c}</div>`;
          } catch (e) {
            return "";
          }
        },
      },
      noData: { text: "Loading…" },
    }),
    [symbol]
  );

  const durations = useMemo(
    () => [
      { label: "60s", seconds: 60 },
      { label: "120s", seconds: 120 },
      { label: "180s", seconds: 180 },
      { label: "360s", seconds: 360 },
      { label: "600s", seconds: 600 },
      { label: "1200s", seconds: 1200 },
      { label: "3600s", seconds: 3600 },
    ],
    []
  );

  const intervals = ["1m", "5m", "15m", "30m", "1h", "1d"];
  const handleAmountInputChange = (value) => {
    if (value === "") {
      setAmountInput("");
      return;
    }
    const sanitized = value.replace(/,/g, "");
    if (/^\d*(\.\d{0,2})?$/.test(sanitized)) {
      setAmountInput(sanitized);
    }
  };

  // Show confirmation modal instead of immediate trade
  const handleTradeClick = (direction) => {
    if (!userId) {
      alert("Please connect your wallet to place a trade.");
      return;
    }
    if (!isAmountValid) {
      alert("Please enter a valid amount.");
      return;
    }
    if (exceedsBalance) {
      alert("Insufficient balance for this trade.");
      return;
    }
    setPendingDirection(direction);
    setShowConfirmModal(true);
  };

  // Actually execute the trade after confirmation
  const confirmTrade = async () => {
    setShowConfirmModal(false);
    if (!pendingDirection) return;
    if (!isAmountValid) return;
    if (exceedsBalance) {
      alert("Insufficient balance for this trade.");
      setPendingDirection(null);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticTrade = {
      id: tempId,
      coin: symbol,
      type: pendingDirection.toUpperCase(),
      amount: parsedAmount,
      timeframe: Number(timeframe),
      status: "PENDING",
      priceOpen: price ?? null,
      priceOpenAt: new Date().toISOString(),
      __optimistic: true,
    };

    setActiveTrades((prev) => mergeTrades([optimisticTrade], prev));

    try {
      const res = await fetch("/api/trades/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coin: symbol,
          type: pendingDirection.toUpperCase(),
          amount: parsedAmount,
          timeframe: Number(timeframe),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setActiveTrades((prev) =>
          prev.filter((trade) => trade.id !== tempId)
        );
        alert(data.error || "Failed to create trade");
        return;
      }
      const newTrade = data.trade;
      setActiveTrades((prev) => {
        const withoutTemp = prev.filter((trade) => trade.id !== tempId);
        return mergeTrades([newTrade], withoutTemp);
      });
      loadTrades();
      // Refresh user balance after trade
      if (refreshUserFromBackend) {
        refreshUserFromBackend();
      }
    } catch (e) {
      console.error("Create trade failed:", e);
      setActiveTrades((prev) =>
        prev.filter((trade) => trade.id !== tempId)
      );
      alert("Trade failed. Please try again.");
    }
    setPendingDirection(null);
  };

  // Countdown timer for active trades
  useEffect(() => {
    if (activeTrades.length === 0) return;

    const updateCountdowns = () => {
      const now = Date.now();
      const newCountdowns = {};

      activeTrades.forEach((trade) => {
        if (trade.status !== "PENDING") return;
        const openTime = new Date(trade.priceOpenAt || trade.createdAt).getTime();
        const endTime = openTime + trade.timeframe * 1000;
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        newCountdowns[trade.id] = remaining;
      });

      setCountdowns(newCountdowns);
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, [activeTrades]);

  // Format countdown as MM:SS
  const formatCountdown = (seconds) => {
    if (seconds === undefined || seconds <= 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Load trades with auto-refresh every 10 seconds
  useEffect(() => {
    if (!userId) return;
    loadTrades();
    const intervalId = setInterval(loadTrades, 10000);
    return () => clearInterval(intervalId);
  }, [userId, loadTrades]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.backButton}>
            ← Back to Home
          </Link>
          <h1 className={styles.title}>{symbol}/USDT</h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.connectionStatus}>
            <span
              className={`${styles.statusDot} ${
                isConnected ? styles.connected : styles.disconnected
              }`}
            ></span>
            {isConnected ? "Connected" : "Disconnected"}
          </div>
          <span className={styles.price}>
            {price ? `$${price.toFixed(4)}` : "Loading..."}
          </span>
        </div>
      </div>

      {/* Chart Section */}
      <div className={styles.chartSection}>
        <div className={styles.intervalButtons}>
          {intervals.map((i) => (
            <button
              key={i}
              onClick={() => setIntervalState(i)}
              className={`${styles.intervalButton} ${
                interval === i ? styles.active : ""
              }`}
            >
              {i}
            </button>
          ))}
        </div>
        <div className={styles.chartContainer}>
          {loading ? (
            <div className={styles.chartLoading}>Loading chart data...</div>
          ) : chartError ? (
            <div className={styles.chartError}>
              <p>{chartError}</p>
              <button onClick={retryChart} className={styles.retryButton}>
                Retry
              </button>
            </div>
          ) : typeof window !== "undefined" && (
            <Chart
              options={options}
              series={[{ data: series }]}
              type="candlestick"
              height={400}
            />
          )}
        </div>
      </div>

      {/* Trade Panel */}
      <div className={styles.tradePanel}>
        <h2 className={styles.panelTitle}>Trade Panel</h2>

        {/* Duration Selection */}
        <div className={styles.durationGrid}>
          {durations.map((d) => (
            <button
              key={d.seconds}
              onClick={() => setTimeframe(d.seconds)}
              className={`${styles.durationButton} ${
                timeframe === d.seconds ? styles.selected : ""
              }`}
            >
              <div className={styles.durationLabel}>{d.label}</div>
              <div className={styles.returnRate}>
                {getReturnPercentage(d.seconds)}% Return
              </div>
            </button>
          ))}
        </div>

        {/* Amount Input */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>Amount ($)</label>
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => handleAmountInputChange(e.target.value)}
            className={styles.input}
            placeholder="Enter amount"
          />
          {availableBalance !== null && (
            <p
              className={`${styles.balanceHelper} ${
                exceedsBalance ? styles.balanceHelperError : ""
              }`}
            >
              Available: ${availableBalance.toFixed(2)}
              {exceedsBalance && " — insufficient balance"}
            </p>
          )}
        </div>

        {/* Expected Return */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>Expected Return</label>
          <div className={styles.returnDisplay}>
            ${expectedReturn.toFixed(2)}
          </div>
        </div>

        {/* Trade Buttons */}
        <div className={styles.tradeButtons}>
          <button
            className={`${styles.tradeButton} ${styles.downButton}`}
            onClick={() => handleTradeClick("down")}
            disabled={!price || !isConnected || !isAmountValid || exceedsBalance}
          >
            <span className={styles.arrow}>↓</span>
            <span>Down</span>
          </button>
          <button
            className={`${styles.tradeButton} ${styles.upButton}`}
            onClick={() => handleTradeClick("up")}
            disabled={!price || !isConnected || !isAmountValid || exceedsBalance}
          >
            <span className={styles.arrow}>↑</span>
            <span>Up</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className={styles.modalOverlay} onClick={() => setShowConfirmModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Confirm Trade</h3>
            <div className={styles.modalContent}>
              <div className={styles.modalRow}>
                <span>Coin:</span>
                <span>{symbol}/USDT</span>
              </div>
              <div className={styles.modalRow}>
                <span>Direction:</span>
                <span className={pendingDirection === "up" ? styles.up : styles.down}>
                  {pendingDirection?.toUpperCase()}
                </span>
              </div>
              <div className={styles.modalRow}>
                <span>Amount:</span>
                <span>${formattedAmountForDisplay}</span>
              </div>
              <div className={styles.modalRow}>
                <span>Duration:</span>
                <span>{timeframe}s</span>
              </div>
              <div className={styles.modalRow}>
                <span>Expected Return:</span>
                <span className={styles.returnHighlight}>${expectedReturn.toFixed(2)}</span>
              </div>
            </div>
            <div className={styles.modalButtons}>
              <button
                className={styles.cancelButton}
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                className={`${styles.confirmButton} ${pendingDirection === "up" ? styles.upButton : styles.downButton}`}
                onClick={confirmTrade}
              >
                Confirm {pendingDirection?.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trades Section with Tabs */}
      <div className={styles.activeTradesSection}>
        {/* Tab Buttons */}
        <div className={styles.tabButtons}>
          <button
            className={`${styles.tabButton} ${tradesTab === "active" ? styles.activeTab : ""}`}
            onClick={() => setTradesTab("active")}
          >
            Active Trades ({activeTrades.length})
          </button>
          <button
            className={`${styles.tabButton} ${tradesTab === "history" ? styles.activeTab : ""}`}
            onClick={() => setTradesTab("history")}
          >
            Trade History ({completedTrades.length})
          </button>
        </div>

        {/* Active Trades Tab */}
        {tradesTab === "active" && (
          <>
            {activeTrades.length === 0 ? (
              <p className={styles.noTrades}>
                No active trades. Place an Up or Down trade to get started.
              </p>
            ) : (
              <div className={styles.tradesList}>
                {activeTrades.map((trade) => (
                  <div key={trade.id} className={styles.tradeItem}>
                    <div className={styles.tradeInfo}>
                      <span className={styles.tradeSymbol}>{trade.coin}</span>
                      <span
                        className={`${styles.tradeDirection} ${
                          trade.type === "UP" ? styles.up : styles.down
                        }`}
                      >
                        {trade.type}
                      </span>
                      <span className={styles.tradeAmount}>${trade.amount}</span>
                      {trade.status === "PENDING" && (
                        <span className={styles.countdown}>
                          {formatCountdown(countdowns[trade.id])}
                        </span>
                      )}
                    </div>
                    <div className={styles.tradeStatus}>
                      <span className={`${styles.status} ${styles[trade.status]}`}>
                        Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Trade History Tab */}
        {tradesTab === "history" && (
          <>
            {completedTrades.length === 0 ? (
              <p className={styles.noTrades}>
                No completed trades yet.
              </p>
            ) : (
              <div className={styles.tradesList}>
                {completedTrades.map((trade) => (
                  <div key={trade.id} className={styles.tradeItem}>
                    <div className={styles.tradeInfo}>
                      <span className={styles.tradeSymbol}>{trade.coin}</span>
                      <span
                        className={`${styles.tradeDirection} ${
                          trade.type === "UP" ? styles.up : styles.down
                        }`}
                      >
                        {trade.type}
                      </span>
                      <span className={styles.tradeAmount}>${trade.amount}</span>
                      <span className={styles.tradePrice}>
                        ${trade.priceOpen?.toFixed(2)} → ${trade.priceClose?.toFixed(2) || "—"}
                      </span>
                    </div>
                    <div className={styles.tradeResult}>
                      <span className={`${styles.status} ${styles[trade.status]}`}>
                        {trade.status}
                      </span>
                      {trade.pnl !== null && trade.pnl !== undefined && (
                        <span className={`${styles.pnl} ${trade.pnl >= 0 ? styles.profit : styles.loss}`}>
                          {trade.pnl >= 0 ? "+" : ""}${trade.pnl?.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
