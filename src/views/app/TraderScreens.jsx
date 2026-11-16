import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { toast } from "sonner";
import { formatINR, formatApiError } from "../../lib/api";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import {
  TIMEFRAMES,
  makeCandles,
  ACCOUNT,
  ACCOUNTS,
  evaluation,
  TRADES,
  POSITIONS,
  ORDERS,
  monthDays,
  NOTIFICATIONS,
} from "../../lib/demo-trading";
import {
  DEFAULT_MARKET_SYMBOLS,
  useLiveMarketQuotes,
  useLiveCandles,
  searchMarketSymbols,
  formatPrice,
} from "../../lib/useLiveMarket";
import { useTraderState } from "../../lib/useTraderState";
import {
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  Upload,
  CheckCircle2,
  Bell,
  ShieldAlert,
  TrendingUp,
  Target,
  CalendarDays,
  LifeBuoy,
  Send,
  Wallet,
  BadgeCheck,
  AlertTriangle,
  Activity,
  Search,
  RefreshCw,
  X,
  Radio,
} from "lucide-react";

/* ---------- shared bits ---------- */
export function SampleBadge() {
  return (
    <span className="sample-badge">
      <FlaskConical size={12} /> Sample data
    </span>
  );
}

export function LiveFeedBadge({ status }) {
  const isLive = status === "LIVE";
  return (
    <span className={`live-badge ${isLive ? "is-live" : "is-closed"}`}>
      <Radio size={11} /> {isLive ? "NSE/BSE Live" : "NSE/BSE Last Close"}
    </span>
  );
}

