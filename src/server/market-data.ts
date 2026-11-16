// Server-only live Indian market data proxy unifying:
// - BennyThadikaran/NseIndiaApi pattern (NSE cookie handshake + allIndices/quote-equity)
// - BennyThadikaran/BseIndiaApi pattern (BSE Sensex / scrip feed)
// - 0xramm/Indian-Stock-Market-API pattern (NSE .NS / BSE .BO / index chart & search feed)

export type MarketInstrument = {
  symbol: string;
  providerSymbol: string;
  nseSymbol?: string;
  bseCode?: string;
  name: string;
  exchange: "NSE" | "BSE";
  kind: "INDEX" | "EQUITY";
  lot: number;
};

export type MarketQuote = {
  symbol: string;
  providerSymbol: string;
  name: string;
  exchange: "NSE" | "BSE";
  kind: "INDEX" | "EQUITY";
  lot: number;
  ltp: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePct: number;
  volume: number;
  source: "NSE" | "BSE" | "NSE/Yahoo" | "BSE/Yahoo" | "Cache";
  marketStatus: "LIVE" | "CLOSED";
  updatedAt: string;
};

export type MarketCandle = {
  i: number;
  time: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const MARKET_INSTRUMENTS: MarketInstrument[] = [
  {
    symbol: "NIFTY",
    providerSymbol: "^NSEI",
    nseSymbol: "NIFTY 50",
    name: "NIFTY 50",
    exchange: "NSE",
    kind: "INDEX",
    lot: 75,
  },
  {
    symbol: "BANKNIFTY",
    providerSymbol: "^NSEBANK",
    nseSymbol: "NIFTY BANK",
    name: "BANK NIFTY",
    exchange: "NSE",
    kind: "INDEX",
    lot: 30,
  },
  {
    symbol: "SENSEX",
    providerSymbol: "^BSESN",
    bseCode: "SENSEX",
    name: "BSE SENSEX",
    exchange: "BSE",
    kind: "INDEX",
    lot: 20,
  },
  {
    symbol: "RELIANCE",
    providerSymbol: "RELIANCE.NS",
    nseSymbol: "RELIANCE",
    name: "Reliance Industries",
    exchange: "NSE",
    kind: "EQUITY",
    lot: 1,
  },
  {
    symbol: "HDFCBANK",
    providerSymbol: "HDFCBANK.NS",
    nseSymbol: "HDFCBANK",
    name: "HDFC Bank",
    exchange: "NSE",
    kind: "EQUITY",
    lot: 1,
  },
  {
    symbol: "TCS",
    providerSymbol: "TCS.NS",
    nseSymbol: "TCS",
    name: "Tata Consultancy Services",
    exchange: "NSE",
    kind: "EQUITY",
    lot: 1,
  },
  {
    symbol: "INFY",
    providerSymbol: "INFY.NS",
    nseSymbol: "INFY",
    name: "Infosys",
    exchange: "NSE",
    kind: "EQUITY",
    lot: 1,
  },
  {
    symbol: "ICICIBANK",
    providerSymbol: "ICICIBANK.NS",
    nseSymbol: "ICICIBANK",
    name: "ICICI Bank",
    exchange: "NSE",
    kind: "EQUITY",
    lot: 1,
  },
  {
    symbol: "SBIN",
    providerSymbol: "SBIN.NS",
    nseSymbol: "SBIN",
    name: "State Bank of India",
    exchange: "NSE",
    kind: "EQUITY",
    lot: 1,
  },
  {
    symbol: "TATAMOTORS",
    providerSymbol: "TATAMOTORS.NS",
    nseSymbol: "TATAMOTORS",
    name: "Tata Motors",
    exchange: "NSE",
    kind: "EQUITY",
    lot: 1,
  },
  {
    symbol: "ITC",
    providerSymbol: "ITC.NS",
    nseSymbol: "ITC",
    name: "ITC Limited",
    exchange: "NSE",
    kind: "EQUITY",
    lot: 1,
  },
  {
    symbol: "RELIANCE.BO",
    providerSymbol: "RELIANCE.BO",
    name: "Reliance Industries (BSE)",
    exchange: "BSE",
    kind: "EQUITY",
    lot: 1,
  },
  {
    symbol: "TCS.BO",
    providerSymbol: "TCS.BO",
    name: "TCS (BSE)",
    exchange: "BSE",
    kind: "EQUITY",
    lot: 1,
  },
];

const INSTRUMENT_MAP = new Map(MARKET_INSTRUMENTS.map((i) => [i.symbol.toUpperCase(), i]));

const QUOTE_TTL_MS = 6000;
const CANDLE_TTL_MS = 8000;
const quoteCache = new Map<string, { data: MarketQuote; ts: number }>();
const candleCache = new Map<
  string,
  { data: { quote: MarketQuote; candles: MarketCandle[] }; ts: number }
>();

let nseCookieCache: { cookie: string; ts: number } | null = null;
let nseBlockedUntil = 0;
let bseBlockedUntil = 0;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function getIndianMarketStatus(now = new Date()): "LIVE" | "CLOSED" {
  const istMs = now.getTime() + 5.5 * 3600 * 1000;
  const ist = new Date(istMs);
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return "CLOSED";
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30 ? "LIVE" : "CLOSED";
}

export function resolveInstrument(rawSymbol: string): MarketInstrument {
  const clean = String(rawSymbol || "NIFTY")
    .trim()
    .toUpperCase();
  const known = INSTRUMENT_MAP.get(clean);
  if (known) return known;
  if (clean.endsWith(".BO")) {
    return {
      symbol: clean,
      providerSymbol: clean,
      name: clean.replace(/\.BO$/, ""),
      exchange: "BSE",
      kind: "EQUITY",
      lot: 1,
    };
  }
  if (clean.endsWith(".NS")) {
    return {
      symbol: clean.replace(/\.NS$/, ""),
      providerSymbol: clean,
      nseSymbol: clean.replace(/\.NS$/, ""),
      name: clean.replace(/\.NS$/, ""),
      exchange: "NSE",
      kind: "EQUITY",
      lot: 1,
    };
  }
  return {
    symbol: clean,
    providerSymbol: `${clean}.NS`,
    nseSymbol: clean,
    name: clean,
    exchange: "NSE",
    kind: "EQUITY",
    lot: 1,
  };
}

async function getNseCookie(): Promise<string | null> {
  if (Date.now() < nseBlockedUntil) return null;
  if (nseCookieCache && Date.now() - nseCookieCache.ts < 4 * 60 * 1000) {
    return nseCookieCache.cookie;
  }
  try {
    const resp = await fetch("https://www.nseindia.com/", {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(1500),
    });
    if (!resp.ok) {
      nseBlockedUntil = Date.now() + 5 * 60 * 1000;
      return null;
    }
    const setCookies =
      typeof resp.headers.getSetCookie === "function"
        ? resp.headers.getSetCookie()
        : [resp.headers.get("set-cookie") || ""];
    const cookie = setCookies
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
    if (!cookie) {
      nseBlockedUntil = Date.now() + 5 * 60 * 1000;
      return null;
    }
    nseCookieCache = { cookie, ts: Date.now() };
    return cookie;
  } catch {
    nseBlockedUntil = Date.now() + 5 * 60 * 1000;
    return null;
  }
}

async function tryNseIndices(): Promise<Map<string, Partial<MarketQuote>>> {
  const out = new Map<string, Partial<MarketQuote>>();
  const cookie = await getNseCookie();
  if (!cookie) return out;
  try {
    const resp = await fetch("https://www.nseindia.com/api/allIndices", {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.nseindia.com/",
        Cookie: cookie,
      },
      signal: AbortSignal.timeout(1500),
    });
    if (!resp.ok) {
      nseBlockedUntil = Date.now() + 5 * 60 * 1000;
      return out;
    }
    const body = (await resp.json()) as { data?: Array<Record<string, unknown>> };
    for (const row of body.data || []) {
      const idx = String(row.index || "").toUpperCase();
      if (idx === "NIFTY 50" || idx === "NIFTY BANK") {
        const sym = idx === "NIFTY 50" ? "NIFTY" : "BANKNIFTY";
        const ltp = Number(row.last) || 0;
        const prevClose = Number(row.previousClose) || ltp;
        const change = Number(row.variation ?? ltp - prevClose) || 0;
        const changePct =
          Number(row.percentChange ?? (prevClose ? (change / prevClose) * 100 : 0)) || 0;
        if (ltp > 0) {
          out.set(sym, {
            ltp,
            prevClose,
            open: Number(row.open) || ltp,
            high: Number(row.high) || ltp,
            low: Number(row.low) || ltp,
            change,
            changePct,
            source: "NSE",
          });
        }
      }
    }
  } catch {
    nseBlockedUntil = Date.now() + 5 * 60 * 1000;
  }
  return out;
}

