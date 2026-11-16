import { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useSettings } from "../context/SettingsContext";
import { maskUtr, safeHttps, formatAmount } from "../lib/trust";
import {
  ShieldCheck,
  Building2,
  FileText,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Send,
  Headphones,
  BadgeCheck,
  Wallet,
  Users,
  UserCheck,
  TrendingUp,
  ArrowRight,
  Quote,
} from "lucide-react";

const STAT_ICONS = [Wallet, BadgeCheck, UserCheck, Users];

/** Counts up the numeric part of a value like "₹12,50,000" or "1,240+" once visible. */
function CountUp({ value }) {
  const text = String(value ?? "");
  const m = text.match(/[\d,]+(\.\d+)?/);
  const target = m ? Number(m[0].replace(/,/g, "")) : NaN;
  const [shown, setShown] = useState(isNaN(target) ? text : text.replace(m[0], "0"));
  const ref = useRef(null);
  useEffect(() => {
    if (isNaN(target)) {
      setShown(text);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let raf, start;
    const run = () => {
      const step = (t) => {
        start ??= t;
        const p = Math.min(1, (t - start) / 1200);
        const cur = Math.round(target * (1 - Math.pow(1 - p, 3)));
        setShown(text.replace(m[0], cur.toLocaleString("en-IN")));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) {
        run();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line
  }, [text]);
  return <span ref={ref}>{shown}</span>;
}

export function TrustStats({ stats }) {
  const list = (stats || []).filter((s) => s && s.label);
  if (!list.length) return null;
  return (
    <div className="trust-stats">
      {list.map((s, i) => {
        const Icon = STAT_ICONS[i % STAT_ICONS.length];
        return (
          <div key={i} className="trust-stat">
            <Icon className="trust-stat-icon" size={20} />
            <div className="font-display trust-stat-value">
              <CountUp value={s.value} />
            </div>
            <div className="trust-stat-label">{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function CompanyDetails({ company = {}, documents = [], team = [] }) {
  const ig = safeHttps(company.instagram),
    tg = safeHttps(company.telegram);
  const ids = [
    ["GST", company.gst],
    ["CIN", company.cin],
    ["PAN", company.pan],
    ["TAN", company.tan],
  ].filter(([, v]) => v);
  const docs = (documents || []).filter((d) => d && d.enabled !== false && d.name);
  const people = (team || []).filter((p) => p && p.name);
  return (
    <div className="trust-company">
      <div className="glass-card p-6 md:p-8">
        <div className="flex items-center gap-2 font-display text-xl mb-5">
          <Building2 size={18} className="text-[var(--accent)]" />{" "}
          {company.legal_name || "Company details"}
        </div>
        <div className="trust-id-grid">
          {ids.map(([k, v]) => (
            <div key={k} className="trust-id">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <div className="trust-contact-list">
          {company.address && (
            <div>
              <MapPin size={15} /> {company.address}
            </div>
          )}
          {company.phone && (
            <a href={`tel:${company.phone.replace(/\s/g, "")}`}>
              <Phone size={15} /> {company.phone}
            </a>
          )}
          {company.email && (
            <a href={`mailto:${company.email}`}>
              <Mail size={15} /> {company.email}
            </a>
          )}
          {ig && (
            <a href={ig} target="_blank" rel="noopener noreferrer">
              <Instagram size={15} /> Instagram
            </a>
          )}
          {tg && (
            <a href={tg} target="_blank" rel="noopener noreferrer">
              <Send size={15} /> Telegram
            </a>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 font-display text-lg mb-4">
            <FileText size={17} className="text-[var(--accent)]" /> Registration documents
          </div>
          {docs.length ? (
            <ul className="trust-docs">
              {docs.map((d, i) => {
                const url = safeHttps(d.url);
                return (
                  <li key={i}>
                    <span>{d.name}</span>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        View <ArrowRight size={13} />
                      </a>
                    ) : (
                      <em>On request</em>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">Documents will be published here soon.</p>
          )}
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 font-display text-lg mb-4">
            <Headphones size={17} className="text-[var(--accent)]" /> Support team
          </div>
          {people.length ? (
            <ul className="trust-team">
              {people.map((p, i) => (
                <li key={i}>
                  <span className="trust-avatar" aria-hidden="true">
                    {p.name.trim()[0]}
                  </span>
                  <div>
                    <strong>{p.name}</strong>
                    <small>{[p.role, p.contact].filter(Boolean).join(" · ")}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Reach us any time at {company.email || "our support email"}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PayoutProofs({ proofs, limit }) {
  const list = (proofs || []).filter((p) => p && p.enabled !== false && p.payout_id);
  if (!list.length) return null;
  return (
    <div className="trust-proofs">
      {(limit ? list.slice(0, limit) : list).map((p, i) => (
        <article key={i} className="trust-proof">
          <div className="trust-proof-top">
            <span className="trust-verified">
              <ShieldCheck size={14} /> Verified payout
            </span>
            <span className="font-mono text-xs text-[var(--muted-2)]">{p.payout_id}</span>
          </div>
          <div className="font-display trust-proof-amount">{formatAmount(p.amount)}</div>
          <dl className="trust-proof-meta">
            <div>
              <dt>Trader ID</dt>
              <dd>{p.trader_id || "—"}</dd>
            </div>
            <div>
              <dt>Account ID</dt>
              <dd>{p.account_id || "—"}</dd>
            </div>
            <div>
              <dt>Requested</dt>
              <dd>{p.request_date || "—"}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{p.payment_date || "—"}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{p.method || "—"}</dd>
            </div>
            <div>
              <dt>UTR</dt>
              <dd className="font-mono">{maskUtr(p.utr_last4)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

export function SuccessStories({ stories, limit }) {
  const list = (stories || []).filter((s) => s && s.enabled !== false && s.name && s.story);
  if (!list.length) return null;
  return (
    <div className="trust-stories">
      {(limit ? list.slice(0, limit) : list).map((s, i) => (
        <figure key={i} className="glass-card p-6 trust-story">
          <Quote size={22} className="text-[var(--accent)]" />
          <blockquote>{s.story}</blockquote>
          <figcaption>
            <strong>{s.name}</strong>
            <span>{[s.city, s.plan].filter(Boolean).join(" · ")}</span>
            {s.payout && (
              <em>
                <TrendingUp size={13} /> {formatAmount(s.payout)} withdrawn
              </em>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Home page block: stats, latest payout proofs, success stories and company summary. */
export default function TrustSection() {
  const { settings } = useSettings();
  const t = settings.trust || {};
  if (t.enabled === false) return null;
  return (
    <section className="home-band trust-band" aria-labelledby="trust-heading">
      <div className="container-xl">
        <div className="home-section-heading">
          <div>
            <div className="home-eyebrow">Verified & registered</div>
            <h2 id="trust-heading" className="font-display">
              {t.heading}
            </h2>
            <p>{t.subtitle}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              to="/verify-payout"
              className="btn-amber rounded-full px-5 py-2.5 text-sm inline-flex items-center gap-2"
            >
              <ShieldCheck size={16} /> Verify a payout
            </Link>
            <Link
              to="/trust"
              className="rounded-full px-5 py-2.5 text-sm border border-[var(--border-hi)] inline-flex items-center gap-2"
            >
              Trust center <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <TrustStats stats={t.stats} />
        {(t.payout_proofs || []).some((p) => p?.enabled !== false && p?.payout_id) && (
          <>
            <h3 className="font-display text-2xl mt-12 mb-5">Genuine payout proofs</h3>
            <PayoutProofs proofs={t.payout_proofs} limit={6} />
          </>
        )}
        {(t.stories || []).some((s) => s?.enabled !== false && s?.name) && (
          <>
            <h3 className="font-display text-2xl mt-12 mb-5">Trader success stories</h3>
            <SuccessStories stories={t.stories} limit={3} />
          </>
        )}
        <div className="mt-12">
          <CompanyDetails company={t.company} documents={t.documents} team={t.support_team} />
        </div>
      </div>
    </section>
  );
}
