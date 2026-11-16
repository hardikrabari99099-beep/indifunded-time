import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import {
  ArrowRight,
  LayoutDashboard,
  Briefcase,
  CandlestickChart,
  BookOpen,
  Layers,
  ListOrdered,
  Target,
  ShieldAlert,
  CalendarDays,
  Sparkles,
  BadgeCheck,
  IdCard,
  Award,
  Wallet,
  Bell,
  LifeBuoy,
  Settings as SettingsIcon,
  CheckCircle2,
  Timer,
  Lock,
  ShieldCheck,
  Server,
  Circle,
  FileText,
  Gauge,
  Activity,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useLiveMarketQuotes, formatPrice } from "../lib/useLiveMarket";

const GROUPS = [
  { id: "ALL", label: "All 17 Screens" },
  { id: "Trading", label: "Trading (6)" },
  { id: "Performance", label: "Performance (4)" },
  { id: "Funding", label: "Funding (4)" },
  { id: "Account", label: "Account (3)" },
];

const DASHBOARD_SCREENS = [
  {
    key: "overview",
    group: "Trading",
    label: "Overview",
    to: "/app",
    icon: LayoutDashboard,
    tagline: "Command center for capital, margins, net P&L, and fund ledger",
    features: [
      "Live ₹1,00,000 Platform Explorer countdown & status banner",
      "Total simulated capital, active wallets, realized P&L & payouts",
      "Real-time equity curve across all virtual & funded accounts",
      "Recent admin fund credits & margin allocation ledger",
    ],
  },
  {
    key: "accounts",
    group: "Trading",
    label: "My Accounts",
    to: "/app/accounts",
    icon: Briefcase,
    tagline: "Switch between Trial Explorer, Challenge, and Funded accounts",
    features: [
      "Account balance, available margin & used margin per wallet",
      "Starter ₹1L 5-minute trial timer status badge",
      "Completed challenge order history & account provisioning",
      "One-click launch into any selected trading wallet",
    ],
  },
  {
    key: "terminal",
    group: "Trading",
    label: "Trading Terminal",
    to: "/app/terminal",
    icon: CandlestickChart,
    tagline: "Full execution desk with live NSE/BSE watchlist, candlesticks & order ticket",
    features: [
      "Live NSE & BSE watchlist (NIFTY, BANKNIFTY, SENSEX, equities)",
      "Interactive OHLC candlestick chart across 1m–1D timeframes",
      "MARKET, LIMIT & SL buy/sell ticket with 20% margin check",
      "Real-time mark-to-market positions & one-tap square off",
    ],
  },
  {
    key: "tradebook",
    group: "Trading",
    label: "Trade Book",
    to: "/app/tradebook",
    icon: BookOpen,
    tagline: "Audit every closed execution with entry, exit, timestamps & realized P&L",
    features: [
      "Complete history of closed simulated & funded trades",
      "Exact entry/exit prices synced with live NSE/BSE execution quotes",
      "Entry & exit timestamps, trade side, and quantity breakdown",
      "Per-trade realized P&L tracking and export-ready table",
    ],
  },
  {
    key: "positions",
    group: "Trading",
    label: "Positions",
    to: "/app/positions",
    icon: Layers,
    tagline: "Monitor open exposure with live MTM price ticks and instant close",
    features: [
      "Live last traded price (LTP) and unrealized MTM profit/loss",
      "Average entry price, lot/share qty & blocked margin visibility",
      "One-click Market Square Off per open position",
      "Automatic margin release back to account balance on close",
    ],
  },
  {
    key: "orders",
    group: "Trading",
    label: "Orders",
    to: "/app/orders",
    icon: ListOrdered,
    tagline: "Track executed, pending limit, and stop-loss orders across sessions",
    features: [
      "Chronological order blotter synced across devices",
      "Executed, Pending & Rejected status badges",
      "Order ID, instrument exchange, execution price & timestamp",
      "Live server-side validation before order placement",
    ],
  },
  {
    key: "evaluation",
    group: "Performance",
    label: "Evaluation Progress",
    to: "/app/evaluation",
    icon: Target,
    tagline: "Rule-by-rule tracker for challenge completion & pass readiness",
    features: [
      "Points achieved vs required plan profit target",
      "Completed active trading days vs minimum days requirement",
      "Remaining challenge window & overall win accuracy percentage",
      "Real-time pass/fail rule validation meter",
    ],
  },
  {
    key: "risk",
    group: "Performance",
    label: "Risk Management",
    to: "/app/risk",
    icon: ShieldAlert,
    tagline: "Guardrails monitoring daily loss, max drawdown & daily trade caps",
    features: [
      "Max drawdown gauge capped at 20% against starting equity",
      "Daily loss utilization bar with color-coded warning zones",
      "Trades-per-day counter enforcing plan discipline limits",
      "Automated breach prevention alerts before account violations",
    ],
  },
  {
    key: "calendar",
    group: "Performance",
    label: "Trading Calendar",
    to: "/app/calendar",
    icon: CalendarDays,
    tagline: "Monthly heatmap of green days, red days, and daily P&L attribution",
    features: [
      "Day-by-day calendar cells showing realized session P&L",
      "Visual streaks of profitable vs drawdown sessions",
      "Session trade counts per calendar date",
      "Prevents skipped minimum-day miscalculations",
    ],
  },
  {
    key: "insights",
    group: "Performance",
    label: "AI Insights",
    to: "/app/insights",
    icon: Sparkles,
    tagline: "Upload trade history for automated consistency scoring & leak detection",
    features: [
      "Consistency score out of 100 from real trade logs",
      "Detects overtrading, premature exits & sizing mistakes",
      "Rule-compliance review tailored to your active challenge plan",
      "Actionable improvement checklist saved per review session",
    ],
  },
  {
    key: "funded",
    group: "Funding",
    label: "Funded Account",
    to: "/app/funded",
    icon: BadgeCheck,
    tagline: "Track transition from challenge evaluation to live funded broker execution",
    features: [
      "6-step verification & broker activation milestone tracker",
      "Supported Indian brokers: Zerodha, Dhan, Angel One & Upstox",
      "Live funded account credentials and capital scaling schedule",
      "Profit split status (70% trader share) after passing",
    ],
  },
  {
    key: "kyc",
    group: "Funding",
    label: "KYC",
    to: "/app/kyc",
    icon: IdCard,
    tagline: "Fast digital identity & bank verification for payouts",
    features: [
      "PAN card, Aadhaar/address proof & bank IFSC submission",
      "Verified payout UPI ID configuration",
      "Real-time KYC submission & review status badge",
      "Required only when passing challenge or claiming profits",
    ],
  },
  {
    key: "certificates",
    group: "Funding",
    label: "Certificates",
    to: "/app/certificates",
    icon: Award,
    tagline: "Verified IndiFunded funded trader & payout milestone certificates",
    features: [
      "Issued high-resolution payout & challenge pass certificates",
      "Public QR verification codes matching Payout IDs",
      "Downloadable milestone badges for your trading portfolio",
      "Automatic sync when admin publishes verified certificates",
    ],
  },
  {
    key: "payouts",
    group: "Funding",
    label: "Payouts",
    to: "/app/payouts",
    icon: Wallet,
    tagline: "Withdraw 70% profit splits with 24-hour verified settlement",
    features: [
      "Eligible withdrawal balance & pending request overview",
      "Direct payout requests via UPI ID or IMPS/NEFT bank transfer",
      "Transparent status pipeline (Pending → Approved → Paid)",
      "UTR verification reference & cumulative paid-out totals",
    ],
  },
  {
    key: "notifications",
    group: "Account",
    label: "Notifications",
    to: "/app/notifications",
    icon: Bell,
    tagline: "Instant alerts for risk thresholds, admin credits & challenge updates",
    features: [
      "Fund credit & challenge activation confirmations",
      "Drawdown proximity & daily trade-limit reminders",
      "Payout approval & KYC review status alerts",
      "Filter unread vs archived notifications cleanly",
    ],
  },
  {
    key: "support",
    group: "Account",
    label: "Support",
    to: "/app/support",
    icon: LifeBuoy,
    tagline: "Direct ticket desk plus WhatsApp, email & phone trader assistance",
    features: [
      "Open support requests linked to your account ID",
      "Direct WhatsApp & phone escalation for funded traders",
      "Guidance on challenge rules, KYC & payout scheduling",
      "7-day Indian market hours desk responsiveness",
    ],
  },
  {
    key: "settings",
    group: "Account",
    label: "Profile Settings",
    to: "/app/settings",
    icon: SettingsIcon,
    tagline: "Manage trader profile details, phone & trading preferences",
    features: [
      "Update full display name and registered phone number",
      "Inspect trial window start/expiry timestamps",
      "Manage terminal credentials & account security links",
      "Seamless password renewal workflow via Business Email",
    ],
  },
];