async function tryBseSensex(): Promise<Partial<MarketQuote> | null> {
  if (Date.now() < bseBlockedUntil) return null;
  try {
    const resp = await fetch("https://api.bseindia.com/RealTimeBseIndiaAPI/api/GetSensexData/w", {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.bseindia.com/",
      },
      signal: AbortSignal.timeout(1500),
    });
    if (!resp.ok) {
      bseBlockedUntil = Date.now() + 5 * 60 * 1000;
      return null;
    }
    const raw = (await resp.json()) as Array<Record<string, unknown>> | Record<string, unknown>;
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row) return null;
    const parseNum = (v: unknown) => Number(String(v ?? "").replace(/,/g, "")) || 0;
    const ltp = parseNum(row.ltp ?? row.CurrVal ?? row.currentValue);
    const prevClose = parseNum(row.prevClose ?? row.Prev_Close) || ltp;
    if (ltp <= 0) return null;
    const change = parseNum(row.chg ?? row.Chg) || ltp - prevClose;
    const changePct =
      parseNum(row.perChg ?? row.PcChg) || (prevClose ? (change / prevClose) * 100 : 0);
    return {
      ltp,
      prevClose,
      open: parseNum(row.open ?? row.Open) || ltp,
      high: parseNum(row.high ?? row.High) || ltp,
      low: parseNum(row.low ?? row.Low) || ltp,
      change,
      changePct,
      source: "BSE",
    };
  } catch {
    bseBlockedUntil = Date.now() + 5 * 60 * 1000;
    return null;
  }
}

