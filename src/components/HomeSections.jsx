import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { api, formatINR } from "../lib/api";
import { useLiveCandles, formatPrice } from "../lib/useLiveMarket";
import { Button } from "./ui/button";
import {
  ArrowRight,
  Check,
  Target,
  Zap,
  Rocket,
  Trophy,
  Crown,
  Medal,
  LineChart,
  ShieldCheck,
  Wallet,
  Headphones,
  Scale,
  Clock3,
  Sparkles,
} from "lucide-react";

/* ---------- Funding products: Standard / One-Step / Instant ---------- */
export function ProductCards({ plans, href }) {
  const std = plans || [];
  const from = std.length ? Math.min(...std.map((p) => Number(p.challenge_fee) || Infinity)) : null;
  const sizes = std.map((p) => Number(p.account_size)).filter(Boolean);
  const products = [
    {
      key: "standard",
      icon: Target,
      name: "Standard Challenge",
      tag: "Available now",
      live: true,
      line: "Prove your discipline in one evaluation, then trade a funded account.",
      facts: std.length
        ? [
            `Account sizes ${formatINR(Math.min(...sizes))} – ${formatINR(Math.max(...sizes))}`,
            `${std[0].profit_share}% profit split`,
            `From ${formatINR(from)} one-time fee`,
          ]
        : [],
    },
    {
      key: "one-step",
      icon: Zap,
      name: "One-Step Funding",
      tag: "Coming soon",
      live: false,
      line: "A single, focused evaluation stage. Full rules will be published before launch.",
      facts: [],
    },
    {
      key: "instant",
      icon: Rocket,
      name: "Instant Funding",
      tag: "Coming soon",
      live: false,
      line: "Skip the evaluation and start on a funded account. Details announced soon.",
      facts: [],
    },
  ];
  return (
    <section className="home-band" aria-labelledby="products-heading">
      <div className="container-xl">
        <div className="home-section-heading">
          <div>
            <div className="home-eyebrow">Funding products</div>
            <h2 id="products-heading" className="font-display">
              Choose how you get funded
            </h2>
            <p>Three paths. One goal — trading capital for disciplined traders.</p>
          </div>
        </div>
        <div className="product-grid">
          {products.map(({ key, icon: Icon, name, tag, live, line, facts }, i) => (
            <article
              key={key}
              className={`product-card ${live ? "is-live" : ""}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="product-icon">
                  <Icon size={22} />
                </span>
                <span className={`product-tag ${live ? "is-live" : ""}`}>{tag}</span>
              </div>
              <h3 className="font-display">{name}</h3>
              <p>{line}</p>
              {facts.length > 0 && (
                <ul>
                  {facts.map((f) => (
                    <li key={f}>
                      <Check size={15} />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto pt-5">
                {live ? (
                  <Button asChild className="w-full">
                    <Link to={href}>
                      Get started <ArrowRight />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/contact">
                      Get notified <ArrowRight />
                    </Link>
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Trading platform preview (live NIFTY 50 NSE feed) ---------- */
export function PlatformPreview() {
  const {
    candles: liveCandles,
    quote,
    marketStatus,
  } = useLiveCandles("NIFTY", "5m", {
    pollMs: 10000,
  });

  const bars = useMemo(() => {
    if (liveCandles.length) {
      const slice = liveCandles.slice(-28);
      const lo = Math.min(...slice.map((c) => c.low));
      const hi = Math.max(...slice.map((c) => c.high));
      const span = hi - lo || 1;
      return slice.map((c) => {
        const bottomPct = ((Math.min(c.open, c.close) - lo) / span) * 115;
        const bodyH = Math.max(10, (Math.abs(c.close - c.open) / span) * 115);
        return { h: Math.round(bodyH), y: Math.round(bottomPct), up: c.close >= c.open };
      });
    }
    return Array.from({ length: 28 }, (_, i) => {
      const up = (i * 7) % 5 !== 0;
      return { h: 18 + ((i * 37) % 46), y: 20 + Math.sin(i / 3) * 14 + i * 1.1, up };
    });
  }, [liveCandles]);

  const up = (quote?.changePct ?? 0) >= 0;

  return (
    <section className="home-band" aria-labelledby="platform-heading">
      <div className="container-xl platform-preview">
        <div>
          <div className="home-eyebrow">Trading platform</div>
          <h2
            id="platform-heading"
            className="font-display text-3xl md:text-5xl leading-tight mt-3"
          >
            Your evaluation, on one clean screen
          </h2>
          <p className="text-[var(--muted)] mt-4 max-w-md">
            Watchlist, orders, positions and live rule tracking — powered by live NSE & BSE prices
            for NIFTY, BANK NIFTY and top Indian equities.
          </p>
          <ul className="platform-points">
            <li>
              <LineChart size={17} /> Live NSE & BSE candlestick charts with timeframe controls
            </li>
            <li>
              <ShieldCheck size={17} /> Daily loss and drawdown tracked as you trade
            </li>
            <li>
              <Clock3 size={17} /> Trading days and target progress at a glance
            </li>
          </ul>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/virtual-trading">
              Explore the platform <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="platform-mock" aria-label="Live NIFTY 50 platform preview">
          <div className="platform-mock-top items-center">
            <div className="flex items-center gap-2.5 tabular-nums">
              <span>NIFTY 50 · NSE</span>
              {quote?.ltp ? (
                <>
                  <strong className="!text-white !text-sm !tracking-normal">
                    {formatPrice(quote.ltp)}
                  </strong>
                  <span className={up ? "text-[var(--emerald)]" : "text-[var(--rose)]"}>
                    {up ? "+" : ""}
                    {quote.changePct.toFixed(2)}%
                  </span>
                </>
              ) : null}
            </div>
            <strong>{marketStatus === "LIVE" ? "Live NSE feed" : "Last NSE close"}</strong>
          </div>
          <div className="platform-mock-chart">
            {bars.map((c, i) => (
              <span
                key={i}
                className={c.up ? "up" : "down"}
                style={{
                  height: `${c.h}px`,
                  transform: `translateY(${-c.y}px)`,
                  animationDelay: `${i * 25}ms`,
                }}
              />
            ))}
          </div>
          <div className="platform-mock-panel">
            <Link to="/app/terminal" className="buy text-center" tabIndex={-1}>
              Buy
            </Link>
            <Link to="/app/terminal" className="sell text-center" tabIndex={-1}>
              Sell
            </Link>
            <div>
              <small>Daily loss used</small>
              <div className="bar">
                <i style={{ width: "34%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Monthly top 10 leaderboard ---------- */
const SAMPLE_BOARD = Array.from({ length: 10 }, (_, i) => ({
  id: `s${i}`,
  name: `Sample trader ${i + 1}`,
  trader_id: `IF-SAMPLE-${101 + i}`,
  total_payout: 0,
  profit_pct: null,
  sample: true,
}));
export function MonthlyLeaderboard() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api
      .get("/leaderboard", { params: { limit: 10 } })
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]));
  }, []);
  const sample = rows !== null && rows.length === 0;
  const list = sample ? SAMPLE_BOARD : rows || [];
  const month = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
  const icons = [Crown, Trophy, Medal];
  return (
    <section className="home-band" aria-labelledby="board-heading">
      <div className="container-xl">
        <div className="home-section-heading">
          <div>
            <div className="home-eyebrow">Monthly leaderboard · {month}</div>
            <h2 id="board-heading" className="font-display">
              Top 10 traders this month
            </h2>
            <p>Ranked by verified performance and payouts.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/leaderboard">
              Full leaderboard <ArrowRight />
            </Link>
          </Button>
        </div>
        {sample && (
          <div className="sample-note">
            Sample data — the live ranking appears here once this month's results are published.
          </div>
        )}
        <ol className="board-list">
          {list.slice(0, 10).map((r, i) => {
            const Icon = icons[i];
            return (
              <li
                key={r.id || i}
                className={`board-row ${i < 3 ? `is-top is-top-${i + 1}` : ""} ${r.sample ? "is-sample" : ""}`}
              >
                <span className="board-rank">{Icon ? <Icon size={18} /> : i + 1}</span>
                <div className="board-name">
                  <strong>{r.name || r.trader_name}</strong>
                  <small>{r.trader_id || r.plan || ""}</small>
                </div>
                <div className="board-stat">
                  <small>{r.profit_pct != null ? "Return" : ""}</small>
                  {r.profit_pct != null ? `${r.profit_pct}%` : ""}
                </div>
                <div className="board-payout font-display">
                  {r.sample ? "—" : formatINR(Number(r.total_payout) || 0)}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Why choose IndiFunded ---------- */
export function WhyChoose() {
  const items = [
    {
      icon: Scale,
      t: "Clear, published rules",
      d: "Every target, loss limit and trading-day rule is visible before you pay.",
    },
    {
      icon: Wallet,
      t: "One-time challenge fee",
      d: "No monthly subscriptions. Pay once for your evaluation.",
    },
    {
      icon: Sparkles,
      t: "Built for Indian markets",
      d: "NIFTY, BANK NIFTY and INR accounts — no currency conversions.",
    },
    {
      icon: ShieldCheck,
      t: "Verifiable payouts",
      d: "Every published payout can be checked with its Payout ID.",
    },
    {
      icon: LineChart,
      t: "Your progress, live",
      d: "Dashboard tracking for P&L, drawdown and evaluation targets.",
    },
    {
      icon: Headphones,
      t: "Real support team",
      d: "Talk to us on WhatsApp, email or phone when you need help.",
    },
  ];
  return (
    <section className="home-band" aria-labelledby="why-heading">
      <div className="container-xl">
        <div className="home-section-heading">
          <div>
            <div className="home-eyebrow">Why IndiFunded</div>
            <h2 id="why-heading" className="font-display">
              Built for traders who take it seriously
            </h2>
          </div>
        </div>
        <div className="why-grid">
          {items.map(({ icon: Icon, t, d }) => (
            <div key={t} className="why-item">
              <span className="why-icon">
                <Icon size={20} />
              </span>
              <h3 className="font-display">{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
