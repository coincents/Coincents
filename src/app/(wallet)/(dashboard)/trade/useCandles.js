"use client";

import { useEffect, useRef, useState } from "react";

const MAX_POINTS = 500;
const CANDLE_PROVIDERS = [
  {
    id: "binance-global",
    label: "Binance Global",
    buildRestUrl: (symbolPair, interval) =>
      `https://api.binance.com/api/v3/klines?symbol=${symbolPair}&interval=${interval}&limit=${MAX_POINTS}`,
    buildWsUrl: (streamSymbol, interval) =>
      `wss://stream.binance.com:9443/ws/${streamSymbol}@kline_${interval}`,
  },
  {
    id: "binance-us",
    label: "Binance US",
    buildRestUrl: (symbolPair, interval) =>
      `https://api.binance.us/api/v3/klines?symbol=${symbolPair}&interval=${interval}&limit=${MAX_POINTS}`,
    buildWsUrl: (streamSymbol, interval) =>
      `wss://stream.binance.us:9443/ws/${streamSymbol}@kline_${interval}`,
  },
];

const GEO_BLOCK_RE = /(451|403|forbidden|blocked|region|failed to fetch)/i;

const buildSeriesPoint = (kline) => {
  return {
    x: new Date(kline[0]), // open time
    y: [
      parseFloat(kline[1]), // open
      parseFloat(kline[2]), // high
      parseFloat(kline[3]), // low
      parseFloat(kline[4]), // close
    ],
  };
};

const isLikelyGeoBlocked = (error) => {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : error?.message || error?.stack || String(error);
  return GEO_BLOCK_RE.test(message);
};

const formatErrorMessage = (error) => {
  if (!error) return "Failed to load chart data";
  if (error.name === "AbortError") {
    return "Chart loading timed out. Tap to retry.";
  }
  if (isLikelyGeoBlocked(error)) {
    return "Live market data is blocked in your current region or VPN.";
  }
  return error.message || "Failed to load chart data";
};

const getSymbolPair = (symbol) => `${symbol.toUpperCase()}USDT`;
const getStreamSymbol = (symbol) => `${symbol.toLowerCase()}usdt`;

export function useCandles(symbol, interval) {
  const [series, setSeries] = useState([]);
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [providerIndex, setProviderIndex] = useState(0);

  const wsRef = useRef(null);
  const abortRef = useRef(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef(null);

  // Retry function exposed to consumers
  const retry = () => {
    setProviderIndex(0);
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    let cancelled = false;
    let historicalLoaded = false;
    let failoverTriggered = false;

    const cleanup = () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
        abortRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const provider =
      CANDLE_PROVIDERS[Math.min(providerIndex, CANDLE_PROVIDERS.length - 1)];
    const symbolPair = getSymbolPair(symbol);
    const streamSymbol = getStreamSymbol(symbol);

    const requestProviderFailover = (context) => {
      if (failoverTriggered) return true;
      if (providerIndex < CANDLE_PROVIDERS.length - 1) {
        failoverTriggered = true;
        setReconnecting(true);
        console.warn(
          `[useCandles] Falling back from ${provider.label} due to ${context}.`
        );
        setProviderIndex((idx) =>
          idx < CANDLE_PROVIDERS.length - 1 ? idx + 1 : idx
        );
        return true;
      }
      return false;
    };

    const fetchHistorical = async () => {
      abortRef.current = new AbortController();
      const url = provider.buildRestUrl(symbolPair, interval);

      // Add 8-second timeout
      const timeoutId = setTimeout(() => {
        if (abortRef.current) abortRef.current.abort();
      }, 8000);

      try {
        const res = await fetch(url, { signal: abortRef.current.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`REST ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const points = data.map(buildSeriesPoint);
        setSeries(points);
        setPrice(points.length ? points[points.length - 1].y[3] : null);
        historicalLoaded = true;
        setLoading(false);
        setError(null);
      } catch (e) {
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (isLikelyGeoBlocked(e) && requestProviderFailover("REST error")) {
          cleanup();
          return;
        }
        // Only show error if WebSocket also hasn't provided data after a delay
        setTimeout(() => {
          if (!cancelled && !historicalLoaded) {
            setLoading(false);
            setError(formatErrorMessage(e));
          }
        }, 2000); // Give WebSocket 2 more seconds to provide data
      }
    };

    const openWebSocket = () => {
      const streamUrl = provider.buildWsUrl(streamSymbol, interval);
      try {
        const ws = new WebSocket(streamUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setReconnecting(false);
          backoffRef.current = 1000;
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const k = msg.k;
            if (!k) return;
            const openTime = k.t;
            const isFinal = k.x;
            const point = {
              x: new Date(openTime),
              y: [parseFloat(k.o), parseFloat(k.h), parseFloat(k.l), parseFloat(k.c)],
            };
            setPrice(point.y[3]);
            // If we get WebSocket data, we can show something (even without historical)
            if (!historicalLoaded) {
              historicalLoaded = true;
              setLoading(false);
              setError(null);
            }
            setSeries((prev) => {
              if (!prev.length) return [point];
              const last = prev[prev.length - 1];
              if (last.x.getTime() === openTime) {
                // replace in-progress candle
                const updated = [...prev];
                updated[updated.length - 1] = point;
                return updated;
              }
              if (isFinal) {
                const next = [...prev, point];
                if (next.length > MAX_POINTS) next.splice(0, next.length - MAX_POINTS);
                return next;
              }
              return prev;
            });
          } catch {}
        };

        ws.onclose = (event) => {
          if (cancelled) return;
          if (
            isLikelyGeoBlocked(event?.reason || event?.code) &&
            requestProviderFailover("WebSocket close")
          ) {
            cleanup();
            return;
          }
          setReconnecting(true);
          const delay = Math.min(backoffRef.current, 30000);
          backoffRef.current = delay * 2;
          reconnectTimerRef.current = setTimeout(() => {
            openWebSocket();
          }, delay);
        };

        ws.onerror = () => {
          try {
            ws.close();
          } catch {}
        };
      } catch (e) {
        setError(formatErrorMessage(e));
      }
    };

    // Clear previous state and start both in parallel
    cleanup();
    setError(null);
    setLoading(true);
    fetchHistorical();
    openWebSocket();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [symbol, interval, retryCount, providerIndex]);

  return { series, price, loading, error, reconnecting, retry };
}