const SHOWCASE_SYMBOLS = ["NIFTY", "BANKNIFTY", "SENSEX", "RELIANCE", "HDFCBANK", "TCS", "INFY"];

const BROKERS = [
  ["Zerodha", "India's largest discount broker with the Kite trading platform."],
  ["Angel One", "Full-service broker with SmartAPI and a mobile-first trading app."],
  ["Upstox", "Fast, low-cost trading with a modern web and mobile experience."],
  ["Dhan", "Trader-focused platform with advanced charts and options tools."],
];

const TRACKER = [
  "Challenge result",
  "KYC verification",
  "Document submission",
  "Platform selection",
  "Account setup",
  "Activation",
];

const FAQS = [
  [
    "How does the ₹1,00,000 5-Minute Platform Explorer work?",
    "When you sign up or log in for the first time, you immediately receive a ₹1,00,000 Platform Explorer trial wallet connected to live NSE & BSE prices. Your 5-minute timer starts right away — once 5 minutes expire, the Trading Terminal locks until you purchase a Challenge Account.",
  ],
  [
    "What happens when my 5-minute trial expires?",
    "You can still explore your Overview, Accounts, Rules, and previous Trial trades, while live order execution locks automatically. Purchasing any Challenge Plan or receiving an admin-provisioned account immediately unlocks unlimited terminal access.",
  ],
  [
    "What can I track across the 17 dashboard screens?",
    "Everything from live NSE/BSE candlesticks, MTM positions, orders, and trade books to evaluation targets, drawdown gauges, trading calendar heatmaps, AI insights, KYC, certificates, and 24-hour payouts.",
  ],
  [
    "Is my evaluation calculated on my device?",
    "No. Trial expiry, trade validation, risk checks, and pass/fail decisions run strictly on our backend servers so results are consistent and tamper-proof.",
  ],
];

