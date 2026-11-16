import { SampleAccounts, StatusPill } from "./TraderScreens";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { api, formatINR } from "../../lib/api";
import { ArrowRight, Rocket, CandlestickChart, ShieldCheck } from "lucide-react";

export default function UserAccounts() {
  const [traderAccounts, setTraderAccounts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    api
      .get("/me/accounts")
      .then((r) => {
        const d = r.data;
        if (Array.isArray(d)) {
          setOrders(d);
        } else {
          setTraderAccounts(d?.accounts || []);
          setOrders(d?.orders || []);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 6000);
    return () => clearInterval(id);
  }, [load]);

  const statusBadge = (s) => {
    const map = {
      pending_payment: { bg: "rgba(245,182,56,0.15)", text: "#ffd166", label: "Awaiting payment" },
      pending_verification: { bg: "rgba(245,182,56,0.15)", text: "#ffd166", label: "Pending" },
      completed: { bg: "rgba(41,211,154,0.15)", text: "#29d39a", label: "Active" },
      rejected: { bg: "rgba(255,85,116,0.15)", text: "#ff5574", label: "Rejected" },
    };
    const m = map[s] || map.pending_verification;
    return (
      <span
        className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full"
        style={{ background: m.bg, color: m.text }}
      >
        {m.label}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Accounts</h1>
          <p className="text-sm text-[var(--muted)] mt-2">
            Your active challenge & funded accounts, wallet balances, and challenge orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/terminal"
            className="btn-ghost rounded-full px-5 py-2.5 text-sm inline-flex items-center gap-2"
          >
            <CandlestickChart size={14} /> Trade now
          </Link>
          <Link
            to="/challenges"
            className="btn-amber rounded-full px-5 py-2.5 text-sm inline-flex items-center gap-2"
          >
            Buy new account <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {!loaded ? (
        <div className="card-panel p-8 mt-10 text-center text-[var(--muted)]">Loading…</div>
      ) : traderAccounts.length || orders.length ? (
        <div className="space-y-8 mt-10">
          {traderAccounts.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck size={16} className="text-[var(--emerald)]" />
                <h2 className="font-display text-xl">
                  Active trading accounts ({traderAccounts.length})
                </h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {traderAccounts.map((a, i) => {
                  const pnl = Number(a.realized_pnl || 0);
                  return (
                    <div
                      key={a.id || i}
                      className="card-panel p-6 acct-card"
                      data-testid={`user-account-${i}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest font-mono text-[var(--muted-2)]">
                            {a.account_number || a.id} · {a.account_type || "Challenge"}
                          </div>
                          <div className="font-display text-2xl mt-1">{a.plan_name}</div>
                        </div>
                        <StatusPill status={a.status || "Active"} />
                      </div>
                      <dl className="acct-meta tabular-nums">
                        <div>
                          <dt>Capital</dt>
                          <dd>{formatINR(a.starting_capital || 0)}</dd>
                        </div>
                        <div>
                          <dt>Balance</dt>
                          <dd>{formatINR(a.balance || 0)}</dd>
                        </div>
                        <div>
                          <dt>Available margin</dt>
                          <dd>{formatINR(a.available_margin ?? a.balance ?? 0)}</dd>
                        </div>
                        <div>
                          <dt>Realized P&L</dt>
                          <dd className={pnl >= 0 ? "text-[var(--emerald)]" : "text-[var(--rose)]"}>
                            {pnl >= 0 ? "+" : "−"}
                            {formatINR(Math.abs(pnl))}
                          </dd>
                        </div>
                        <div>
                          <dt>Profit split</dt>
                          <dd>{a.profit_split || 70}%</dd>
                        </div>
                        <div>
                          <dt>Max drawdown</dt>
                          <dd>{a.max_loss_limit || 20}%</dd>
                        </div>
                      </dl>
                      {a.note && <div className="text-xs text-[var(--muted)] mt-3">{a.note}</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {orders.length > 0 && (
            <section>
              <h2 className="font-display text-xl mb-4">Challenge purchases ({orders.length})</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {orders.map((o, i) => (
                  <div key={o.id || i} className="card-panel p-6" data-testid={`user-order-${i}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-mono text-[var(--muted-2)]">
                          Plan order
                        </div>
                        <div className="font-display text-2xl mt-1">{o.plan_name}</div>
                      </div>
                      <Rocket size={18} className="text-[var(--accent)]" />
                    </div>
                    <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs tabular-nums">
                      <div className="text-[var(--muted)]">
                        Paid <span className="text-white font-mono">{formatINR(o.amount)}</span>
                      </div>
                      {statusBadge(o.status)}
                    </div>
                    <div className="text-[11px] text-[var(--muted-2)] mt-3 font-mono">
                      {new Date(o.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="card-panel p-10 mt-10 text-center">
          <div className="font-display text-2xl">You don't have any accounts yet</div>
          <p className="text-sm text-[var(--muted)] mt-3 max-w-md mx-auto">
            Pick an account type and size, pay once, and start trading simulated capital
            immediately.
          </p>
          <Link
            to="/challenges"
            className="btn-amber rounded-full px-6 py-3 text-sm mt-6 inline-flex items-center gap-2"
          >
            Browse accounts <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <SampleAccounts />
    </div>
  );
}