const TF_CONFIG: Record<string, { interval: string; range: string }> = {
  "1m": { interval: "1m", range: "1d" },
  "5m": { interval: "5m", range: "1d" },
  "15m": { interval: "15m", range: "5d" },
  "1h": { interval: "60m", range: "1mo" },
  "1D": { interval: "1d", range: "6mo" },
};

function formatCandleLabel(tsSec: number, tf: string): string {
  const d = new Date(tsSec * 1000);
  if (tf === "1D") {
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      timeZone: "Asia/Kolkata",
    });
  }
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

async function fetchYahooChart(
  inst: MarketInstrument,
  tf = "5m",
): Promise<{ quote: MarketQuote; candles: MarketCandle[] } | null> {
  const cfg = TF_CONFIG[tf] || TF_CONFIG["5m"];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    inst.providerSymbol,
  )}?interval=${cfg.interval}&range=${cfg.range}`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(4500),
    });
    if (!resp.ok) return null;
    const payload = (await resp.json()) as {
      chart?: {
        result?: Array<{
          meta?: Record<string, unknown>;
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: Array<number | null>;
              high?: Array<number | null>;
              low?: Array<number | null>;
              close?: Array<number | null>;
              volume?: Array<number | null>;
            }>;
          };
        }>;
      };
    };
    const res = payload.chart?.result?.[0];
    if (!res?.meta) return null;
    const m = res.meta;
    const ts = res.timestamp || [];
    const q = res.indicators?.quote?.[0] || {};
    const candles: MarketCandle[] = [];
    let lastClose = Number(m.chartPreviousClose ?? m.previousClose ?? m.regularMarketPrice) || 0;
    for (let idx = 0; idx < ts.length; idx++) {
      const o = q.open?.[idx];
      const h = q.high?.[idx];
      const l = q.low?.[idx];
      const c = q.close?.[idx];
      if (o == null || h == null || l == null || c == null) continue;
      lastClose = c;
      candles.push({
        i: candles.length,
        time: ts[idx] ?? 0,
        label: formatCandleLabel(ts[idx] ?? 0, tf),
        open: +o.toFixed(2),
        high: +h.toFixed(2),
        low: +l.toFixed(2),
        close: +c.toFixed(2),
        volume: Number(q.volume?.[idx] ?? 0),
      });
    }
    const ltp = Number(m.regularMarketPrice) || lastClose;
    const prevClose = Number(m.previousClose ?? m.chartPreviousClose) || ltp;
    const change = Number(m.fulldayChange ?? ltp - prevClose);
    const changePct = Number(
      m.regularMarketChangePercent ??
        m.fulldayChangePercent ??
        (prevClose ? (change / prevClose) * 100 : 0),
    );
    const firstBar = candles[0];
    const quote: MarketQuote = {
      symbol: inst.symbol,
      providerSymbol: inst.providerSymbol,
      name: String(m.longName || m.shortName || inst.name),
      exchange: inst.exchange,
      kind: inst.kind,
      lot: inst.lot,
      ltp: +ltp.toFixed(2),
      prevClose: +prevClose.toFixed(2),
      open: +Number(firstBar?.open ?? ltp).toFixed(2),
      high: +Number(
        m.regularMarketDayHigh ?? (candles.length ? Math.max(...candles.map((b) => b.high)) : ltp),
      ).toFixed(2),
      low: +Number(
        m.regularMarketDayLow ?? (candles.length ? Math.min(...candles.map((b) => b.low)) : ltp),
      ).toFixed(2),
      change: +change.toFixed(2),
      changePct: +changePct.toFixed(2),
      volume: Number(m.regularMarketVolume ?? 0),
      source: inst.exchange === "BSE" ? "BSE/Yahoo" : "NSE/Yahoo",
      marketStatus: getIndianMarketStatus(),
      updatedAt: new Date().toISOString(),
    };
    return { quote, candles: candles.slice(-90) };
  } catch {
    return null;
  }
}

export async function getQuotes(rawSymbols?: string[]): Promise<{
  quotes: MarketQuote[];
  marketStatus: "LIVE" | "CLOSED";
  fetchedAt: string;
}> {
  const list =
    rawSymbols && rawSymbols.length
      ? rawSymbols.map((s) => resolveInstrument(s))
      : MARKET_INSTRUMENTS;

  const now = Date.now();
  const stale: MarketInstrument[] = [];
  const results = new Map<string, MarketQuote>();

  for (const inst of list) {
    const cached = quoteCache.get(inst.symbol);
    if (cached && now - cached.ts < QUOTE_TTL_MS) {
      results.set(inst.symbol, cached.data);
    } else {
      stale.push(inst);
    }
  }

  if (stale.length) {
    const wantsNseIdx = stale.some((i) => i.symbol === "NIFTY" || i.symbol === "BANKNIFTY");
    const wantsSensex = stale.some((i) => i.symbol === "SENSEX");

    const [nseMap, bseSensex] = await Promise.all([
      wantsNseIdx ? tryNseIndices() : Promise.resolve(new Map<string, Partial<MarketQuote>>()),
      wantsSensex ? tryBseSensex() : Promise.resolve(null),
    ]);

    await Promise.all(
      stale.map(async (inst) => {
        const direct = inst.symbol === "SENSEX" ? bseSensex : nseMap.get(inst.symbol);
        const chart = await fetchYahooChart(inst, "5m");
        if (chart) {
          const merged: MarketQuote = direct?.ltp
            ? {
                ...chart.quote,
                ...direct,
                ltp: +Number(direct.ltp).toFixed(2),
                change: +Number(direct.change ?? chart.quote.change).toFixed(2),
                changePct: +Number(direct.changePct ?? chart.quote.changePct).toFixed(2),
                source: direct.source || chart.quote.source,
                updatedAt: new Date().toISOString(),
              }
            : chart.quote;
          quoteCache.set(inst.symbol, { data: merged, ts: Date.now() });
          results.set(inst.symbol, merged);
          return;
        }
        if (direct?.ltp) {
          const q: MarketQuote = {
            symbol: inst.symbol,
            providerSymbol: inst.providerSymbol,
            name: inst.name,
            exchange: inst.exchange,
            kind: inst.kind,
            lot: inst.lot,
            ltp: +Number(direct.ltp).toFixed(2),
            prevClose: +Number(direct.prevClose ?? direct.ltp).toFixed(2),
            open: +Number(direct.open ?? direct.ltp).toFixed(2),
            high: +Number(direct.high ?? direct.ltp).toFixed(2),
            low: +Number(direct.low ?? direct.ltp).toFixed(2),
            change: +Number(direct.change ?? 0).toFixed(2),
            changePct: +Number(direct.changePct ?? 0).toFixed(2),
            volume: 0,
            source: direct.source || inst.exchange,
            marketStatus: getIndianMarketStatus(),
            updatedAt: new Date().toISOString(),
          };
          quoteCache.set(inst.symbol, { data: q, ts: Date.now() });
          results.set(inst.symbol, q);
          return;
        }
        const old = quoteCache.get(inst.symbol);
        if (old) {
          results.set(inst.symbol, { ...old.data, source: "Cache" });
        }
      }),
    );
  }

  return {
    quotes: list.map((i) => results.get(i.symbol)).filter((q): q is MarketQuote => !!q),
    marketStatus: getIndianMarketStatus(),
    fetchedAt: new Date().toISOString(),
  };
}

export async function getCandles(
  rawSymbol: string,
  tf = "5m",
): Promise<{
  symbol: string;
  tf: string;
  quote: MarketQuote | null;
  candles: MarketCandle[];
  marketStatus: "LIVE" | "CLOSED";
}> {
  const inst = resolveInstrument(rawSymbol);
  const normTf = TF_CONFIG[tf] ? tf : "5m";
  const key = `${inst.symbol}:${normTf}`;
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.ts < CANDLE_TTL_MS) {
    return {
      symbol: inst.symbol,
      tf: normTf,
      quote: cached.data.quote,
      candles: cached.data.candles,
      marketStatus: getIndianMarketStatus(),
    };
  }
  const fetched = await fetchYahooChart(inst, normTf);
  if (fetched) {
    candleCache.set(key, { data: fetched, ts: Date.now() });
    quoteCache.set(inst.symbol, { data: fetched.quote, ts: Date.now() });
    return {
      symbol: inst.symbol,
      tf: normTf,
      quote: fetched.quote,
      candles: fetched.candles,
      marketStatus: getIndianMarketStatus(),
    };
  }
  return {
    symbol: inst.symbol,
    tf: normTf,
    quote: quoteCache.get(inst.symbol)?.data ?? null,
    candles: cached?.data.candles ?? [],
    marketStatus: getIndianMarketStatus(),
  };
}

export async function searchSymbols(query: string): Promise<MarketInstrument[]> {
  const q = String(query || "").trim();
  if (!q) return MARKET_INSTRUMENTS;
  const upper = q.toUpperCase();
  const localMatches = MARKET_INSTRUMENTS.filter(
    (i) => i.symbol.includes(upper) || i.name.toUpperCase().includes(upper),
  );
  try {
    const resp = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&region=IN&lang=en-IN&quotesCount=10`,
      {
        headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
        signal: AbortSignal.timeout(3500),
      },
    );
    if (!resp.ok) return localMatches;
    const data = (await resp.json()) as {
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchange?: string;
        quoteType?: string;
      }>;
    };
    const seen = new Set(localMatches.map((m) => m.providerSymbol));
    const remote: MarketInstrument[] = [];
    for (const item of data.quotes || []) {
      const sym = String(item.symbol || "").toUpperCase();
      if (
        !sym.endsWith(".NS") &&
        !sym.endsWith(".BO") &&
        !sym.startsWith("^NSE") &&
        sym !== "^BSESN"
      ) {
        continue;
      }
      if (seen.has(sym)) continue;
      seen.add(sym);
      const isBse = sym.endsWith(".BO") || sym === "^BSESN";
      remote.push({
        symbol: sym.endsWith(".NS") ? sym.replace(/\.NS$/, "") : sym,
        providerSymbol: sym,
        name: String(item.longname || item.shortname || sym),
        exchange: isBse ? "BSE" : "NSE",
        kind: item.quoteType === "INDEX" ? "INDEX" : "EQUITY",
        lot: 1,
      });
    }
    return [...localMatches, ...remote].slice(0, 14);
  } catch {
    return localMatches;
  }
}