function Spark({ up = true }) {
  const d = up
    ? "M0 40 L20 34 L40 37 L60 24 L80 28 L100 16 L120 20 L140 8 L160 12"
    : "M0 10 L20 16 L40 12 L60 26 L80 22 L100 34 L120 30 L140 40 L160 36";
  return (
    <svg
      viewBox="0 0 160 48"
      className={`vt-spark ${up ? "" : "vt-spark-down"}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function ScreenPreview({ screen, quotes }) {
  const k = screen.key;
  if (k === "terminal" || k === "positions") {
    const rows = quotes.length
      ? quotes.slice(0, 5).map((q) => [
          `${q.symbol} · ${q.exchange}`,
          q.kind === "EQUITY" ? `₹${formatPrice(q.ltp)}` : formatPrice(q.ltp),
          `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%`,
        ])
      : [["Loading live NSE/BSE quotes…", "—", "—"]];
    return (
      <div>
        <div className="vt-mock-list tabular-nums">
          {rows.map(([s, p, c]) => (
            <div key={s}>
              <span>{s}</span>
              <span className="font-mono">{p}</span>
              <span className={c.startsWith("-") ? "vt-down" : "vt-up"}>{c}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Link to="/app/terminal" className="vt-btn-buy">
            BUY
          </Link>
          <Link to="/app/terminal" className="vt-btn-sell">
            SELL
          </Link>
        </div>
      </div>
    );
  }
  if (k === "orders" || k === "tradebook") {
    return (
      <div className="vt-mock-list tabular-nums">
        {[
          ["BUY", "NIFTY", k === "orders" ? "Executed" : "+₹2,450"],
          ["SELL", "BANKNIFTY", k === "orders" ? "Executed" : "+₹1,820"],
          ["BUY", "RELIANCE", k === "orders" ? "Pending Limit" : "+₹940"],
          ["BUY", "HDFCBANK", k === "orders" ? "Executed" : "−₹410"],
        ].map(([side, s, st], i) => (
          <div key={i}>
            <span className={side === "BUY" ? "vt-up" : "vt-down"}>{side}</span>
            <span>{s}</span>
            <span className={st.startsWith("+") ? "vt-up" : st.startsWith("−") ? "vt-down" : "vt-muted"}>
              {st}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (k === "evaluation" || k === "risk" || k === "insights") {
    return (
      <div className="vt-mock-progress tabular-nums">
        {[
          [k === "risk" ? "Drawdown used" : "Profit target", k === "risk" ? 18 : 68],
          [k === "risk" ? "Daily loss cap" : "Min trading days", k === "risk" ? 12 : 70],
          [k === "insights" ? "AI consistency score" : "Win accuracy", 76],
          ["Rule compliance", 100],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="flex justify-between text-xs">
              <span>{l}</span>
              <span className="font-mono">{v}%</span>
            </div>
            <div className="vt-bar">
              <i style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (k === "calendar") {
    return (
      <div className="grid grid-cols-7 gap-1.5 text-[10px] font-mono text-center tabular-nums">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-[var(--muted-2)] pb-1">
            {d}
          </div>
        ))}
        {Array.from({ length: 14 }, (_, i) => {
          const val = [12, -4, 18, 9, 0, 0, 0, 21, 14, -6, 11, 16, 0, 0][i];
          return (
            <div
              key={i}
              className={`rounded-md py-2 border ${
                val > 0
                  ? "border-[var(--emerald)]/40 bg-[var(--emerald)]/15 text-[var(--emerald)]"
                  : val < 0
                    ? "border-[var(--rose)]/40 bg-[var(--rose)]/15 text-[var(--rose)]"
                    : "border-[var(--border)] text-[var(--muted-2)]"
              }`}
            >
              {val === 0 ? "—" : `${val > 0 ? "+" : ""}${val}k`}
            </div>
          );
        })}
      </div>
    );
  }
  if (k === "funded" || k === "kyc" || k === "payouts" || k === "certificates") {
    return (
      <div className="vt-mock-kpis tabular-nums">
        <div>
          <span>Profit Split</span>
          <strong className="vt-up">70% Trader</strong>
        </div>
        <div>
          <span>Payout Speed</span>
          <strong>24 Hours</strong>
        </div>
        <div>
          <span>Verification</span>
          <strong>PAN + UPI</strong>
        </div>
        <div>
          <span>Certificates</span>
          <strong>QR Verified</strong>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="vt-mock-kpis tabular-nums">
        <div>
          <span>Explorer Trial</span>
          <strong>₹1,00,000</strong>
        </div>
        <div>
          <span>Window</span>
          <strong className="vt-up">05:00 min</strong>
        </div>
        <div>
          <span>Used margin</span>
          <strong>₹0</strong>
        </div>
        <div>
          <span>Screens</span>
          <strong>17 Tools</strong>
        </div>
      </div>
      <Spark />
    </div>
  );
}

export default function VirtualTrading() {
  const { user } = useAuth();
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [activeKey, setActiveKey] = useState("terminal");
  const [plan, setPlan] = useState(null);
  const { quotes, marketStatus } = useLiveMarketQuotes(SHOWCASE_SYMBOLS, { pollMs: 6000 });

  useEffect(() => {
    api
      .get("/plans")
      .then((r) => setPlan(r.data.find((p) => p.popular) || r.data[0] || null))
      .catch(() => {});
  }, []);

  const filteredScreens =
    groupFilter === "ALL"
      ? DASHBOARD_SCREENS
      : DASHBOARD_SCREENS.filter((s) => s.group === groupFilter);

  const activeScreen =
    filteredScreens.find((s) => s.key === activeKey) ||
    filteredScreens[0] ||
    DASHBOARD_SCREENS[0];

  const trialHref = user ? "/app/terminal" : "/login?mode=signup&next=/app/terminal";
  const challengeHref = user ? "/challenges" : "/login?next=/challenges";

  return (
    <div className="vt-page">
      <section className="vt-hero container-xl">
        <div className="home-eyebrow justify-center">Trader Platform · 17 Dashboard Screens</div>
        <h1 className="font-display">
          Inside the complete
          <br />
          <span className="text-[var(--accent-2,var(--accent))]">IndiFunded Desk.</span>
        </h1>
        <p>
          Inspect every single tool inside the Trader Dashboard — plus receive an instant{" "}
          <strong className="text-white">₹1,00,000 5-Minute Platform Explorer</strong> wallet the
          moment you sign in to test live NSE & BSE execution.
        </p>

        <div className="mt-7 mx-auto max-w-2xl rounded-2xl border border-[var(--emerald)]/35 bg-[var(--emerald)]/8 p-4 sm:p-5 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--emerald)]/20 text-[var(--emerald)] grid place-items-center shrink-0">
              <Timer size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                ₹1,00,000 Platform Explorer · 5-Min Live Trial
              </div>
              <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                Starts immediately on login/signup with live NSE & BSE feeds. After 5 minutes, the
                Trading Terminal locks until you purchase an official challenge account.
              </p>
            </div>
          </div>
          <Link
            to={trialHref}
            className="btn-amber rounded-full px-5 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2 shrink-0"
          >
            {user ? "Open Terminal" : "Try ₹1L Explorer"} <ArrowRight size={14} />
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <Link
            to={challengeHref}
            className="btn-ghost rounded-full px-6 py-3 text-sm inline-flex items-center gap-2"
          >
            Purchase Challenge Account <ArrowRight size={14} />
          </Link>
          <a href="#explore" className="btn-ghost rounded-full px-6 py-3 text-sm">
            Tour All 17 Screens
          </a>
        </div>

        <div className="vt-hero-stats">
          <div>
            <strong className="font-display">17</strong>
            <span>Dashboard screens</span>
          </div>
          <div>
            <strong className="font-display">₹1L</strong>
            <span>5-min login explorer</span>
          </div>
          <div>
            <strong className="font-display">Live</strong>
            <span>NSE & BSE quotes</span>
          </div>
        </div>
      </section>

      <section id="explore" className="home-band">
        <div className="container-xl">
          <div className="home-section-heading">
            <div>
              <div className="home-eyebrow">Interactive Dashboard Tour</div>
              <h2 className="font-display">Every trader screen, explained</h2>
              <p>
                Filter by category and tap any screen to inspect its features and live NSE/BSE
                data preview.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setGroupFilter(g.id);
                  const first =
                    g.id === "ALL"
                      ? DASHBOARD_SCREENS[0]
                      : DASHBOARD_SCREENS.find((s) => s.group === g.id);
                  if (first) setActiveKey(first.key);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${
                  groupFilter === g.id
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                    : "border-[var(--border-hi)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="vt-tour">
            <div className="vt-tour-tabs" role="tablist">
              {filteredScreens.map((s) => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={activeScreen.key === s.key}
                  className={activeScreen.key === s.key ? "is-active" : ""}
                  onClick={() => setActiveKey(s.key)}
                >
                  <s.icon size={15} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            <div className="vt-tour-panel card-panel">
              <div className="vt-device">
                <div className="vt-device-bar">
                  <span>
                    {activeScreen.group} · {activeScreen.label}
                  </span>
                  <span className="chip text-[10px]">
                    {activeScreen.key === "terminal" || activeScreen.key === "positions"
                      ? `NSE/BSE · ${marketStatus}`
                      : "Dashboard module"}
                  </span>
                </div>
                <ScreenPreview screen={activeScreen} quotes={quotes} />
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--emerald)]">
                  {activeScreen.group} Module
                </div>
                <h3 className="font-display text-2xl text-white mt-1">{activeScreen.label}</h3>
                <p className="text-sm text-[var(--muted)] mt-1.5 mb-4">{activeScreen.tagline}</p>
                <ul className="vt-points">
                  {activeScreen.features.map((f) => (
                    <li key={f}>
                      <CheckCircle2 size={14} />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  <Link
                    to={user ? activeScreen.to : `/login?next=${encodeURIComponent(activeScreen.to)}`}
                    className="btn-amber rounded-full px-5 py-2 text-xs font-semibold inline-flex items-center gap-2"
                  >
                    Open {activeScreen.label} <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-band">
        <div className="container-xl">
          <div className="home-section-heading">
            <div>
              <div className="home-eyebrow">Complete Feature Directory</div>
              <h2 className="font-display">All 17 Trader Dashboard Modules</h2>
              <p>
                Organized into 4 workspaces — Trading, Performance, Funding, and Account — included
                inside every IndiFunded login.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DASHBOARD_SCREENS.map((s) => (
              <article
                key={s.key}
                className="card-panel p-5 flex flex-col justify-between gap-3 hover:border-[var(--emerald)]/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] text-[var(--emerald)] grid place-items-center">
                      <s.icon size={17} />
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted-2)]">
                      {s.group}
                    </span>
                  </div>
                  <h3 className="font-display text-lg text-white mt-3">{s.label}</h3>
                  <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">{s.tagline}</p>
                  <ul className="mt-3 space-y-1.5 text-xs text-[var(--muted)]">
                    {s.features.slice(0, 3).map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <CheckCircle2 size={13} className="text-[var(--emerald)] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  to={user ? s.to : `/login?next=${encodeURIComponent(s.to)}`}
                  className="text-xs font-medium text-[var(--emerald)] inline-flex items-center gap-1 pt-2 border-t border-[var(--border)] hover:underline"
                >
                  Explore {s.label} <ArrowRight size={12} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-band">
        <div className="container-xl">
          <div className="home-section-heading">
            <div>
              <div className="home-eyebrow">5-Minute Trial Flow</div>
              <h2 className="font-display">Test with ₹1L free, unlock full trading on purchase</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card-panel p-5">
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] text-[var(--emerald)] grid place-items-center">
                <Timer size={18} />
              </div>
              <h3 className="font-display text-lg text-white mt-3">1. Instant ₹1L Explorer</h3>
              <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
                Sign up or log in to receive ₹1,00,000 simulated margin immediately with live
                NIFTY, BANKNIFTY, SENSEX, and equity quotes.
              </p>
            </div>
            <div className="card-panel p-5">
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] text-[var(--emerald)] grid place-items-center">
                <CandlestickChart size={18} />
              </div>
              <h3 className="font-display text-lg text-white mt-3">2. 5 Minutes Full Terminal</h3>
              <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
                Place MARKET/LIMIT/SL orders, square off live MTM positions, and monitor evaluation
                progress for 5 full minutes.
              </p>
            </div>
            <div className="card-panel p-5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 grid place-items-center">
                <Lock size={18} />
              </div>
              <h3 className="font-display text-lg text-white mt-3">3. Auto-Lock → Upgrade</h3>
              <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
                At 00:00, the Trading Terminal locks automatically. Pick any Challenge Plan from{" "}
                <Link to="/challenges" className="text-[var(--emerald)] underline">
                  /challenges
                </Link>{" "}
                to unlock funded evaluations.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="home-band">
        <div className="container-xl">
          <div className="home-section-heading">
            <div>
              <div className="home-eyebrow">After the challenge</div>
              <h2 className="font-display">Choose your trading platform</h2>
              <p>
                Challenge trading is simulated. Once you pass and complete verification, you pick
                the broker for your real funded account, subject to applicable terms.
              </p>
            </div>
          </div>
          <div className="vt-brokers">
            {BROKERS.map(([n, d]) => (
              <article key={n} className="card-panel p-5">
                <div className="vt-broker-mark font-display">
                  {n
                    .split(" ")
                    .map((w) => w[0])
                    .join("")}
                </div>
                <h3 className="font-display text-xl mt-3">{n}</h3>
                <p className="text-sm vt-muted mt-1.5">{d}</p>
                <div className="chip text-[10px] mt-3">Available after you pass</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-band">
        <div className="container-xl vt-two">
          <div>
            <div className="home-eyebrow">Risk management</div>
            <h2 className="font-display vt-h2">Built-in server-side protection</h2>
            <div className="vt-risk mt-6">
              {[
                [
                  Gauge,
                  plan ? `${plan.max_loss_limit}%` : "20%",
                  "Maximum drawdown",
                  "Overall loss cap measured against account size.",
                ],
                [
                  ListOrdered,
                  plan ? `${plan.trades_per_day} trades` : "3 trades",
                  "Max trades per day",
                  "Keeps trading disciplined and intentional.",
                ],
                [
                  Target,
                  plan ? `${plan.profit_target_points} pts` : "650 pts",
                  "Profit target tracking",
                  "Progress toward the target, updated on our servers.",
                ],
                [
                  Activity,
                  "Real-time",
                  "NSE & BSE live feeds",
                  "Sub-5-second polling across stocks and indices.",
                ],
              ].map(([Icon, v, t, d]) => (
                <div key={t} className="card-panel p-4">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-[var(--accent)]" />
                    <strong className="font-display text-lg">{v}</strong>
                  </div>
                  <div className="text-sm mt-2">{t}</div>
                  <p className="text-xs vt-muted mt-1">{d}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="home-eyebrow">Verification & activation</div>
            <h2 className="font-display vt-h2">Account verification tracker</h2>
            <div className="card-panel p-5 mt-6">
              <ol className="vt-tracker">
                {TRACKER.map((t, i) => (
                  <li key={t}>
                    <Circle size={14} />
                    <span>
                      {i + 1}. {t}
                    </span>
                    <em>pending</em>
                  </li>
                ))}
              </ol>
              <div className="mt-5 pt-4 border-t border-[var(--border)]">
                <div className="text-sm font-medium flex items-center gap-2">
                  <FileText size={14} /> Required documents
                </div>
                <ul className="text-sm vt-muted mt-2 space-y-1">
                  <li>PAN card · Aadhaar / address proof · Bank details</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-band">
        <div className="container-xl max-w-3xl">
          <div className="home-eyebrow">FAQs</div>
          <h2 className="font-display vt-h2">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-6">
            {FAQS.map(([q, a], i) => (
              <AccordionItem key={i} value={`q${i}`}>
                <AccordionTrigger>{q}</AccordionTrigger>
                <AccordionContent className="vt-muted">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              to={trialHref}
              className="btn-amber rounded-full px-6 py-3 text-sm inline-flex items-center gap-2"
            >
              Launch ₹1L 5-Min Trial <ArrowRight size={14} />
            </Link>
            <Link
              to="/rules"
              className="btn-ghost rounded-full px-6 py-3 text-sm inline-flex items-center gap-2"
            >
              <ShieldCheck size={14} /> Read the rules
            </Link>
            <Link
              to={challengeHref}
              className="btn-ghost rounded-full px-6 py-3 text-sm inline-flex items-center gap-2"
            >
              <Server size={14} /> View Challenge Plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
