import { NavLink, Navigate, Outlet, useNavigate, Link, useLocation } from "@/lib/router-compat";
import Showcase3D from "../../components/Showcase3D";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  Wallet,
  Award,
  Settings as SettingsIcon,
  Briefcase,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Sparkles,
  CandlestickChart,
  BookOpen,
  Layers,
  ListOrdered,
  Target,
  ShieldAlert,
  CalendarDays,
  BadgeCheck,
  IdCard,
  Bell,
  LifeBuoy,
  Timer,
  Lock,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import BrandLogo from "../../components/BrandLogo";
import { useTraderState } from "../../lib/useTraderState";
import { formatCountdown } from "../../lib/trial";

const links = [
  { group: "Trading" },
  {
    to: "/app",
    label: "Overview",
    icon: <LayoutDashboard size={16} />,
    end: true,
    id: "dashboard",
  },
  { to: "/app/accounts", label: "My Accounts", icon: <Briefcase size={16} />, id: "accounts" },
  { to: "/app/terminal", label: "Trading Terminal", icon: <CandlestickChart size={16} /> },
  { to: "/app/tradebook", label: "Trade Book", icon: <BookOpen size={16} /> },
  { to: "/app/positions", label: "Positions", icon: <Layers size={16} /> },
  { to: "/app/orders", label: "Orders", icon: <ListOrdered size={16} /> },
  { group: "Performance" },
  { to: "/app/evaluation", label: "Evaluation Progress", icon: <Target size={16} /> },
  { to: "/app/risk", label: "Risk Management", icon: <ShieldAlert size={16} /> },
  { to: "/app/calendar", label: "Trading Calendar", icon: <CalendarDays size={16} /> },
  { to: "/app/insights", label: "AI Insights", icon: <Sparkles size={16} /> },
  { group: "Funding" },
  { to: "/app/funded", label: "Funded Account", icon: <BadgeCheck size={16} /> },
  { to: "/app/kyc", label: "KYC", icon: <IdCard size={16} /> },
  { to: "/app/certificates", label: "Certificates", icon: <Award size={16} /> },
  { to: "/app/payouts", label: "Payouts", icon: <Wallet size={16} /> },
  { group: "Account" },
  { to: "/app/notifications", label: "Notifications", icon: <Bell size={16} /> },
  { to: "/app/support", label: "Support", icon: <LifeBuoy size={16} /> },
  {
    to: "/app/settings",
    label: "Profile Settings",
    icon: <SettingsIcon size={16} />,
    id: "settings",
  },
];

export default function UserDashboardLayout() {
  const loc3d = useLocation();
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const { trialStatus } = useTraderState({ pollMs: 8000 });
  if (loading) return <div className="container-xl py-24 text-[var(--muted)]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;

  const initials = (user.name || user.email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[260px_1fr]">
      {/* Mobile topbar */}
      <div className="md:hidden flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-1)] p-4 sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-2">
          <BrandLogo size="sm" />
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          className="btn-ghost px-3 py-2 rounded-lg"
          data-testid="dash-mobile-toggle"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <aside
        className={`${open ? "block" : "hidden"} md:block border-r border-[var(--border)] bg-[var(--bg-1)] p-5 md:sticky md:top-0 md:h-screen overflow-y-auto`}
      >
        <Link to="/" className="hidden md:flex items-center gap-2">
          <BrandLogo size="md" />
        </Link>

        <nav className="mt-8 md:mt-10 flex flex-col gap-0.5">
          {links.map((l, i) =>
            l.group ? (
              <div key={`g${i}`} className="dash-nav-group">
                {l.group}
              </div>
            ) : (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${isActive ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-white"}`
                }
                data-testid={`dash-nav-${l.id || l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              >
                {l.icon}
                {l.label}
              </NavLink>
            ),
          )}
        </nav>

        <Link
          to="/challenges"
          className="btn-amber rounded-full px-4 py-2.5 text-xs w-full text-center mt-6 inline-block"
        >
          Buy new account
        </Link>

        <div className="mt-6 chip w-full justify-center text-[10px]">
          <ShieldCheck size={10} /> Simulated trading environment
        </div>
        <Link
          to="/rules"
          className="text-[11px] text-[var(--muted-2)] mt-2 block text-center hover:text-white"
        >
          Rules
        </Link>

        <div className="mt-8 pt-6 border-t border-[var(--border)] flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full bg-[var(--accent)] text-white grid place-items-center font-semibold text-xs shrink-0"
            data-testid="dash-user-initials"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{user.name || "—"}</div>
            <div className="text-[10px] text-[var(--muted-2)] truncate font-mono">{user.email}</div>
          </div>
        </div>
        <button
          onClick={async () => {
            await logout();
            nav("/login");
          }}
          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--muted)] hover:text-white hover:bg-[var(--surface)] w-full"
          data-testid="dash-signout"
        >
          <LogOut size={14} /> Sign out
        </button>
      </aside>

      <main className="p-4 sm:p-5 md:p-8 lg:p-12 max-w-6xl w-full min-w-0 has-showcase has-showcase--panel">
        <Showcase3D path={loc3d.pathname} />
        <div className="showcase-content">
          {trialStatus?.isTrialAccount && (
            <div
              data-testid="explorer-trial-banner"
              className={`mb-5 rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 tabular-nums ${
                trialStatus.isLocked
                  ? "border-[var(--rose)]/45 bg-[var(--rose)]/10"
                  : "border-[var(--emerald)]/35 bg-[var(--emerald)]/8"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                    trialStatus.isLocked
                      ? "bg-[var(--rose)]/20 text-[var(--rose)]"
                      : "bg-[var(--emerald)]/20 text-[var(--emerald)]"
                  }`}
                >
                  {trialStatus.isLocked ? <Lock size={16} /> : <Timer size={16} />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                    <span>₹1,00,000 Platform Explorer</span>
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                        trialStatus.isLocked
                          ? "bg-[var(--rose)]/20 text-[var(--rose)]"
                          : "bg-[var(--emerald)]/20 text-[var(--emerald)]"
                      }`}
                    >
                      {trialStatus.isLocked
                        ? "TRIAL LOCKED"
                        : `${formatCountdown(trialStatus.secondsRemaining)} left`}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[var(--muted)] mt-0.5">
                    {trialStatus.isLocked
                      ? "Your 5-minute Platform Explorer has ended. Purchase a challenge account to unlock trading."
                      : "Live NSE & BSE 5-minute explorer active. Purchase a challenge account anytime for full access."}
                  </p>
                </div>
              </div>
              <Link
                to="/challenges"
                className="btn-amber rounded-full px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
              >
                {trialStatus.isLocked ? "Purchase Account" : "Upgrade Plan"} <ArrowRight size={13} />
              </Link>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
