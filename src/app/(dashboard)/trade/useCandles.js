"use client";

import { useEffect, useRef, useState } from "react";

const MAX_POINTS = 500;

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

export function useCandles(symbol, interval) {
  const [series, setSeries] = useState([]);
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);

  const wsRef = useRef(null);
  const abortRef = useRef(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

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

    const fetchHistorical = async () => {
      setLoading(true);
      setError(null);
      abortRef.current = new AbortController();
      const symbolPair = `${symbol.toUpperCase()}USDT`;
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbolPair}&interval=${interval}&limit=${MAX_POINTS}`;
      try {
        const res = await fetch(url, { signal: abortRef.current.signal });
        if (!res.ok) throw new Error(`REST ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const points = data.map(buildSeriesPoint);
        setSeries(points);
        setPrice(points.length ? points[points.length - 1].y[3] : null);
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message || "Failed to load candles");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const openWebSocket = () => {
      const streamUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}usdt@kline_${interval}`;
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

        ws.onclose = () => {
          if (cancelled) return;
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
        setError("WebSocket error");
      }
    };

    // start
    cleanup();
    fetchHistorical().then(() => openWebSocket());

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [symbol, interval]);

  return { series, price, loading, error, reconnecting };
}