function PageHead({ title, sub, badge, children }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-3xl md:text-4xl">{title}</h1>
          {badge !== undefined ? badge : <SampleBadge />}
        </div>
        {sub && <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

const inr = (n) => formatINR(Math.round(Number(n) || 0));
const signed = (n) => `${n >= 0 ? "+" : "−"}${inr(Math.abs(n))}`;
const pnlCls = (n) => (n >= 0 ? "text-[var(--emerald)]" : "text-[var(--rose)]");

export function StatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  const tone = [
    "active",
    "executed",
    "paid",
    "funded",
    "approved",
    "open",
    "verified",
    "resolved",
  ].includes(s)
    ? "ok"
    : ["pending", "processing", "submitted", "in review", "under review"].includes(s)
      ? "wait"
      : ["failed", "rejected", "cancelled", "breached"].includes(s)
        ? "bad"
        : "neutral";
  return <span className={`status-pill is-${tone}`}>{status}</span>;
}

function Table({ cols, rows, empty = "Nothing here yet." }) {
  return (
    <div className="card-panel overflow-x-auto">
      <table className="w-full text-sm min-w-[640px] dash-table tabular-nums">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.k} className={c.right ? "text-right" : "text-left"}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={r.id || `${r.symbol || "row"}-${i}`}>
                {cols.map((c) => (
                  <td key={c.k} className={c.right ? "text-right" : ""}>
                    {c.render ? c.render(r) : r[c.k]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={cols.length} className="text-center text-[var(--muted)] py-10">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Meter({ label, value, max, money = true, warnAt = 0.7, sub }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const tone = pct >= 90 ? "bad" : pct >= warnAt * 100 ? "wait" : "ok";
  return (
    <div className="card-panel p-5 tabular-nums">
      <div className="flex justify-between text-xs text-[var(--muted-2)] uppercase tracking-wider font-mono">
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="font-display text-2xl mt-2">
        {money ? inr(value) : value}{" "}
        <span className="text-sm text-[var(--muted)]">/ {money ? inr(max) : max}</span>
      </div>
      <div className={`meter is-${tone}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      {sub && <div className="text-xs text-[var(--muted)] mt-2">{sub}</div>}
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, tone }) {
  return (
    <div className="card-panel p-5 tabular-nums">
      <div className="flex justify-between items-start">
        <div className="text-[10px] uppercase tracking-widest font-mono text-[var(--muted-2)]">
          {label}
        </div>
        {Icon && <Icon size={16} className="text-[var(--accent)]" />}
      </div>
      <div className={`font-display text-2xl md:text-3xl mt-3 ${tone || ""}`}>{value}</div>
      {sub && <div className="text-xs text-[var(--muted-2)] mt-1">{sub}</div>}
    </div>
  );
}

/* ---------- Interactive SVG candlestick chart with hover crosshair ---------- */
export function CandleChart({ candles, height = 340, loading = false, refreshing = false }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  if (loading && !candles.length) {
    return (
      <div className="candle-skeleton" style={{ height }}>
        <div className="text-xs font-mono text-[var(--muted-2)]">
          Loading live NSE/BSE candlesticks…
        </div>
      </div>
    );
  }
  if (!candles.length) {
    return (
      <div className="candle-skeleton" style={{ height }}>
        <div className="text-xs font-mono text-[var(--muted-2)]">
          No candle bars available for this interval.
        </div>
      </div>
    );
  }

  const W = 900;
  const H = height;
  const padTop = 18;
  const padBottom = 18;
  const padRight = 68;
  const plotW = W - padRight;
  const hi = Math.max(...candles.map((c) => c.high));
  const lo = Math.min(...candles.map((c) => c.low));
  const range = hi - lo || 1;
  const y = (v) => padTop + ((hi - v) / range) * (H - padTop - padBottom);
  const step = plotW / candles.length;
  const bw = Math.max(2.5, Math.min(14, step * 0.62));
  const last = candles[candles.length - 1];
  const hovered = hoverIdx != null && candles[hoverIdx] ? candles[hoverIdx] : null;
  const activeBar = hovered || last;

  const onMove = (e) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    if (clientX == null || !rect.width) return;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const idx = Math.max(0, Math.min(candles.length - 1, Math.floor(svgX / step)));
    setHoverIdx(idx);
  };

  return (
    <div className={`relative select-none ${refreshing ? "opacity-85 transition-opacity" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-[var(--muted-2)] mb-2 tabular-nums">
        <span>{activeBar.label || "Latest"}</span>
        <span>
          O <strong className="text-white">{formatPrice(activeBar.open)}</strong>
        </span>
        <span>
          H <strong className="text-[var(--emerald)]">{formatPrice(activeBar.high)}</strong>
        </span>
        <span>
          L <strong className="text-[var(--rose)]">{formatPrice(activeBar.low)}</strong>
        </span>
        <span>
          C{" "}
          <strong
            className={
              activeBar.close >= activeBar.open ? "text-[var(--emerald)]" : "text-[var(--rose)]"
            }
          >
            {formatPrice(activeBar.close)}
          </strong>
        </span>
        {activeBar.volume > 0 && (
          <span>
            Vol{" "}
            <strong className="text-white">
              {Number(activeBar.volume).toLocaleString("en-IN")}
            </strong>
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto candle-svg cursor-crosshair"
        role="img"
        aria-label="Live candlestick chart"
        onMouseMove={onMove}
        onTouchMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {[0.2, 0.5, 0.8].map((f) => {
          const py = H * f;
          const val = hi - ((py - padTop) / (H - padTop - padBottom)) * range;
          return (
            <g key={f}>
              <line x1="0" x2={plotW} y1={py} y2={py} className="grid-line" />
              <text x={plotW + 6} y={py + 4} className="chart-axis-text">
                {formatPrice(val)}
              </text>
            </g>
          );
        })}

        {candles.map((c, i) => {
          const up = c.close >= c.open;
          const x = i * step + step / 2;
          const isHover = hoverIdx === i;
          return (
            <g
              key={i}
              className={`${up ? "up" : "down"} ${isHover ? "opacity-100" : "opacity-90"}`}
            >
              <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} strokeWidth={isHover ? 1.8 : 1.1} />
              <rect
                x={x - bw / 2}
                width={bw}
                y={y(Math.max(c.open, c.close))}
                height={Math.max(1.5, Math.abs(y(c.open) - y(c.close)))}
                rx="1"
              />
            </g>
          );
        })}

        {hovered && (
          <>
            <line
              x1={hoverIdx * step + step / 2}
              x2={hoverIdx * step + step / 2}
              y1={0}
              y2={H}
              className="crosshair-line"
            />
            <line
              x1={0}
              x2={plotW}
              y1={y(hovered.close)}
              y2={y(hovered.close)}
              className="crosshair-line"
            />
          </>
        )}

        <line x1="0" x2={plotW} y1={y(last.close)} y2={y(last.close)} className="last-line" />
        <g transform={`translate(${plotW + 4}, ${Math.max(12, Math.min(H - 14, y(last.close)))})`}>
          <rect x="0" y="-10" width="62" height="20" rx="4" fill="var(--accent)" />
          <text x="31" y="4" textAnchor="middle" className="chart-ltp-badge">
            {formatPrice(last.close, 0)}
          </text>
        </g>
      </svg>
    </div>
  );
}

/* ---------- Trading terminal ---------- */
export function TradingTerminal() {
  const {
    authenticated,
    accounts,
    activeAccount,
    orders: liveOrders,
    positions: livePositions,
    trades: liveTrades,
    submitting,
    selectAccount,
    placeOrder,
    closePosition,
  } = useTraderState({ pollMs: 5000 });

  const [watchlistSymbols, setWatchlistSymbols] = useState(DEFAULT_MARKET_SYMBOLS);
  const [watchFilter, setWatchFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [sym, setSym] = useState("NIFTY");
  const [tf, setTf] = useState("5m");
  const [side, setSide] = useState("BUY");
  const [lots, setLots] = useState(1);
  const [type, setType] = useState("MARKET");
  const [limit, setLimit] = useState("");
  const [confirm, setConfirm] = useState(false);

  const [guestOrders, setGuestOrders] = useState(ORDERS);
  const [guestPositions, setGuestPositions] = useState(POSITIONS);

  const activeSymbols = useMemo(() => {
    const extra = livePositions.map((p) => p.symbol);
    return Array.from(new Set([...watchlistSymbols, sym, ...extra]));
  }, [watchlistSymbols, sym, livePositions]);

  const {
    quotes,
    quoteMap,
    marketStatus,
    flashMap,
    loading: quotesLoading,
    refresh: refreshQuotes,
  } = useLiveMarketQuotes(activeSymbols, { pollMs: 5000 });

  const {
    candles,
    quote: candleQuote,
    loading: candlesLoading,
    refreshing: candlesRefreshing,
  } = useLiveCandles(sym, tf, { pollMs: 8000 });

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const list = await searchMarketSymbols(q);
        setSearchResults(list);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const activeQuote = quoteMap[sym] || candleQuote;
  const lotSize = activeQuote?.lot || 1;
  const ltp = activeQuote?.ltp || candles[candles.length - 1]?.close || 0;
  const chgPct = activeQuote?.changePct ?? 0;
  const qty = Math.max(1, lots) * lotSize;
  const price = type === "MARKET" ? ltp : Number(limit) || ltp;
  const estMargin = +(price * qty * 0.2).toFixed(2);

  const filteredWatchQuotes = useMemo(() => {
    return quotes.filter((q) => {
      if (watchFilter === "INDEX") return q.kind === "INDEX";
      if (watchFilter === "EQUITY") return q.kind === "EQUITY";
      return true;
    });
  }, [quotes, watchFilter]);

  const ordersToShow = authenticated ? liveOrders : guestOrders;
  const rawPositions = authenticated ? livePositions : guestPositions;
  const positionsWithLiveMtm = useMemo(() => {
    return rawPositions.map((p) => {
      const liveLtp = quoteMap[p.symbol]?.ltp ?? p.ltp ?? p.avg;
      const mtm = +((liveLtp - p.avg) * p.qty).toFixed(2);
      return { ...p, ltp: +Number(liveLtp).toFixed(2), pnl: mtm };
    });
  }, [rawPositions, quoteMap]);
  const tradesToShow = authenticated ? liveTrades : TRADES;

  const pickSearchInstrument = (item) => {
    if (!watchlistSymbols.includes(item.symbol)) {
      setWatchlistSymbols((prev) => [item.symbol, ...prev]);
    }
    setSym(item.symbol);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSubmitOrder = async () => {
    if (!ltp) {
      toast.error("Waiting for live price before placing order.");
      return;
    }
    if (authenticated) {
      try {
        const res = await placeOrder({
          symbol: sym,
          side,
          qty,
          type,
          limit_price: type === "MARKET" ? undefined : price,
        });
        setConfirm(false);
        toast.success(`${side} ${qty} ${sym} — ${res?.order?.status?.toLowerCase() || "executed"}`);
      } catch (err) {
        toast.error(formatApiError(err?.response?.data?.detail, "Order failed"));
      }
      return;
    }
    const id = `O-${56000 + guestOrders.length}`;
    const status = type === "MARKET" ? "Executed" : "Pending";
    setGuestOrders([
      { id, symbol: sym, qty, type, side, price: +price.toFixed(2), date: "Just now", status },
      ...guestOrders,
    ]);
    if (status === "Executed") {
      const signedQty = side === "BUY" ? qty : -qty;
      setGuestPositions([
        {
          symbol: sym,
          qty: signedQty,
          avg: +price.toFixed(2),
          ltp: +ltp.toFixed(2),
          status: "Open",
          pnl: 0,
        },
        ...guestPositions,
      ]);
    }
    setConfirm(false);
    toast.success(`${side} ${qty} ${sym} — ${status.toLowerCase()} (guest preview)`);
  };

  const handleClosePosition = async (pos) => {
    if (authenticated && pos.id) {
      try {
        const res = await closePosition(pos.id);
        const realized = res?.trade?.pnl ?? 0;
        toast.success(
          `Closed ${pos.symbol} (${realized >= 0 ? "+" : "−"}${formatINR(Math.abs(realized))})`,
        );
      } catch (err) {
        toast.error(formatApiError(err?.response?.data?.detail, "Unable to square off position"));
      }
    } else {
      setGuestPositions((prev) => prev.filter((x) => x !== pos));
      toast.success(`Closed ${pos.symbol} (preview)`);
    }
  };

  return (
    <div>
      <PageHead
        title="Trading terminal"
        badge={<LiveFeedBadge status={marketStatus} />}
        sub="Real-time NSE & BSE quotes powered by Indian market feeds. Place simulated orders against your active trading account."
      >
        <button
          type="button"
          onClick={refreshQuotes}
          className="btn-ghost rounded-full px-4 py-2 text-xs inline-flex items-center gap-2"
        >
          <RefreshCw size={13} /> Refresh prices
        </button>
      </PageHead>

      {authenticated && activeAccount && (
        <div className="card-panel p-4 mb-5 flex flex-wrap items-center justify-between gap-4 tabular-nums">
          <div className="flex items-center gap-3 flex-wrap">
            <label
              htmlFor="acct-select"
              className="text-[11px] uppercase tracking-wider font-mono text-[var(--muted-2)]"
            >
              Account
            </label>
            <select
              id="acct-select"
              value={activeAccount.id}
              onChange={(e) => selectAccount(e.target.value)}
              className="input-dark !w-auto !py-1.5 !px-3 text-xs font-mono"
              data-testid="terminal-account-select"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_number || a.id} · {a.plan_name} ({a.account_type})
                </option>
              ))}
            </select>
            <StatusPill status={activeAccount.status} />
          </div>
          <div className="flex flex-wrap gap-5 text-xs">
            <div>
              <span className="text-[var(--muted-2)] block text-[10px] uppercase font-mono">
                Balance
              </span>
              <strong className="font-mono text-sm text-white">{inr(activeAccount.balance)}</strong>
            </div>
            <div>
              <span className="text-[var(--muted-2)] block text-[10px] uppercase font-mono">
                Avail margin
              </span>
              <strong className="font-mono text-sm text-[var(--emerald)]">
                {inr(activeAccount.available_margin)}
              </strong>
            </div>
            <div>
              <span className="text-[var(--muted-2)] block text-[10px] uppercase font-mono">
                Used margin
              </span>
              <strong className="font-mono text-sm">{inr(activeAccount.used_margin)}</strong>
            </div>
            <div>
              <span className="text-[var(--muted-2)] block text-[10px] uppercase font-mono">
                Realized P&L
              </span>
              <strong className={`font-mono text-sm ${pnlCls(activeAccount.realized_pnl || 0)}`}>
                {signed(activeAccount.realized_pnl || 0)}
              </strong>
            </div>
          </div>
        </div>
      )}

      <div className="terminal-layout">
        {/* Live NSE & BSE Watchlist */}
        <aside className="card-panel p-4 watchlist-panel" aria-label="NSE and BSE Watchlist">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]"
            />
            <input
              type="text"
              className="input-dark !pl-8 !pr-7 !py-2 text-xs"
              placeholder="Search NSE / BSE symbol…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="terminal-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-2)] hover:text-white"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {searchQuery.trim() ? (
            <div className="watchlist-scroll mt-3 divide-y divide-[var(--border)]">
              {searching ? (
                <div className="text-xs text-[var(--muted)] py-4 text-center">
                  Searching NSE & BSE…
                </div>
              ) : searchResults.length ? (
                searchResults.map((item) => (
                  <button
                    key={item.providerSymbol}
                    type="button"
                    onClick={() => pickSearchInstrument(item)}
                    className="watchlist-row w-full text-left"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-semibold text-white flex items-center gap-1.5">
                        {item.symbol}
                        <span className="text-[9px] text-[var(--muted-2)]">{item.exchange}</span>
                      </div>
                      <div className="text-[11px] text-[var(--muted-2)] truncate">{item.name}</div>
                    </div>
                    <span className="text-[11px] text-[var(--accent)] font-mono shrink-0">
                      + Add
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-xs text-[var(--muted)] py-4 text-center">
                  No matching NSE/BSE tickers.
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="seg w-full mt-3">
                {[
                  ["ALL", "All"],
                  ["INDEX", "Indices"],
                  ["EQUITY", "Stocks"],
                ].map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    className={`flex-1 ${watchFilter === k ? "is-on" : ""}`}
                    onClick={() => setWatchFilter(k)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <div className="watchlist-scroll mt-3 divide-y divide-[var(--border)]">
                {quotesLoading && !filteredWatchQuotes.length ? (
                  <div className="text-xs text-[var(--muted)] py-6 text-center">
                    Fetching live NSE & BSE quotes…
                  </div>
                ) : (
                  filteredWatchQuotes.map((q) => {
                    const active = q.symbol === sym;
                    const up = q.changePct >= 0;
                    const flash = flashMap[q.symbol];
                    return (
                      <button
                        key={q.symbol}
                        type="button"
                        onClick={() => setSym(q.symbol)}
                        data-testid={`watch-${q.symbol}`}
                        className={`watchlist-row w-full text-left tabular-nums ${active ? "is-selected" : ""} ${flash ? `tick-${flash}` : ""}`}
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-semibold text-white flex items-center gap-1.5">
                            {q.symbol}
                            <span className="text-[9px] text-[var(--muted-2)] font-normal">
                              {q.exchange}
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--muted-2)] truncate">{q.name}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-xs text-white">
                            {q.kind === "EQUITY" ? `₹${formatPrice(q.ltp)}` : formatPrice(q.ltp)}
                          </div>
                          <div
                            className={`text-[11px] font-mono ${up ? "text-[var(--emerald)]" : "text-[var(--rose)]"}`}
                          >
                            {up ? "+" : ""}
                            {q.changePct.toFixed(2)}%
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </aside>

        {/* Chart Area */}
        <div className="card-panel p-4 md:p-5 min-w-0">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl text-white">{activeQuote?.name || sym}</h2>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted-2)]">
                  {activeQuote?.exchange || "NSE"} · {activeQuote?.source || "Feed"}
                </span>
              </div>
              {activeQuote && (
                <div className="text-[11px] font-mono text-[var(--muted-2)] mt-0.5 tabular-nums">
                  Prev Close {formatPrice(activeQuote.prevClose)} · Day H{" "}
                  <span className="text-[var(--emerald)]">{formatPrice(activeQuote.high)}</span> ·
                  Day L <span className="text-[var(--rose)]">{formatPrice(activeQuote.low)}</span>
                </div>
              )}
            </div>
            <div className="seg" role="tablist" aria-label="Timeframe">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tf === t}
                  className={tf === t ? "is-on" : ""}
                  onClick={() => setTf(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-baseline gap-3 mt-4 tabular-nums">
            <div
              className={`font-display text-3xl ${flashMap[sym] ? `tick-text-${flashMap[sym]}` : ""}`}
            >
              {ltp
                ? activeQuote?.kind === "EQUITY"
                  ? `₹${formatPrice(ltp)}`
                  : formatPrice(ltp)
                : "—"}
            </div>
            {activeQuote && (
              <div className={`text-sm font-mono ${pnlCls(chgPct)}`}>
                {activeQuote.change >= 0 ? "+" : ""}
                {formatPrice(activeQuote.change)} ({chgPct >= 0 ? "+" : ""}
                {chgPct.toFixed(2)}%)
              </div>
            )}
          </div>

          <div className="mt-3">
            <CandleChart
              candles={candles}
              loading={candlesLoading}
              refreshing={candlesRefreshing}
            />
          </div>
        </div>

        {/* Order Execution Ticket */}
        <div className="card-panel p-5 order-panel tabular-nums">
          <div className="seg w-full" role="tablist" aria-label="Side">
            {["BUY", "SELL"].map((s) => (
              <button
                key={s}
                type="button"
                className={`flex-1 ${side === s ? (s === "BUY" ? "is-buy" : "is-sell") : ""}`}
                onClick={() => setSide(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <label className="dash-label">Order type</label>
          <div className="seg w-full">
            {["MARKET", "LIMIT", "SL"].map((t) => (
              <button
                key={t}
                type="button"
                className={`flex-1 ${type === t ? "is-on" : ""}`}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <label className="dash-label" htmlFor="lots">
            {lotSize > 1 ? `Lots (1 lot = ${lotSize} qty)` : "Quantity (shares)"}
          </label>
          <div className="qty">
            <button
              type="button"
              onClick={() => setLots(Math.max(1, lots - 1))}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <input
              id="lots"
              type="number"
              min="1"
              max="500"
              value={lots}
              onChange={(e) => setLots(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
            />
            <button
              type="button"
              onClick={() => setLots(Math.min(500, lots + 1))}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          {type !== "MARKET" && (
            <>
              <label className="dash-label" htmlFor="px">
                {type === "SL" ? "Trigger price" : "Limit price"}
              </label>
              <input
                id="px"
                className="input-dark"
                inputMode="decimal"
                placeholder={ltp ? ltp.toFixed(2) : "0.00"}
                value={limit}
                onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </>
          )}

          <div className="order-summary">
            <div>
              <span>Instrument</span>
              <strong>{sym}</strong>
            </div>
            <div>
              <span>Total Qty</span>
              <strong>{qty}</strong>
            </div>
            <div>
              <span>Est. Price</span>
              <strong>{price ? formatPrice(price) : "—"}</strong>
            </div>
            <div>
              <span>Margin req (20%)</span>
              <strong>{inr(estMargin)}</strong>
            </div>
            {authenticated && activeAccount && (
              <div>
                <span>Avail. Margin</span>
                <strong
                  className={
                    estMargin > activeAccount.available_margin
                      ? "text-[var(--rose)]"
                      : "text-[var(--emerald)]"
                  }
                >
                  {inr(activeAccount.available_margin)}
                </strong>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!ltp || submitting}
            className={`w-full rounded-full py-3 font-semibold mt-2 disabled:opacity-50 ${side === "BUY" ? "btn-buy" : "btn-sell"}`}
            onClick={() => setConfirm(true)}
            data-testid="terminal-place-btn"
          >
            {side} {sym}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div>
          <h2 className="font-display text-xl mb-3">
            Open positions ({positionsWithLiveMtm.length})
          </h2>
          <PositionsTable rows={positionsWithLiveMtm} onClose={handleClosePosition} />
        </div>
        <div>
          <h2 className="font-display text-xl mb-3">Recent orders ({ordersToShow.length})</h2>
          <OrdersTable rows={ordersToShow.slice(0, 6)} />
        </div>
      </div>

      <h2 className="font-display text-xl mt-8 mb-3">Recent trades</h2>
      <TradesTable rows={tradesToShow.slice(0, 6)} />

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-w-sm bg-[var(--bg-2)] border-[var(--border)] text-white">
          <DialogTitle>Confirm {side.toLowerCase()} order</DialogTitle>
          <DialogDescription>
            {authenticated
              ? `Executes simulated order on account ${activeAccount?.account_number || activeAccount?.id || "wallet"}.`
              : "Preview order — sign in to save trades to your account."}
          </DialogDescription>
          <div className="order-summary tabular-nums">
            <div>
              <span>Instrument</span>
              <strong>
                {sym} ({activeQuote?.exchange || "NSE"})
              </strong>
            </div>
            <div>
              <span>Type</span>
              <strong>{type}</strong>
            </div>
            <div>
              <span>Quantity</span>
              <strong>{qty}</strong>
            </div>
            <div>
              <span>Execution price</span>
              <strong>{formatPrice(price)}</strong>
            </div>
            <div>
              <span>Margin required</span>
              <strong>{inr(estMargin)}</strong>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="flex-1 rounded-full py-2.5 border border-[var(--border-hi)]"
              onClick={() => setConfirm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              className={`flex-1 rounded-full py-2.5 font-semibold disabled:opacity-50 ${side === "BUY" ? "btn-buy" : "btn-sell"}`}
              onClick={handleSubmitOrder}
              data-testid="terminal-confirm-btn"
            >
              {submitting ? "Placing…" : "Place order"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- tables ---------- */
function TradesTable({ rows }) {
  return (
    <Table
      rows={rows}
      empty="No closed trades yet."
      cols={[
        {
          k: "id",
          label: "Trade ID",
          render: (r) => <span className="font-mono text-xs">{r.id}</span>,
        },
        { k: "symbol", label: "Instrument" },
        {
          k: "side",
          label: "Side",
          render: (r) => (
            <span className={r.side === "BUY" ? "text-[var(--emerald)]" : "text-[var(--rose)]"}>
              {r.side}
            </span>
          ),
        },
        { k: "entry", label: "Entry", right: true, render: (r) => formatPrice(r.entry) },
        { k: "exit", label: "Exit", right: true, render: (r) => formatPrice(r.exit) },
        { k: "qty", label: "Qty", right: true },
        {
          k: "in",
          label: "Entry time",
          render: (r) =>
            String(r.in || "")
              .slice(0, 16)
              .replace("T", " "),
        },
        {
          k: "out",
          label: "Exit time",
          render: (r) =>
            String(r.out || "")
              .slice(0, 16)
              .replace("T", " "),
        },
        {
          k: "pnl",
          label: "P&L",
          right: true,
          render: (r) => <span className={pnlCls(r.pnl)}>{signed(r.pnl)}</span>,
        },
      ]}
    />
  );
}

function PositionsTable({ rows, onClose }) {
  const cols = [
    { k: "symbol", label: "Instrument" },
    {
      k: "qty",
      label: "Qty",
      right: true,
      render: (r) => (
        <span className={r.qty >= 0 ? "text-[var(--emerald)]" : "text-[var(--rose)]"}>{r.qty}</span>
      ),
    },
    { k: "avg", label: "Avg entry", right: true, render: (r) => formatPrice(r.avg) },
    { k: "ltp", label: "Live LTP", right: true, render: (r) => formatPrice(r.ltp) },
    {
      k: "pnl",
      label: "MTM P&L",
      right: true,
      render: (r) => <span className={pnlCls(r.pnl)}>{signed(r.pnl)}</span>,
    },
    { k: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];
  if (onClose) {
    cols.push({
      k: "act",
      label: "",
      right: true,
      render: (r) => (
        <button
          type="button"
          onClick={() => onClose(r)}
          className="btn-ghost px-3 py-1 rounded-full text-xs text-[var(--rose)]"
        >
          Square off
        </button>
      ),
    });
  }
  return <Table rows={rows} empty="No open positions." cols={cols} />;
}

function OrdersTable({ rows }) {
  return (
    <Table
      rows={rows}
      empty="No orders placed yet."
      cols={[
        {
          k: "id",
          label: "Order ID",
          render: (r) => <span className="font-mono text-xs">{r.id}</span>,
        },
        { k: "symbol", label: "Instrument" },
        {
          k: "side",
          label: "Side",
          render: (r) => (
            <span className={r.side === "BUY" ? "text-[var(--emerald)]" : "text-[var(--rose)]"}>
              {r.side}
            </span>
          ),
        },
        { k: "qty", label: "Qty", right: true },
        { k: "type", label: "Type" },
        { k: "price", label: "Price", right: true, render: (r) => formatPrice(r.price) },
        {
          k: "date",
          label: "Date",
          render: (r) =>
            String(r.date || "")
              .slice(0, 16)
              .replace("T", " "),
        },
        { k: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
      ]}
    />
  );
}

export function TradeBook() {
  const { authenticated, trades } = useTraderState({ pollMs: 8000 });
  const [q, setQ] = useState("");
  const baseRows = authenticated ? trades : TRADES;
  const rows = baseRows.filter((t) => !q || t.symbol.includes(q));
  const total = rows.reduce((s, t) => s + Number(t.pnl || 0), 0);
  return (
    <div>
      <PageHead
        title="Trade book"
        badge={authenticated ? null : <SampleBadge />}
        sub="Every closed trade with entry, exit and realized P&L."
      >
        <div className="seg">
          {["", "NIFTY", "BANKNIFTY", "SENSEX", "RELIANCE"].map((s) => (
            <button key={s || "all"} className={q === s ? "is-on" : ""} onClick={() => setQ(s)}>
              {s || "All"}
            </button>
          ))}
        </div>
      </PageHead>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Kpi label="Trades" value={rows.length} icon={Activity} />
        <Kpi
          label="Winning trades"
          value={rows.filter((t) => t.pnl > 0).length}
          icon={TrendingUp}
        />
        <Kpi label="Net P&L" value={signed(total)} tone={pnlCls(total)} icon={Wallet} />
      </div>
      <TradesTable rows={rows} />
    </div>
  );
}

export function Positions() {
  const { authenticated, positions, closePosition } = useTraderState({ pollMs: 5000 });
  const raw = authenticated ? positions : POSITIONS;
  const symbols = useMemo(() => {
    const set = new Set(["NIFTY", "BANKNIFTY", ...raw.map((p) => p.symbol)]);
    return Array.from(set);
  }, [raw]);
  const { quoteMap, marketStatus } = useLiveMarketQuotes(symbols, { pollMs: 5000 });
  const liveRows = useMemo(
    () =>
      raw.map((p) => {
        const ltp = quoteMap[p.symbol]?.ltp ?? p.ltp ?? p.avg;
        const pnl = +((ltp - p.avg) * p.qty).toFixed(2);
        return { ...p, ltp: +Number(ltp).toFixed(2), pnl };
      }),
    [raw, quoteMap],
  );
  const total = liveRows.reduce((s, p) => s + p.pnl, 0);

  const handleClose = async (pos) => {
    if (!authenticated || !pos.id) return;
    try {
      await closePosition(pos.id);
      toast.success(`Closed ${pos.symbol}`);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail, "Square off failed"));
    }
  };

  return (
    <div>
      <PageHead
        title="Positions"
        badge={<LiveFeedBadge status={marketStatus} />}
        sub="Open positions with live MTM P&L marked to real NSE & BSE prices."
      />
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Kpi label="Open positions" value={liveRows.length} icon={Activity} />
        <Kpi label="Unrealised P&L" value={signed(total)} tone={pnlCls(total)} icon={TrendingUp} />
      </div>
      <PositionsTable rows={liveRows} onClose={authenticated ? handleClose : null} />
    </div>
  );
}

export function Orders() {
  const { authenticated, orders } = useTraderState({ pollMs: 6000 });
  const [f, setF] = useState("All");
  const baseRows = authenticated ? orders : ORDERS;
  const rows = baseRows.filter((o) => f === "All" || o.status === f);
  return (
    <div>
      <PageHead
        title="Orders"
        badge={authenticated ? null : <SampleBadge />}
        sub="All orders placed on your trading account."
      >
        <div className="seg">
          {["All", "Executed", "Pending", "Cancelled"].map((s) => (
            <button key={s} className={f === s ? "is-on" : ""} onClick={() => setF(s)}>
              {s}
            </button>
          ))}
        </div>
      </PageHead>
      <OrdersTable rows={rows} />
    </div>
  );
}

/* ---------- Evaluation ---------- */
export function EvaluationProgress() {
  const { authenticated, activeAccount, trades } = useTraderState({ pollMs: 8000 });
  const useLive = authenticated && activeAccount;
  const cap = useLive ? Number(activeAccount.starting_capital || 100000) : ACCOUNT.starting_capital;
  const bal = useLive ? Number(activeAccount.balance || cap) : ACCOUNT.balance;
  const target = useLive ? Math.round(cap * 0.08) : ACCOUNT.profit_target;
  const wins = useLive ? trades.filter((t) => t.pnl > 0).length : 0;
  const accPct = useLive
    ? trades.length
      ? Math.round((wins / trades.length) * 100)
      : 0
    : ACCOUNT.accuracy;
  const a = useLive
    ? {
        ...ACCOUNT,
        account_id: activeAccount.account_number || activeAccount.id,
        product: `${activeAccount.plan_name} (${activeAccount.account_type})`,
        starting_capital: cap,
        balance: bal,
        profit_target: target,
        trading_days_done: Math.min(
          10,
          new Set(trades.map((t) => String(t.created_at || "").slice(0, 10))).size,
        ),
        accuracy: accPct,
        status: activeAccount.status,
      }
    : ACCOUNT;
  const e = evaluation(a);

  return (
    <div>
      <PageHead
        title="Evaluation progress"
        badge={useLive ? null : <SampleBadge />}
        sub={`${a.product} · ${a.account_id}`}
      >
        <StatusPill status={a.status} />
      </PageHead>
      <div className="card-panel p-6 md:p-8 eval-hero">
        <div className="ring" style={{ "--p": e.progress }}>
          <span className="font-display tabular-nums">{e.progress}%</span>
          <small>of target</small>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 flex-1">
          <Kpi label="Profit target (8%)" value={inr(a.profit_target)} icon={Target} />
          <Kpi label="Current P&L" value={signed(e.pnl)} tone={pnlCls(e.pnl)} icon={TrendingUp} />
          <Kpi label="Remaining target" value={inr(e.remaining_target)} icon={Target} />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <Meter
          label="Trading days"
          value={a.trading_days_done}
          max={a.min_trading_days}
          money={false}
          warnAt={2}
          sub={`${e.remaining_days} more days needed`}
        />
        <Meter
          label="Days elapsed"
          value={a.days_elapsed}
          max={a.total_days}
          money={false}
          sub={`${a.total_days - a.days_elapsed} days remaining`}
        />
        <Kpi
          label="Accuracy"
          value={`${a.accuracy}%`}
          sub="Winning trades / total trades"
          icon={BadgeCheck}
        />
      </div>
    </div>
  );
}

/* ---------- Risk ---------- */
export function RiskManagement() {
  const { authenticated, activeAccount, orders } = useTraderState({ pollMs: 8000 });
  const useLive = authenticated && activeAccount;
  const cap = useLive ? Number(activeAccount.starting_capital || 100000) : ACCOUNT.starting_capital;
  const bal = useLive ? Number(activeAccount.balance || cap) : ACCOUNT.balance;
  const maxLossPct = useLive ? Number(activeAccount.max_loss_limit || 20) : 10;
  const overallLimit = useLive ? Math.round((cap * maxLossPct) / 100) : ACCOUNT.overall_loss_limit;
  const dailyLimit = useLive ? Math.round(cap * 0.05) : ACCOUNT.daily_loss_limit;
  const ddUsed = useLive ? Math.max(0, cap - bal) : ACCOUNT.max_drawdown_used;
  const todayStr = new Date().toISOString().slice(0, 10);
  const tradesToday = useLive
    ? orders.filter((o) => String(o.created_at || "").startsWith(todayStr)).length
    : ACCOUNT.trades_today;
  const maxTrades = useLive
    ? Number(activeAccount.trades_per_day || 10)
    : ACCOUNT.max_trades_per_day;

  const a = useLive
    ? {
        ...ACCOUNT,
        starting_capital: cap,
        daily_loss_limit: dailyLimit,
        daily_loss_used: Math.min(dailyLimit, ddUsed),
        overall_loss_limit: overallLimit,
        max_drawdown_used: ddUsed,
        trades_today: tradesToday,
        max_trades_per_day: maxTrades,
      }
    : ACCOUNT;
  const e = evaluation(a);
  const rules = [
    { t: "Daily loss within limit", ok: a.daily_loss_used < a.daily_loss_limit },
    { t: "Overall loss within limit", ok: a.max_drawdown_used < a.overall_loss_limit },
    { t: "Trades per day within limit", ok: a.trades_today <= a.max_trades_per_day },
    { t: "Margin utilization healthy", ok: !useLive || activeAccount.available_margin >= 0 },
  ];
  return (
    <div>
      <PageHead
        title="Risk management"
        badge={useLive ? null : <SampleBadge />}
        sub="Your loss limits and rule compliance, updated live as you trade."
      />
      <div className="grid md:grid-cols-2 gap-4">
        <Meter
          label="Daily loss used"
          value={a.daily_loss_used}
          max={a.daily_loss_limit}
          sub={`${inr(e.daily_loss_left)} left today`}
        />
        <Meter
          label="Overall loss / drawdown"
          value={a.max_drawdown_used}
          max={a.overall_loss_limit}
          sub={`${inr(e.overall_loss_left)} remaining allowance · ${e.drawdown_pct}% drawdown`}
        />
        <Meter
          label="Trades today"
          value={a.trades_today}
          max={a.max_trades_per_day}
          money={false}
          sub={`${e.trades_left} trades left`}
        />
        <div className="card-panel p-5">
          <div className="text-xs text-[var(--muted-2)] uppercase tracking-wider font-mono mb-3">
            Rule compliance
          </div>
          <ul className="space-y-2 text-sm">
            {rules.map((r) => (
              <li key={r.t} className="flex items-center gap-2">
                {r.ok ? (
                  <CheckCircle2 size={16} className="text-[var(--emerald)]" />
                ) : (
                  <AlertTriangle size={16} className="text-[var(--rose)]" />
                )}
                {r.t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- Calendar ---------- */
export function TradingCalendar() {
  const [m, setM] = useState(10);
  const year = 2026;
  const days = monthDays(year, m);
  const lead = new Date(year, m, 1).getDay();
  const traded = days.filter((d) => d.pnl !== null && d.pnl !== 0);
  const total = traded.reduce((s, d) => s + d.pnl, 0);
  return (
    <div>
      <PageHead title="Trading calendar" sub="Daily P&L at a glance.">
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost rounded-full p-2"
            onClick={() => setM((v) => Math.max(0, v - 1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="font-display text-lg w-40 text-center">
            {new Date(year, m, 1).toLocaleString("en-IN", { month: "long", year: "numeric" })}
          </div>
          <button
            className="btn-ghost rounded-full p-2"
            onClick={() => setM((v) => Math.min(11, v + 1))}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </PageHead>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi
          label="Profitable days"
          value={traded.filter((d) => d.pnl > 0).length}
          tone="text-[var(--emerald)]"
        />
        <Kpi
          label="Losing days"
          value={traded.filter((d) => d.pnl < 0).length}
          tone="text-[var(--rose)]"
        />
        <Kpi label="No-trade days" value={days.filter((d) => d.pnl === 0).length} />
        <Kpi label="Month P&L" value={signed(total)} tone={pnlCls(total)} />
      </div>
      <div className="cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="cal-head">
            {d}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {days.map((d) => (
          <div
            key={d.day}
            className={`cal-day ${d.pnl === null ? "is-off" : d.pnl > 0 ? "is-up" : d.pnl < 0 ? "is-down" : "is-flat"}`}
          >
            <span>{d.day}</span>
            {d.pnl !== null && (
              <strong>
                {d.pnl === 0
                  ? "—"
                  : `${d.pnl > 0 ? "+" : "−"}${Math.abs(d.pnl).toLocaleString("en-IN")}`}
              </strong>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Funded account ---------- */
export function FundedAccount() {
  const { authenticated, accounts } = useTraderState({ pollMs: 6000 });
  const liveFunded = authenticated ? accounts.find((a) => a.status === "Funded") : null;
  const f = liveFunded
    ? {
        id: liveFunded.account_number || liveFunded.id,
        size: liveFunded.starting_capital,
        balance: liveFunded.balance,
        pnl: liveFunded.realized_pnl || 0,
        profit_split: liveFunded.profit_split || 70,
        loss_limit: Math.round(
          (liveFunded.starting_capital * (liveFunded.max_loss_limit || 20)) / 100,
        ),
        start: String(liveFunded.created_at || "").slice(0, 10) || "Active",
      }
    : {
        ...ACCOUNTS.find((a) => a.status === "Funded"),
        profit_split: ACCOUNT.profit_split,
        loss_limit: ACCOUNT.overall_loss_limit,
      };
  const share = Math.max(0, f.pnl) * ((f.profit_split || 70) / 100);
  return (
    <div>
      <PageHead
        title="Funded account"
        badge={liveFunded ? null : <SampleBadge />}
        sub={`${f.id} · started ${f.start}`}
      >
        <StatusPill status="Funded" />
      </PageHead>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="Account size" value={inr(f.size)} icon={Wallet} />
        <Kpi label="Balance" value={inr(f.balance)} icon={Wallet} />
        <Kpi label="P&L" value={signed(f.pnl)} tone={pnlCls(f.pnl)} icon={TrendingUp} />
        <Kpi label="Profit split" value={`${f.profit_split}%`} icon={BadgeCheck} />
        <Kpi label="Overall loss limit" value={inr(f.loss_limit)} icon={ShieldAlert} />
        <Kpi
          label="Your share (if paid now)"
          value={inr(share)}
          tone="text-[var(--emerald)]"
          icon={Wallet}
        />
      </div>
      <div className="card-panel p-6 mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-display text-xl">Ready to withdraw?</div>
          <p className="text-sm text-[var(--muted)] mt-1">
            Payouts are processed after KYC verification.
          </p>
        </div>
        <Link to="/app/payouts" className="btn-amber rounded-full px-5 py-2.5 text-sm">
          Request payout
        </Link>
      </div>
    </div>
  );
}

/* ---------- KYC ---------- */
export function Kyc() {
  const [form, setForm] = useState({ aadhaar: "", pan: "", bank: "", ifsc: "", holder: "" });
  const [files, setFiles] = useState({});
  const [status, setStatus] = useState("Not submitted");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const docs = [
    ["aadhaar_doc", "Aadhaar (front & back)"],
    ["pan_doc", "PAN card"],
    ["bank_doc", "Cancelled cheque / bank statement"],
  ];
  const valid =
    /^\d{12}$/.test(form.aadhaar.replace(/\s/g, "")) &&
    /^[A-Z]{5}\d{4}[A-Z]$/.test(form.pan.toUpperCase()) &&
    form.bank.length >= 6 &&
    /^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.toUpperCase()) &&
    form.holder.trim();
  const submit = (e) => {
    e.preventDefault();
    if (!valid)
      return toast.error(
        "Please check the Aadhaar (12 digits), PAN (ABCDE1234F), account number and IFSC.",
      );
    if (docs.some(([k]) => !files[k])) return toast.error("Please attach all three documents.");
    setStatus("Under review");
    toast.success("KYC submitted (sample) — nothing was uploaded.");
  };
  const steps = [
    ["Submitted", status !== "Not submitted"],
    ["Under review", status === "Under review" || status === "Verified"],
    ["Verified", status === "Verified"],
  ];
  return (
    <div>
      <PageHead
        title="KYC verification"
        sub="Needed before your first payout. This screen is a preview — documents are not uploaded."
      >
        <StatusPill status={status} />
      </PageHead>
      <div className="kyc-steps mb-6">
        {steps.map(([t, on], i) => (
          <div key={t} className={on ? "is-on" : ""}>
            <span>{on ? <CheckCircle2 size={16} /> : i + 1}</span>
            {t}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="grid lg:grid-cols-2 gap-6">
        <div className="card-panel p-6 space-y-4">
          <div className="font-display text-lg">Identity & bank details</div>
          {[
            ["aadhaar", "Aadhaar number", "1234 5678 9012"],
            ["pan", "PAN", "ABCDE1234F"],
            ["holder", "Account holder name", "As per bank"],
            ["bank", "Bank account number", ""],
            ["ifsc", "IFSC", "SBIN0001234"],
          ].map(([k, l, ph]) => (
            <div key={k}>
              <label className="dash-label" htmlFor={`kyc-${k}`}>
                {l}
              </label>
              <input
                id={`kyc-${k}`}
                className="input-dark"
                placeholder={ph}
                value={form[k]}
                onChange={set(k)}
                maxLength={k === "aadhaar" ? 14 : 34}
                autoComplete="off"
              />
            </div>
          ))}
        </div>
        <div className="card-panel p-6 space-y-4">
          <div className="font-display text-lg">Documents</div>
          {docs.map(([k, l]) => (
            <label key={k} className={`upload-box ${files[k] ? "has-file" : ""}`}>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => setFiles({ ...files, [k]: e.target.files?.[0]?.name })}
              />
              {files[k] ? <CheckCircle2 size={18} /> : <Upload size={18} />}
              <div>
                <strong>{l}</strong>
                <small>{files[k] || "JPG, PNG or PDF"}</small>
              </div>
            </label>
          ))}
          <button
            type="submit"
            className="btn-amber rounded-full w-full py-3 text-sm"
            disabled={status === "Under review"}
          >
            {status === "Under review" ? "Submitted" : "Submit for verification"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Notifications ---------- */
export function Notifications() {
  const [read, setRead] = useState([]);
  const icon = { risk: ShieldAlert, trade: Activity, progress: Target, kyc: BadgeCheck };
  return (
    <div>
      <PageHead title="Notifications" sub="Risk alerts, order updates and account news.">
        <button
          className="btn-ghost rounded-full px-4 py-2 text-xs"
          onClick={() => setRead(NOTIFICATIONS.map((n) => n.id))}
        >
          Mark all read
        </button>
      </PageHead>
      <ul className="space-y-3">
        {NOTIFICATIONS.map((n) => {
          const Icon = icon[n.kind] || Bell;
          const unread = !read.includes(n.id);
          return (
            <li
              key={n.id}
              className={`card-panel p-4 flex gap-4 items-start notif ${unread ? "is-unread" : ""}`}
              onClick={() => setRead([...read, n.id])}
            >
              <span className="notif-icon">
                <Icon size={17} />
              </span>
              <div className="flex-1">
                <div className="flex justify-between gap-3">
                  <strong className="text-sm">{n.t}</strong>
                  <small className="text-[var(--muted-2)]">{n.time}</small>
                </div>
                <p className="text-sm text-[var(--muted)] mt-1">{n.d}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Support ---------- */
export function Support() {
  const [tickets, setTickets] = useState([
    {
      id: "TK-SAMPLE-301",
      subject: "Trading day not counted",
      status: "Resolved",
      date: "2026-10-28",
    },
    {
      id: "TK-SAMPLE-318",
      subject: "Payout timeline question",
      status: "Pending",
      date: "2026-11-02",
    },
  ]);
  const [form, setForm] = useState({ subject: "", category: "Account", message: "" });
  const submit = (e) => {
    e.preventDefault();
    if (form.subject.trim().length < 4 || form.message.trim().length < 10)
      return toast.error("Please add a subject and a short description.");
    setTickets([
      {
        id: `TK-SAMPLE-${330 + tickets.length}`,
        subject: form.subject.trim().slice(0, 120),
        status: "Pending",
        date: "Today",
      },
      ...tickets,
    ]);
    setForm({ subject: "", category: "Account", message: "" });
    toast.success("Ticket created (sample). For urgent help use WhatsApp or email.");
  };
  return (
    <div>
      <PageHead title="Support" sub="Raise a ticket or reach the team directly." />
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        <form onSubmit={submit} className="card-panel p-6 space-y-4">
          <div className="font-display text-lg flex items-center gap-2">
            <LifeBuoy size={18} /> New ticket
          </div>
          <div>
            <label className="dash-label" htmlFor="tk-cat">
              Category
            </label>
            <select
              id="tk-cat"
              className="input-dark"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {["Account", "Trading", "Payouts", "KYC", "Other"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="dash-label" htmlFor="tk-sub">
              Subject
            </label>
            <input
              id="tk-sub"
              className="input-dark"
              maxLength={120}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div>
            <label className="dash-label" htmlFor="tk-msg">
              Message
            </label>
            <textarea
              id="tk-msg"
              rows={5}
              className="input-dark"
              maxLength={2000}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </div>
          <button className="btn-amber rounded-full w-full py-3 text-sm inline-flex items-center justify-center gap-2">
            <Send size={15} /> Submit ticket
          </button>
        </form>
        <div>
          <h2 className="font-display text-xl mb-3">Your tickets</h2>
          <Table
            rows={tickets}
            cols={[
              {
                k: "id",
                label: "Ticket",
                render: (r) => <span className="font-mono text-xs">{r.id}</span>,
              },
              { k: "subject", label: "Subject" },
              { k: "date", label: "Date" },
              { k: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- My accounts (live filterable overview + sample fallback) ---------- */
export function SampleAccounts() {
  const { authenticated, accounts } = useTraderState({ pollMs: 8000 });
  const [f, setF] = useState("All");
  const useLive = authenticated && accounts.length > 0;
  const sourceList = useLive
    ? accounts.map((a) => ({
        id: a.account_number || a.id,
        product: `${a.plan_name} (${a.account_type || "Challenge"})`,
        size: a.starting_capital,
        balance: a.balance,
        equity: a.balance,
        pnl: a.realized_pnl || 0,
        start: String(a.created_at || "").slice(0, 10) || "—",
        expiry: "—",
        status: a.status || "Active",
      }))
    : ACCOUNTS;
  const list = sourceList.filter((a) => f === "All" || a.status === f);
  return (
    <section className="mt-12">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl">Account overview</h2>
          {!useLive && <SampleBadge />}
        </div>
        <div className="seg">
          {["All", "Active", "Completed", "Failed", "Funded"].map((s) => (
            <button key={s} className={f === s ? "is-on" : ""} onClick={() => setF(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {list.map((a) => (
          <div key={a.id} className="card-panel p-5 acct-card tabular-nums">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-mono text-xs text-[var(--muted-2)]">{a.id}</div>
                <div className="font-display text-xl mt-1">{a.product}</div>
              </div>
              <StatusPill status={a.status} />
            </div>
            <dl className="acct-meta">
              <div>
                <dt>Size</dt>
                <dd>{inr(a.size)}</dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd>{inr(a.balance)}</dd>
              </div>
              <div>
                <dt>Equity</dt>
                <dd>{inr(a.equity)}</dd>
              </div>
              <div>
                <dt>P&L</dt>
                <dd className={pnlCls(a.pnl)}>{signed(a.pnl)}</dd>
              </div>
              <div>
                <dt>Start</dt>
                <dd>{a.start}</dd>
              </div>
              <div>
                <dt>Expiry</dt>
                <dd>{a.expiry}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Overview extras ---------- */
export function OverviewSample() {
  const { authenticated, activeAccount, trades } = useTraderState({ pollMs: 8000 });
  const useLive = authenticated && !!activeAccount;
  const recentTrades = useLive ? trades : TRADES;
  const a = useLive
    ? {
        ...ACCOUNT,
        trader_id: activeAccount.account_number || activeAccount.id,
        starting_capital: Number(activeAccount.starting_capital || 100000),
        balance: Number(activeAccount.balance || 100000),
        equity: Number(activeAccount.balance || 100000),
        daily_pnl: Number(activeAccount.realized_pnl || 0),
        profit_target: Math.round(Number(activeAccount.starting_capital || 100000) * 0.08),
        trading_days_done: Math.min(
          10,
          new Set(trades.map((t) => String(t.created_at || "").slice(0, 10))).size,
        ),
      }
    : ACCOUNT;
  const e = evaluation(a);
  const curve = useMemo(() => {
    let v = a.starting_capital;
    return makeCandles("NIFTY", "1D", 30).map((c, i) => (v += (c.close - c.open) * 4 + i * 30));
  }, [a.starting_capital]);
  const lo = Math.min(...curve);
  const hi = Math.max(...curve);
  const pts = curve
    .map((v, i) => `${(i / (curve.length - 1)) * 600},${150 - ((v - lo) / (hi - lo || 1)) * 140}`)
    .join(" ");

  return (
    <section className="mt-12">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="font-display text-2xl">Trading overview</h2>
        {!useLive && <SampleBadge />}
        <span className="text-xs text-[var(--muted-2)] font-mono">Account {a.trader_id}</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Starting capital" value={inr(a.starting_capital)} />
        <Kpi label="Balance" value={inr(a.balance)} />
        <Kpi label="Current equity" value={inr(a.equity)} />
        <Kpi label="Total P&L" value={signed(e.pnl)} tone={pnlCls(e.pnl)} />
        <Kpi label="Realized P&L" value={signed(a.daily_pnl)} tone={pnlCls(a.daily_pnl)} />
        <Kpi label="Drawdown" value={`${e.drawdown_pct}%`} />
        <Kpi
          label="Trading days"
          value={`${a.trading_days_done} / ${a.min_trading_days}`}
          icon={CalendarDays}
        />
        <Kpi label="Target progress" value={`${e.progress}%`} icon={Target} />
      </div>
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 mt-6">
        <div className="card-panel p-5">
          <div className="text-xs text-[var(--muted-2)] uppercase tracking-wider font-mono mb-3">
            Equity trajectory · 30 days
          </div>
          <svg
            viewBox="0 0 600 160"
            className="w-full h-auto equity-svg"
            role="img"
            aria-label="Equity curve"
          >
            <polyline points={pts} />
            <polygon points={`0,160 ${pts} 600,160`} />
          </svg>
        </div>
        <div className="card-panel p-5">
          <div className="text-xs text-[var(--muted-2)] uppercase tracking-wider font-mono mb-3">
            Recent trades
          </div>
          {recentTrades.length ? (
            <ul className="space-y-2 text-sm tabular-nums">
              {recentTrades.slice(0, 5).map((t) => (
                <li key={t.id} className="flex justify-between gap-3">
                  <span>
                    {t.side === "BUY" ? "▲" : "▼"} {t.symbol}{" "}
                    <small className="text-[var(--muted-2)]">
                      {String(t.in || "")
                        .slice(5, 16)
                        .replace("T", " ")}
                    </small>
                  </span>
                  <span className={pnlCls(t.pnl)}>{signed(t.pnl)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Place your first trade in the terminal to build history.
            </p>
          )}
          <Link
            to="/app/tradebook"
            className="text-xs text-[var(--accent)] mt-4 inline-block hover:underline"
          >
            Open trade book →
          </Link>
        </div>
      </div>
    </section>
  );
}
