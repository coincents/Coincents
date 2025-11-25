"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./trade.module.css";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { useCandles } from "./useCandles";
import ApexCharts from "apexcharts";

// Dynamic import to avoid SSR issues with ApexCharts
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function TradePage({ params = {} }) {
  const { userId } = useUser();
  const searchParams = useSearchParams();
  const querySymbol = searchParams?.get("symbol");
  const symbol = (params?.symbol || querySymbol || "BTC").toUpperCase();
  const [series, setSeries] = useState([]);
  const [price, setPrice] = useState(null);
  const [interval, setIntervalState] = useState("1m");
  const [amount, setAmount] = useState(50);
  const [timeframe, setTimeframe] = useState(60);
  const [expectedReturn, setExpectedReturn] = useState(10);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTrades, setActiveTrades] = useState([]);

  // Candlestick data (historical + realtime)
  const {
    series: candleSeries,
    price: livePrice,
    loading,
    reconnecting,
  } = useCandles(symbol, interval);

  // Preserve zoom/pan range across data updates
  const viewRangeRef = useRef({ min: null, max: null });
  const latestSeriesRef = useRef([]);
  const updateTimerRef = useRef(null);

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
    setExpectedReturn(amount * pct);
  }, [amount, timeframe]);

  const getReturnPercentage = (tf) => {
    if (tf <= 60) return 85;
    if (tf <= 300) return 80;
    if (tf <= 900) return 75;
    if (tf <= 1800) return 70;
    return 65;
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

  // Admin manually closes trades; no client-side timers

  const handleTrade = async (direction) => {
    if (!userId) {
      alert("Please connect your wallet to place a trade.");
      return;
    }
    if (!amount || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    try {
      const res = await fetch("/api/trades/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coin: symbol,
          type: direction.toUpperCase(),
          amount: Number(amount),
          timeframe: Number(timeframe),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Failed to create trade");
        return;
      }
      const newTrade = data.trade;
      setActiveTrades((prev) => [newTrade, ...prev]);
    } catch (e) {
      console.error("Create trade failed:", e);
      alert("Trade failed. Please try again.");
    }
  };

  // Load existing active trades on mount/user change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) return;
      try {
        const res = await fetch(`/api/trades?userId=${userId}&status=PENDING`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setActiveTrades(data.trades || []);
          (data.trades || []).forEach(scheduleResolution);
        }
      } catch (e) {
        console.error("Failed to fetch active trades:", e);
      }
    };
    load();
    return () => {
      cancelled = true;
      // no timers to clear
    };
  }, [userId]);

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
          {typeof window !== "undefined" && (
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
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className={styles.input}
            min="1"
            step="1"
          />
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
            onClick={() => handleTrade("down")}
            disabled={!price || !isConnected}
          >
            <span className={styles.arrow}>↓</span>
            <span>Down</span>
          </button>
          <button
            className={`${styles.tradeButton} ${styles.upButton}`}
            onClick={() => handleTrade("up")}
            disabled={!price || !isConnected}
          >
            <span className={styles.arrow}>↑</span>
            <span>Up</span>
          </button>
        </div>
      </div>

      {/* Active Trades */}
      <div className={styles.activeTradesSection}>
        <h2 className={styles.panelTitle}>Active Trades</h2>
        {activeTrades.length === 0 ? (
          <p className={styles.noTrades}>
            No trades yet. Place an Up or Down trade to get started.
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
                  <span className={styles.tradeAmount}>{trade.timeframe}s</span>
                </div>
                <div className={styles.tradeStatus}>
                  <span className={`${styles.status} ${styles[trade.status]}`}>
                    {trade.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
