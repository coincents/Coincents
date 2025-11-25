const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

function symbolToId(symbol) {
  const map = {
    BTC: "bitcoin",
    ETH: "ethereum",
    USDT: "tether",
    USDC: "usd-coin",
  };
  return map[symbol?.toUpperCase()] || symbol?.toLowerCase();
}

export async function getSpot(symbol) {
  const id = symbolToId(symbol);
  const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`;
  const res = await fetch(url, { next: { revalidate: 10 } });
  if (!res.ok) throw new Error("Failed to fetch spot price");
  const json = await res.json();
  const price = json?.[id]?.usd;
  if (!price) throw new Error("Symbol not found");
  return { symbol: symbol.toUpperCase(), usd: price, at: new Date() };
}

export async function getAt(symbol, timestampMs) {
  const id = symbolToId(symbol);
  const from = Math.floor((timestampMs - 60_000) / 1000);
  const to = Math.floor((timestampMs + 60_000) / 1000);
  const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(
    id
  )}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error("Failed to fetch historical price");
  const json = await res.json();
  const prices = json?.prices || [];
  if (!prices.length) throw new Error("No price data");
  // Pick closest price to timestamp
  let closest = prices[0];
  let minDiff = Math.abs(closest[0] - timestampMs);
  for (const p of prices) {
    const diff = Math.abs(p[0] - timestampMs);
    if (diff < minDiff) {
      closest = p;
      minDiff = diff;
    }
  }
  return { symbol: symbol.toUpperCase(), usd: closest[1], at: new Date(closest[0]) };
}

export async function getOHLC(symbol, days = 1) {
  const id = symbolToId(symbol);
  const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(
    id
  )}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error("Failed to fetch OHLC");
  return res.json();
}


