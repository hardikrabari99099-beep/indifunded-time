import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";

export const DEFAULT_MARKET_SYMBOLS = [
  "NIFTY",
  "BANKNIFTY",
  "SENSEX",
  "RELIANCE",
  "HDFCBANK",
  "TCS",
  "INFY",
  "ICICIBANK",
  "SBIN",
  "TATAMOTORS",
  "ITC",
  "RELIANCE.BO",
  "TCS.BO",
];

export function formatPrice(n, digits = 2) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatRupeePrice(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `₹${formatPrice(num, 2)}`;
}

export function useLiveMarketQuotes(symbols = DEFAULT_MARKET_SYMBOLS, options = {}) {
  const { pollMs = 5000, enabled = true } = options;
  const symbolKey = Array.isArray(symbols) ? symbols.join(",") : String(symbols || "");
  const [quotes, setQuotes] = useState([]);
  const [marketStatus, setMarketStatus] = useState("CLOSED");
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flashMap, setFlashMap] = useState({});
  const prevLtpRef = useRef({});
  const flashTimersRef = useRef({});

  const fetchQuotes = useCallback(async () => {
    if (!enabled) return;
    try {
      const params = symbolKey ? { symbols: symbolKey } : {};
      const res = await api.get("/market/quotes", { params });
      const list = res.data?.quotes || [];
      const nextFlashes = {};
      for (const q of list) {
        const prev = prevLtpRef.current[q.symbol];
        if (prev != null && q.ltp !== prev) {
          nextFlashes[q.symbol] = q.ltp > prev ? "up" : "down";
        }
        prevLtpRef.current[q.symbol] = q.ltp;
      }
      if (Object.keys(nextFlashes).length) {
        setFlashMap((cur) => ({ ...cur, ...nextFlashes }));
        for (const sym of Object.keys(nextFlashes)) {
          if (flashTimersRef.current[sym]) clearTimeout(flashTimersRef.current[sym]);
          flashTimersRef.current[sym] = setTimeout(() => {
            setFlashMap((cur) => {
              if (!cur[sym]) return cur;
              const copy = { ...cur };
              delete copy[sym];
              return copy;
            });
          }, 700);
        }
      }
      setQuotes(list);
      if (res.data?.marketStatus) setMarketStatus(res.data.marketStatus);
      if (res.data?.fetchedAt) setFetchedAt(res.data.fetchedAt);
      setError(null);
    } catch (err) {
      setError(err?.message || "Market feed unavailable");
    } finally {
      setLoading(false);
    }
  }, [symbolKey, enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchQuotes();
    if (!pollMs || pollMs < 1000) return;
    const id = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) {
        fetchQuotes();
      }
    }, pollMs);
    const onVisible = () => {
      if (!document.hidden) fetchQuotes();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [fetchQuotes, pollMs, enabled]);

  useEffect(() => {
    const timers = flashTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const quoteMap = useMemo(() => {
    const map = {};
    for (const q of quotes) map[q.symbol] = q;
    return map;
  }, [quotes]);

  return {
    quotes,
    quoteMap,
    marketStatus,
    fetchedAt,
    loading,
    error,
    flashMap,
    refresh: fetchQuotes,
  };
}

export function useLiveCandles(symbol, tf = "5m", options = {}) {
  const { pollMs = 8000, enabled = true } = options;
  const [candles, setCandles] = useState([]);
  const [quote, setQuote] = useState(null);
  const [marketStatus, setMarketStatus] = useState("CLOSED");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchCandles = useCallback(
    async (isBackground = false) => {
      if (!enabled || !symbol) return;
      if (!isBackground) setRefreshing(true);
      try {
        const res = await api.get("/market/candles", { params: { symbol, tf } });
        if (Array.isArray(res.data?.candles) && res.data.candles.length) {
          setCandles(res.data.candles);
        }
        if (res.data?.quote) setQuote(res.data.quote);
        if (res.data?.marketStatus) setMarketStatus(res.data.marketStatus);
        setError(null);
      } catch (err) {
        setError(err?.message || "Chart feed unavailable");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [symbol, tf, enabled],
  );

  useEffect(() => {
    if (!enabled || !symbol) return;
    fetchCandles(false);
    if (!pollMs || pollMs < 1000) return;
    const id = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) {
        fetchCandles(true);
      }
    }, pollMs);
    const onVisible = () => {
      if (!document.hidden) fetchCandles(true);
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [fetchCandles, pollMs, enabled, symbol]);

  return {
    candles,
    quote,
    marketStatus,
    loading,
    refreshing,
    error,
    refresh: () => fetchCandles(false),
  };
}

export async function searchMarketSymbols(query) {
  const res = await api.get("/market/search", { params: { q: query || "" } });
  return res.data || [];
}
