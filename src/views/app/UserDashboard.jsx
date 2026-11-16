import { useCallback, useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useAuth } from "../../context/AuthContext";
import { api, formatINR } from "../../lib/api";
import { OverviewSample, StatusPill } from "./TraderScreens";
import {
  Wallet,
  Briefcase,
  TrendingUp,
  Coins,
  ArrowRight,
  Rocket,
  ArrowDownLeft,
  CandlestickChart,
} from "lucide-react";

export default function UserDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api
      .get("/me/dashboard")
      .then((r) => setData(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 6000);
    return () => clearInterval(id);
  }, [load]);

  const firstName = (user?.name || "there").split(" ")[0];

  const stat = (label, value, sub, Icon) => (
    <div
      className="card-panel p-5 md:p-6"
      data-testid={`stat-${label.toLowerCase().replace(/[^a-z]/g, "")}`}
    >
      <div className="flex items-start justify-between">
        <div className="text-[10px] uppercase tracking-widest font-mono text-[var(--muted-2)]">
          {label}
        </div>
        <Icon size={16} className="text-[var(--accent)]" />
      </div>
      <div className="font-display text-3xl md:text-4xl mt-3 text-white tabular-nums">{value}</div>
      {sub && <div className="text-xs text-[var(--muted-2)] mt-1 tabular-nums">{sub}</div>}
    </div>
  );

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">
            Welcome back, {firstName} <span className="align-middle">👋</span>
          </h1>
          <p className="text-sm text-[var(--muted)] mt-2">
            Here's your funded capital, live trading wallets, and recent ledger activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/terminal"
            className="btn-ghost rounded-full px-5 py-2.5 text-sm inline-flex items-center gap-2"
          >
            <CandlestickChart size={14} /> Open terminal
          </Link>
          <Link
            to="/challenges"
            className="btn-amber rounded-full px-5 py-2.5 text-sm inline-flex items-center gap-2"
          >
            Buy new account <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {stat(
          "Simulated capital",
          formatINR(data?.simulated_capital || 0),
          `${data?.funded_accounts_active || 0} active`,
          Coins,
        )}
        {stat(
          "Funded accounts",
          data?.funded_accounts_active ?? "—",
          `${data?.funded_accounts_total || 0} total`,
          Briefcase,
        )}
        {stat("Net P&L", formatINR(data?.net_pnl || 0), "realized across accounts", TrendingUp)}
        {stat(
          "Total paid out",
          formatINR(data?.total_paid_out || 0),
          `${data?.payouts_count || 0} payouts`,
          Wallet,
        )}
      </div>

      <div className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="font-display text-2xl">Your trading accounts</h2>
          <Link to="/app/accounts" className="link-underline text-sm text-[var(--muted)]">
            View all →
          </Link>
        </div>

        {data?.accounts?.length ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.accounts.map((o, i) => (
              <div key={o.id || i} className="card-panel p-5" data-testid={`account-card-${i}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-mono text-[var(--muted-2)]">
                      {o.account_number || o.id} · {o.account_type || "Challenge"}
                    </div>
                    <div className="font-display text-xl mt-1">{o.plan_name}</div>
                  </div>
                  <StatusPill status={o.status || "Active"} />
                </div>
                <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-baseline justify-between tabular-nums">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted-2)]">
                      Balance
                    </div>
                    <div className="font-display text-lg text-white">
                      {formatINR(o.balance ?? o.starting_capital ?? o.amount ?? 0)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted-2)]">
                      Available margin
                    </div>
                    <div className="text-xs font-mono text-[var(--emerald)]">
                      {formatINR(o.available_margin ?? o.balance ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-panel p-8 text-center">
            <Rocket size={24} className="text-[var(--accent)] mx-auto" />
            <div className="font-display text-xl mt-3">No accounts yet</div>
            <p className="text-sm text-[var(--muted)] mt-2 max-w-md mx-auto">
              Buy your first funded account and it'll appear here instantly after payment.
            </p>
            <Link
              to="/challenges"
              className="btn-amber rounded-full px-5 py-2.5 text-sm inline-flex items-center gap-2 mt-5"
            >
              Get funded <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>

      {!!data?.recent_transactions?.length && (
        <div className="mt-10">
          <div className="flex items-end justify-between mb-4">
            <h2 className="font-display text-2xl">Recent fund credits & ledger</h2>
            <Link to="/app/accounts" className="link-underline text-sm text-[var(--muted)]">
              Account details →
            </Link>
          </div>
          <div className="card-panel divide-y divide-[var(--border)]">
            {data.recent_transactions.map((tx) => {
              const isDebit = tx.kind === "debit";
              return (
                <div
                  key={tx.id}
                  className="p-4 flex items-center justify-between gap-4 tabular-nums"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="notif-icon">
                      <ArrowDownLeft size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{tx.note || tx.kind}</div>
                      <div className="text-xs text-[var(--muted-2)] font-mono">
                        {tx.account_number || tx.account_id} ·{" "}
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono font-semibold ${isDebit ? "text-[var(--rose)]" : "text-[var(--emerald)]"}`}
                    >
                      {isDebit ? "−" : "+"}
                      {formatINR(tx.amount)}
                    </div>
                    <div className="text-[11px] text-[var(--muted-2)]">
                      Bal {formatINR(tx.balance_after)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <OverviewSample />
    </div>
  );
}
