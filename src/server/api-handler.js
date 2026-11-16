// Server-side port of the original FastAPI backend (backend/server.py).
// Data lives in public.docs (one JSON document per row, grouped by collection).
// Only imported dynamically from src/routes/api/$.ts so it never reaches the browser.
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { DEFAULT_SETTINGS } from "../lib/default-settings";

const RAZORPAY_BASE = "https://api.razorpay.com/v1";
const LEAGUE_FEE_EXISTING = 999.0;
const LEAGUE_FEE_NEW = 1499.0;
const ADMIN_HASH =
  "0af7dd4aa251593c51bbd488e420d79d:8c316fb0b44b5de0737374678515c8dfa6f8127005b6be97ca2ad05c753ca8c4df59bd55a53858e14d97ff908f419fcbd9f5298db591aedd9596bcead065a3a8";

import {
  TRIAL_CAPITAL_INR,
  TRIAL_DURATION_MS,
  computeAccountTrialStatus,
  isTrialAccountRecord,
} from "../lib/trial";

class HttpError extends Error {
  constructor(status, detail, extra = null) {
    super(typeof detail === "string" ? detail : "error");
    this.status = status;
    this.detail = detail;
    this.extra = extra;
  }
}
const fail = (status, detail, extra = null) => {
  throw new HttpError(status, detail, extra);
};
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const json = (data, status = 200) =>
  new Response(JSON.stringify(data ?? null), {
    status,
    headers: { "content-type": "application/json" },
  });

function env(name) {
  return process.env[name] || "";
}

// ---------- in-memory fallback store (used when SUPABASE_SERVICE_ROLE_KEY is not set) ----------
const MEMORY_COLLECTIONS = new Map();
let memorySeeded = false;
function ensureMemorySeeded() {
  if (memorySeeded) return;
  memorySeeded = true;
  const col = (name, items) => {
    const m = new Map();
    for (const item of items) m.set(String(item.id), item);
    MEMORY_COLLECTIONS.set(name, m);
  };
  col("plans", [
    {
      id: "plan-starter",
      name: "Starter",
      account_size: 100000,
      challenge_fee: 4999.0,
      original_price: null,
      profit_target_points: 550,
      profit_share: 70,
      max_loss_limit: 20,
      min_trading_days: 8,
      total_trading_days: 10,
      trades_per_day: 3,
      description:
        "Perfect for beginners ready to prove their trading skills and take the first step toward funded capital.",
      features: [
        "₹1,00,000 Funded Account",
        "70% Profit Split",
        "Nifty & BankNifty Trading",
        "No segment restriction",
        "Zerodha, Dhan & Angel One",
        "No hidden rules",
      ],
      popular: false,
      order: 1,
      created_at: "2026-01-01T00:00:00+00:00",
    },
    {
      id: "plan-standard",
      name: "Standard",
      account_size: 200000,
      challenge_fee: 7999.0,
      original_price: null,
      profit_target_points: 650,
      profit_share: 70,
      max_loss_limit: 20,
      min_trading_days: 10,
      total_trading_days: 12,
      trades_per_day: 3,
      description:
        "Built for disciplined traders looking to turn consistent strategies into real funded opportunities.",
      features: [
        "₹2,00,000 Funded Account",
        "70% Profit Split",
        "No segment restriction",
        "Scale Up to ₹5,00,000",
        "Zerodha, Dhan & Angel One",
        "No hidden rules",
      ],
      popular: false,
      order: 2,
      created_at: "2026-01-01T00:00:00+00:00",
    },
    {
      id: "plan-pro",
      name: "Pro",
      account_size: 300000,
      challenge_fee: 14999.0,
      original_price: 18999.0,
      profit_target_points: 750,
      profit_share: 70,
      max_loss_limit: 20,
      min_trading_days: 10,
      total_trading_days: 12,
      trades_per_day: 3,
      description:
        "Designed for serious traders seeking bigger capital, higher profit potential, and greater flexibility.",
      features: [
        "Account Size ₹3,00,000",
        "70% Profit Split",
        "Scale Up to ₹5,00,000",
        "No segment restriction",
        "15 Trading Days",
        "No hidden rules",
      ],
      popular: true,
      order: 3,
      created_at: "2026-01-01T00:00:00+00:00",
    },
    {
      id: "plan-elite",
      name: "Elite",
      account_size: 500000,
      challenge_fee: 14999.0,
      original_price: null,
      profit_target_points: 900,
      profit_share: 70,
      max_loss_limit: 20,
      min_trading_days: 10,
      total_trading_days: 15,
      trades_per_day: 3,
      description: "Our most popular plan. Ideal for disciplined traders ready to scale.",
      features: [
        "Account Size ₹5,00,000",
        "70% Profit Split",
        "No segment restriction",
        "Fund scales to ₹7L",
        "Zerodha/Dhan/Angel One",
        "No hidden rules",
      ],
      popular: false,
      order: 4,
      created_at: "2026-01-01T00:00:00+00:00",
    },
    {
      id: "plan-master",
      name: "Master",
      account_size: 700000,
      challenge_fee: 19999.0,
      original_price: null,
      profit_target_points: 1000,
      profit_share: 70,
      max_loss_limit: 20,
      min_trading_days: 12,
      total_trading_days: 15,
      trades_per_day: 4,
      description: "Built for pros. Maximum capital, top profit share, full market access.",
      features: [
        "Account Size ₹7,00,000",
        "70% Profit Split",
        "No segment restriction",
        "24hr Payouts",
        "No hidden rules",
      ],
      popular: false,
      order: 5,
      created_at: "2026-01-01T00:00:00+00:00",
    },
  ]);
  col("coupons", [
    {
      id: "coupon-welcome10",
      code: "WELCOME10",
      discount_percent: 10,
      active: true,
      description: "10% off — welcome to IndiFunded",
      max_uses: null,
      used_count: 0,
      expires_at: null,
      created_at: "2026-01-01T00:00:00+00:00",
    },
    {
      id: "coupon-launch20",
      code: "LAUNCH20",
      discount_percent: 20,
      active: true,
      description: "20% launch discount",
      max_uses: 500,
      used_count: 0,
      expires_at: null,
      created_at: "2026-01-01T00:00:00+00:00",
    },
    {
      id: "coupon-trader5",
      code: "TRADER5",
      discount_percent: 5,
      active: true,
      description: "5% off for community traders",
      max_uses: null,
      used_count: 0,
      expires_at: null,
      created_at: "2026-01-01T00:00:00+00:00",
    },
  ]);
  col("certificates", [
    {
      id: "cert-seed",
      image_url: "/certificates/cert-1.png",
      trader_name: "Vivek Raut",
      amount: 6700,
      plan: "Starter",
      account_size: 100000,
      payout_date: "09/05/2026",
      order: 1,
      visible: true,
      created_at: "2026-01-01T00:00:00+00:00",
    },
  ]);
  col("blogs", [
    {
      id: "blog-1",
      slug: "turn-small-investment-into-profitable-trading",
      title: "Unlock Your Potential: Turn a Small Investment into a Profitable Trading Venture",
      excerpt:
        "Trading can seem intimidating, especially when considering the challenge fees for a funded account. But with the right approach, a small investment goes a long way.",
      content:
        "Trading can seem intimidating, especially when considering the challenge fees for a funded account. However, it's important to understand the long-term upside. At IndiFunded, a one-time challenge fee unlocks access to accounts of up to ₹5,00,000 with 70% profit sharing. Start small, prove your discipline, and scale systematically.\n\n**Why it works**\n- Capital efficiency: you keep 70% of profits without risking your own capital beyond the challenge fee.\n- Risk discipline: hard drawdown rules train you to protect capital.\n- Scaling: passing traders see account increments every 2 months up to ₹5L.",
      cover_image: "https://images.unsplash.com/photo-1642790595397-7047dc98fa72?w=1200",
      author: "IndiFunded Team",
      published: true,
      created_at: "2026-01-03T00:00:00+00:00",
    },
    {
      id: "blog-2",
      slug: "rise-of-indifunded-indian-trading",
      title: "Uncovering the Rise of IndiFunded: A New Player in the Indian Trading Scene",
      excerpt:
        "As India's financial sector expands, traders need platforms built for NSE/BSE. Here's why IndiFunded is changing the game.",
      content:
        "In today's fast-paced trading landscape, the right platform can make all the difference for traders. As India's financial sector expands, IndiFunded has emerged as India's 1st prop trading firm tailored to NSE stocks, BankNifty, Nifty50 and F&O segments.\n\n**What sets us apart**\n- Rupee-denominated accounts\n- Payouts within 24 hours\n- Integration with Zerodha, Angel One, Dhan, Upstox\n- A community of Indian traders",
      cover_image: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200",
      author: "IndiFunded Team",
      published: true,
      created_at: "2026-01-02T00:00:00+00:00",
    },
    {
      id: "blog-3",
      slug: "strategies-for-maximizing-profits",
      title: "Strategies for Maximizing Profits with Funded Trading Accounts",
      excerpt:
        "Fresh methods to boost profits while keeping risk tight. A playbook from IndiFunded's top traders.",
      content:
        "Traders constantly seek methods to boost profits while keeping risk tight. Here are three proven strategies from our funded traders:\n\n1. **Plan your trading day**: pre-market prep beats reactive trading.\n2. **Respect the loss cap**: 20% max loss isn't a target, it's a guardrail — stay well under it.\n3. **Let winners run**: 70% profit accuracy requires fewer losers, not more winners.",
      cover_image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200",
      author: "IndiFunded Team",
      published: true,
      created_at: "2026-01-01T00:00:00+00:00",
    },
  ]);
  col("users", [
    {
      id: "trader-seed-1",
      email: "rahul.chouhan@example.in",
      name: "Rahul Chouhan",
      phone: "+91 98201 44120",
      apk_username: "rahul.chouhan@example.in",
      apk_password: "RAHUL@1234",
      kyc: {
        full_name: "Rahul Chouhan",
        pan: "ABCDE1234F",
        status: "submitted",
        submitted_at: "2026-02-01T10:00:00+00:00",
      },
      created_at: "2026-01-15T09:30:00+00:00",
    },
    {
      id: "trader-seed-2",
      email: "priya.sharma@example.in",
      name: "Priya Sharma",
      phone: "+91 98765 21098",
      apk_username: "priya.sharma@example.in",
      apk_password: "PRIYA@1234",
      kyc: {},
      created_at: "2026-01-20T11:15:00+00:00",
    },
  ]);
  col("trader_accounts", [
    {
      id: "acct-seed-1",
      account_number: "IF-FD-1001",
      user_id: "trader-seed-1",
      user_email: "rahul.chouhan@example.in",
      plan_name: "Pro",
      account_type: "Funded",
      starting_capital: 300000,
      balance: 318450,
      available_margin: 318450,
      used_margin: 0,
      realized_pnl: 18450,
      profit_split: 70,
      max_loss_limit: 20,
      trades_per_day: 5,
      status: "Funded",
      note: "Seeded funded account",
      created_at: "2026-01-16T10:00:00+00:00",
      updated_at: "2026-01-16T10:00:00+00:00",
    },
    {
      id: "acct-seed-2",
      account_number: "IF-CH-1002",
      user_id: "trader-seed-2",
      user_email: "priya.sharma@example.in",
      plan_name: "Standard",
      account_type: "Challenge",
      starting_capital: 200000,
      balance: 200000,
      available_margin: 200000,
      used_margin: 0,
      realized_pnl: 0,
      profit_split: 70,
      max_loss_limit: 20,
      trades_per_day: 3,
      status: "Active",
      note: "Seeded challenge account",
      created_at: "2026-01-21T09:30:00+00:00",
      updated_at: "2026-01-21T09:30:00+00:00",
    },
  ]);
}
function memoryStore() {
  ensureMemorySeeded();
  const mapOf = (col) => {
    if (!MEMORY_COLLECTIONS.has(col)) MEMORY_COLLECTIONS.set(col, new Map());
    return MEMORY_COLLECTIONS.get(col);
  };
  const all = async (col) => [...mapOf(col).values()];
  const get = async (col, id) => mapOf(col).get(String(id)) ?? null;
  const put = async (col, doc) => {
    mapOf(col).set(String(doc.id), doc);
    return doc;
  };
  const del = async (col, id) => {
    mapOf(col).delete(String(id));
  };
  const delAll = async (col) => {
    mapOf(col).clear();
  };
  const findOne = async (col, pred) => (await all(col)).find(pred) || null;
  return { all, get, put, del, delAll, findOne };
}

// ---------- document store ----------
function store(sb) {
  const all = async (col) => {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from("docs")
        .select("data")
        .eq("collection", col)
        .range(from, from + 999);
      if (error) throw error;
      out.push(...data.map((r) => r.data));
      if (data.length < 1000) break;
    }
    return out;
  };
  const get = async (col, id) => {
    const { data, error } = await sb
      .from("docs")
      .select("data")
      .eq("collection", col)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  };
  const put = async (col, doc) => {
    const { error } = await sb
      .from("docs")
      .upsert({ collection: col, id: String(doc.id), data: doc });
    if (error) throw error;
    return doc;
  };
  const del = async (col, id) => {
    const { error } = await sb.from("docs").delete().eq("collection", col).eq("id", id);
    if (error) throw error;
  };
  const delAll = async (col) => {
    const { error } = await sb.from("docs").delete().eq("collection", col);
    if (error) throw error;
  };
  const findOne = async (col, pred) => (await all(col)).find(pred) || null;
  return { all, get, put, del, delAll, findOne };
}

const byDesc = (k) => (a, b) => String(b[k] ?? "").localeCompare(String(a[k] ?? ""));
const byNum =
  (k, dir = 1) =>
  (a, b) =>
    dir * ((Number(a[k]) || 0) - (Number(b[k]) || 0));

function mergeSettings(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (
      base &&
      typeof base[k] === "object" &&
      !Array.isArray(base[k]) &&
      v &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      out[k] = mergeSettings(base[k], v);
    } else out[k] = v;
  }
  return out;
}

// ---------- crypto ----------
async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    typeof message === "string" ? new TextEncoder().encode(message) : message,
  );
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---------- razorpay ----------
function rzAuth() {
  const id = env("RAZORPAY_KEY_ID");
  const secret = env("RAZORPAY_KEY_SECRET");
  return { id, secret, header: "Basic " + btoa(`${id}:${secret}`) };
}
async function rz(method, path, body) {
  const { header } = rzAuth();
  let resp;
  try {
    resp = await fetch(RAZORPAY_BASE + path, {
      method,
      headers: { Authorization: header, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    fail(502, `Razorpay request failed: ${e}`);
  }
  return resp;
}
function requireRazorpay() {
  const { id, secret } = rzAuth();
  if (!id || !secret) fail(500, "Razorpay is not configured");
}

// ---------- validation helpers ----------
const str = (v) => (v == null ? "" : String(v));
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(v));
function requireEmail(v, field = "email") {
  if (!isEmail(v)) fail(422, `Invalid ${field}`);
  return str(v).trim().toLowerCase();
}
const num = (v, d = 0) =>
  v === null || v === undefined || v === "" || isNaN(Number(v)) ? d : Number(v);
const int = (v, d = 0) => Math.trunc(num(v, d));
const bool = (v, d = false) => (v === undefined || v === null ? d : !!v);
const strList = (v) => (Array.isArray(v) ? v.map(str) : []);

function planFields(b) {
  if (!str(b.name)) fail(422, "name is required");
  return {
    name: str(b.name),
    account_size: int(b.account_size),
    challenge_fee: num(b.challenge_fee),
    original_price:
      b.original_price === null || b.original_price === undefined || b.original_price === ""
        ? null
        : num(b.original_price),
    profit_target_points: int(b.profit_target_points, 750),
    profit_share: int(b.profit_share, 70),
    max_loss_limit: int(b.max_loss_limit, 20),
    min_trading_days: int(b.min_trading_days, 10),
    total_trading_days: int(b.total_trading_days, 15),
    trades_per_day: int(b.trades_per_day, 3),
    description: str(b.description),
    features: strList(b.features),
    popular: bool(b.popular),
    order: int(b.order),
  };
}
function blogFields(b) {
  if (!str(b.slug) || !str(b.title)) fail(422, "slug and title are required");
  return {
    slug: str(b.slug),
    title: str(b.title),
    excerpt: str(b.excerpt),
    content: str(b.content),
    cover_image: str(b.cover_image),
    author: str(b.author) || "IndiFunded Team",
    published: bool(b.published, true),
  };
}
function certFields(b) {
  if (!str(b.image_url)) fail(422, "image_url is required");
  return {
    image_url: str(b.image_url),
    trader_name: str(b.trader_name),
    amount: num(b.amount),
    plan: str(b.plan),
    account_size: int(b.account_size),
    payout_date: str(b.payout_date),
    order: int(b.order),
    visible: bool(b.visible, true),
    ...(b.trader_email ? { trader_email: str(b.trader_email).toLowerCase() } : {}),
  };
}
function couponFields(b) {
  const dp = num(b.discount_percent);
  if (dp < 0 || dp > 90) fail(422, "discount_percent must be between 0 and 90");
  return {
    code: str(b.code).trim().toUpperCase(),
    discount_percent: dp,
    active: bool(b.active, true),
    max_uses:
      b.max_uses === null || b.max_uses === undefined || b.max_uses === "" ? null : int(b.max_uses),
    expires_at: b.expires_at ? str(b.expires_at) : null,
    description: str(b.description),
  };
}
function leaderboardFields(b) {
  if (!str(b.name)) fail(422, "name is required");
  return {
    name: str(b.name),
    plan: str(b.plan) || "Standard",
    total_payout: num(b.total_payout),
    city: str(b.city),
    avatar_url: str(b.avatar_url),
    verified: bool(b.verified, true),
    rank_note: str(b.rank_note),
  };
}

export function couponUsable(c) {
  if (!c || c.active === false) return false;
  if (c.max_uses !== null && c.max_uses !== undefined && (c.used_count || 0) >= c.max_uses)
    return false;
  if (c.expires_at) {
    const exp = new Date(c.expires_at);
    if (!isNaN(exp.getTime()) && exp < new Date()) return false;
  }
  return true;
}

// ---------- main ----------
const sendingWelcomeFor = new Set();

export async function handleApi(request, splat) {
  try {
    return await route(request, "/" + (splat || "").replace(/^\/+|\/+$/g, ""));
  } catch (e) {
    if (e instanceof HttpError) {
      return json({ detail: e.detail, ...(e.extra || {}) }, e.status);
    }
    console.error("API error", e);
    return json({ detail: "Internal server error" }, 500);
  }
}

async function route(request, path) {
  const hasServiceRole = !!(env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
  const sb = hasServiceRole
    ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
    : null;
  const db = sb ? store(sb) : memoryStore();
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const seg = path.split("/").filter(Boolean);
  const is = (m, pattern) => {
    if (m !== method) return null;
    const p = pattern.split("/").filter(Boolean);
    if (p.length !== seg.length) return null;
    const params = {};
    for (let i = 0; i < p.length; i++) {
      if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(seg[i]);
      else if (p[i] !== seg[i]) return null;
    }
    return params;
  };
  let rawBody = null;
  const body = async () => {
    if (rawBody === null) rawBody = await request.text();
    if (!rawBody) return {};
    try {
      return JSON.parse(rawBody);
    } catch {
      fail(400, "Invalid JSON");
    }
  };

  const isRealOverride = (v) => Boolean(v && !/^MY_/i.test(v) && v !== '""');
  const adminEmail = () => {
    const o = env("ADMIN_EMAIL").trim().toLowerCase();
    return isRealOverride(o) ? o : "admin@indifunded.com";
  };
  const adminSecret = () =>
    env("ADMIN_SESSION_SECRET") ||
    env("SUPABASE_SERVICE_ROLE_KEY") ||
    createHmac("sha256", "indifunded-admin-secret")
      .update(ADMIN_HASH + (env("SUPABASE_URL") || "local"))
      .digest("hex");
  const verifyAdminPassword = (candidate) => {
    const pw = String(candidate || "");
    const override = env("ADMIN_PASSWORD");
    if (isRealOverride(override)) {
      const a = Buffer.from(pw, "utf8");
      const b = Buffer.from(override, "utf8");
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
    const [salt, hex] = ADMIN_HASH.split(":");
    if (!salt || !hex) return false;
    const derived = scryptSync(pw, salt, 64);
    const expected = Buffer.from(hex, "hex");
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  };
  const signAdminToken = (email) => {
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin-indifunded",
        email,
        role: "admin",
        exp: Date.now() + 7 * 24 * 3600 * 1000,
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", adminSecret()).update(payload).digest("base64url");
    return `ifa.${payload}.${sig}`;
  };
  const verifyAdminToken = (token) => {
    if (!token || !token.startsWith("ifa.")) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [, payload, sig] = parts;
    const expectedSig = createHmac("sha256", adminSecret()).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (!data || data.role !== "admin" || !data.exp || data.exp < Date.now()) return null;
      return {
        id: data.sub || "admin-indifunded",
        email: str(data.email) || adminEmail(),
        name: "IndiFunded Admin",
        phone: "",
        role: "admin",
        created_at: "2026-01-01T00:00:00+00:00",
      };
    } catch {
      return null;
    }
  };

  // ----- auth helpers -----
  let cachedUser;
  const currentUser = async () => {
    if (cachedUser !== undefined) return cachedUser;
    const h = request.headers.get("authorization") || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (!token) fail(401, "Not authenticated");
    if (token.startsWith("ifa.")) {
      const adminUser = verifyAdminToken(token);
      if (!adminUser) fail(401, "Invalid or expired admin session");
      cachedUser = adminUser;
      return cachedUser;
    }
    const authClient = sb ?? (await import("@/integrations/supabase/client")).supabase;
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) fail(401, "Invalid token");
    const au = data.user;
    let role = "user";
    if (sb) {
      const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", au.id);
      if (roles && roles.some((r) => r.role === "admin")) role = "admin";
    }
    let profile = await db.get("users", au.id);
    if (!profile) {
      const name = str(au.user_metadata?.name) || str(au.email).split("@")[0];
      const first = (name.split(" ")[0] || "TRADER").toUpperCase();
      const trialStart = now();
      profile = {
        id: au.id,
        email: str(au.email).toLowerCase(),
        name,
        phone: str(au.user_metadata?.phone),
        apk_username: str(au.email).toLowerCase(),
        apk_password: `${first}@1234`,
        kyc: {},
        trial_started_at: trialStart,
        trial_expires_at: new Date(Date.parse(trialStart) + TRIAL_DURATION_MS).toISOString(),
        created_at: au.created_at || trialStart,
      };
      await db.put("users", profile);
    } else if (!profile.trial_started_at) {
      const trialStart = now();
      profile = {
        ...profile,
        trial_started_at: trialStart,
        trial_expires_at: new Date(Date.parse(trialStart) + TRIAL_DURATION_MS).toISOString(),
      };
      await db.put("users", profile);
    }
    cachedUser = { ...profile, role };
    return cachedUser;
  };
  const currentAdmin = async () => {
    const u = await currentUser();
    if (u.role !== "admin") fail(401, "Not authorized");
    return u;
  };

  let p;

  // ===== Same-origin Supabase Proxy (avoids browser extension/DNS blocks & Failed to fetch) =====
  if (path.startsWith("/supabase/")) {
    const subPath = path.slice("/supabase".length);
    const allowedPrefix =
      subPath.startsWith("/auth/v1/") ||
      subPath.startsWith("/rest/v1/") ||
      subPath.startsWith("/storage/v1/") ||
      subPath.startsWith("/functions/v1/");
    if (!allowedPrefix) fail(404, "Not found");
    const targetBase = env("SUPABASE_URL").replace(/\/+$/, "");
    const pubKey = env("SUPABASE_PUBLISHABLE_KEY");
    if (!targetBase || !pubKey) fail(503, "Supabase is not configured");
    const targetUrl = `${targetBase}${subPath}${url.search}`;
    const fwdHeaders = new Headers();
    for (const hName of [
      "accept",
      "apikey",
      "authorization",
      "content-type",
      "prefer",
      "range",
      "x-client-info",
      "x-supabase-api-version",
    ]) {
      const val = request.headers.get(hName);
      if (val) fwdHeaders.set(hName, val);
    }
    if (!fwdHeaders.has("apikey")) fwdHeaders.set("apikey", pubKey);
    const reqBody = method === "GET" || method === "HEAD" ? undefined : await request.text();
    try {
      const upstream = await fetch(targetUrl, {
        method,
        headers: fwdHeaders,
        body: reqBody,
      });
      const resHeaders = new Headers();
      for (const hName of [
        "content-type",
        "x-supabase-api-version",
        "content-range",
        "sb-request-id",
      ]) {
        const val = upstream.headers.get(hName);
        if (val) resHeaders.set(hName, val);
      }
      const resBody = await upstream.arrayBuffer();
      return new Response(resBody, {
        status: upstream.status,
        headers: resHeaders,
      });
    } catch {
      return json(
        { error: "upstream_unreachable", message: "Auth service temporarily unavailable" },
        502,
      );
    }
  }

  // ===== Root =====
  if (is("GET", "/")) return json({ message: "IndiFunded API" });

  // ===== Live Indian Market Data (NSE / BSE / Yahoo proxy) =====
  if (is("GET", "/market/quotes")) {
    const { getQuotes } = await import("./market-data");
    const raw = url.searchParams.get("symbols");
    const symbols = raw
      ? raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 25)
      : undefined;
    return json(await getQuotes(symbols));
  }
  if (is("GET", "/market/candles")) {
    const { getCandles } = await import("./market-data");
    const sym = url.searchParams.get("symbol") || "NIFTY";
    const tf = url.searchParams.get("tf") || "5m";
    return json(await getCandles(sym, tf));
  }
  if (is("GET", "/market/search")) {
    const { searchSymbols } = await import("./market-data");
    const q = url.searchParams.get("q") || "";
    return json(await searchSymbols(q));
  }

  const triggerWelcomeEmailOnce = (userProfile) => {
    if (!userProfile || userProfile.role === "admin" || userProfile.welcome_sent_at) return;
    const key = String(userProfile.id || "");
    if (!key || sendingWelcomeFor.has(key)) return;
    sendingWelcomeFor.add(key);
    Promise.resolve()
      .then(async () => {
        const emailCfg = await db.get("settings", "email_config");
        if (!emailCfg || !emailCfg.smtp_user || !emailCfg.smtp_password) return;
        const { sendWelcomeEmail } = await import("./mailer");
        const res = await sendWelcomeEmail({
          to: userProfile.email,
          name: userProfile.name,
          config: emailCfg,
          origin: url.origin,
        });
        if (res?.sent) {
          const latest = (await db.get("users", key)) || userProfile;
          await db.put("users", { ...latest, welcome_sent_at: now() });
        }
      })
      .catch(() => {})
      .finally(() => {
        sendingWelcomeFor.delete(key);
      });
  };

  // ===== Auth =====
  if (is("POST", "/auth/signup")) {
    const b = await body();
    const email = str(b.email).trim().toLowerCase();
    const password = str(b.password);
    const name = str(b.name).trim();
    const phone = str(b.phone).trim();
    if (!email || !email.includes("@")) fail(400, "Valid email is required");
    if (password.length < 6) fail(400, "Password must be at least 6 characters");
    if (!name) fail(400, "Name is required");
    let userId = uuid();
    if (sb) {
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, phone },
      });
      if (error) {
        if (/already|registered|exists/i.test(error.message))
          fail(409, "An account with this email already exists");
        fail(400, error.message);
      }
      userId = data.user.id;
    } else {
      const { supabase: publicSb } = await import("@/integrations/supabase/client");
      const { data, error } = await publicSb.auth.signUp({
        email,
        password,
        options: { data: { name, phone } },
      });
      if (error) {
        if (/already|registered|exists/i.test(error.message))
          fail(409, "An account with this email already exists");
        fail(400, error.message);
      }
      if (data.user?.id) userId = data.user.id;
    }
    const first = (name.split(" ")[0] || "TRADER").toUpperCase();
    const trialStart = now();
    const doc = {
      id: userId,
      email,
      name,
      phone,
      apk_username: email,
      apk_password: `${first}@1234`,
      kyc: {},
      trial_started_at: trialStart,
      trial_expires_at: new Date(Date.parse(trialStart) + TRIAL_DURATION_MS).toISOString(),
      created_at: trialStart,
    };
    await db.put("users", doc);
    triggerWelcomeEmailOnce(doc);
    return json({ ...doc, role: "user" });
  }
  if (is("POST", "/auth/forgot-password")) {
    const b = await body();
    const email = requireEmail(b.email, "email");
    const emailCfg = await db.get("settings", "email_config");
    if (sb && emailCfg?.smtp_user && emailCfg?.smtp_password) {
      const redirectTo = str(b.redirect_to) || `${url.origin}/reset-password`;
      const { data, error } = await sb.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (!error && data?.properties?.action_link) {
        try {
          const { sendPasswordResetEmail } = await import("./mailer");
          await sendPasswordResetEmail({
            to: email,
            resetUrl: data.properties.action_link,
            config: emailCfg,
          });
          return json({ ok: true, delivered_via: "titan_smtp" });
        } catch (err) {
          console.warn("[auth/forgot-password] Titan SMTP send failed:", err?.message || err);
        }
      }
    }
    return json({ ok: false, fallback: "supabase" });
  }
  if (is("POST", "/auth/admin-login")) {
    const b = await body();
    const email = str(b.email).trim().toLowerCase();
    const password = str(b.password);
    if (email !== adminEmail()) {
      return json({ detail: "Not an admin account", code: "NOT_ADMIN" }, 404);
    }
    if (!verifyAdminPassword(password)) {
      fail(401, "Wrong email or password.");
    }
    const token = signAdminToken(email);
    return json({
      token,
      user: {
        id: "admin-indifunded",
        email,
        name: "IndiFunded Admin",
        phone: "",
        role: "admin",
      },
    });
  }
  if (is("POST", "/auth/logout")) {
    const b = await body().catch(() => ({}));
    const h = request.headers.get("authorization") || "";
    const headerToken = h.startsWith("Bearer ") ? h.slice(7) : "";
    const sbToken =
      str(b?.access_token) || (headerToken && !headerToken.startsWith("ifa.") ? headerToken : "");
    const targetBase = env("SUPABASE_URL").replace(/\/+$/, "");
    const pubKey = env("SUPABASE_PUBLISHABLE_KEY");
    if (sbToken && targetBase && pubKey) {
      try {
        await fetch(`${targetBase}/auth/v1/logout?scope=local`, {
          method: "POST",
          headers: {
            apikey: pubKey,
            Authorization: `Bearer ${sbToken}`,
            "Content-Type": "application/json;charset=UTF-8",
          },
          body: "{}",
        });
      } catch {
        // Best-effort upstream revocation; client session is already cleared.
      }
    }
    return json({ ok: true });
  }
  if (is("GET", "/auth/me")) {
    const me = await currentUser();
    triggerWelcomeEmailOnce(me);
    return json(me);
  }

  // ===== User dashboard & persistent virtual trading =====
  const myOrders = async (email) =>
    (await db.all("orders"))
      .filter((o) => str(o.customer_email).toLowerCase() === email)
      .sort(byDesc("created_at"));
  const myPayouts = async (email) =>
    (await db.all("payout_requests"))
      .filter((o) => str(o.email).toLowerCase() === email)
      .sort(byDesc("created_at"));
  const userAccountsFor = async (userId, email) => {
    const all = await db.all("trader_accounts");
    return all
      .filter(
        (a) =>
          a.user_id === userId ||
          (email && str(a.user_email).toLowerCase() === str(email).toLowerCase()),
      )
      .sort(byDesc("created_at"));
  };
  const ensureTraderAccounts = async (user) => {
    const email = str(user.email).toLowerCase();
    let accts = await userAccountsFor(user.id, email);
    const completedOrders = (await myOrders(email)).filter((o) => o.status === "completed");
    for (const o of completedOrders) {
      if (!accts.some((a) => a.order_id === o.id)) {
        const cap = int(o.plan_account_size) || 100000;
        const created = {
          id: `acct-${o.id}`,
          order_id: o.id,
          account_number: `IF-CH-${String(o.id).slice(0, 6).toUpperCase()}`,
          user_id: user.id,
          user_email: email,
          plan_name: o.plan_name || "Standard",
          account_type: "Challenge",
          starting_capital: cap,
          balance: cap,
          available_margin: cap,
          used_margin: 0,
          realized_pnl: 0,
          profit_split: 70,
          max_loss_limit: 20,
          trades_per_day: 5,
          status: "Active",
          note: "Challenge purchase",
          created_at: o.created_at || now(),
          updated_at: now(),
        };
        await db.put("trader_accounts", created);
        accts = [created, ...accts];
      }
    }
    if (!accts.length) {
      const startAt = user.trial_started_at || now();
      const startMs = Date.parse(startAt) || Date.now();
      const expiresAt =
        user.trial_expires_at || new Date(startMs + TRIAL_DURATION_MS).toISOString();
      const starter = {
        id: `acct-wallet-${user.id.slice(0, 8)}`,
        account_number: `IF-EXP-${user.id.slice(0, 4).toUpperCase()}`,
        user_id: user.id,
        user_email: email,
        plan_name: "Platform Explorer (5-Min Trial)",
        account_type: "Trial Explorer",
        is_trial: true,
        trial_started_at: startAt,
        trial_expires_at: expiresAt,
        trial_locked: Date.now() >= Date.parse(expiresAt),
        starting_capital: TRIAL_CAPITAL_INR,
        balance: TRIAL_CAPITAL_INR,
        available_margin: TRIAL_CAPITAL_INR,
        used_margin: 0,
        realized_pnl: 0,
        profit_split: 70,
        max_loss_limit: 20,
        trades_per_day: 25,
        status: Date.now() >= Date.parse(expiresAt) ? "Trial Expired" : "Active",
        note: "₹1,00,000 5-minute Platform Explorer trial account",
        created_at: startAt,
        updated_at: now(),
      };
      await db.put("trader_accounts", starter);
      accts = [starter];
    }
    const syncAccts = [];
    for (const acct of accts) {
      if (isTrialAccountRecord(acct)) {
        const status = computeAccountTrialStatus(acct, accts);
        const nextStatus = status.isLocked ? "Trial Expired" : acct.status;
        if (
          acct.is_trial !== true ||
          acct.trial_started_at !== status.startedAt ||
          acct.trial_expires_at !== status.expiresAt ||
          acct.trial_locked !== status.isLocked ||
          acct.status !== nextStatus
        ) {
          const synced = {
            ...acct,
            is_trial: true,
            account_type: acct.account_type || "Trial Explorer",
            trial_started_at: status.startedAt,
            trial_expires_at: status.expiresAt,
            trial_locked: status.isLocked,
            status: nextStatus,
            updated_at: now(),
          };
          await db.put("trader_accounts", synced);
          syncAccts.push(synced);
          continue;
        }
      }
      syncAccts.push(acct);
    }
    return syncAccts;
  };

  if (is("GET", "/me/dashboard")) {
    const user = await currentUser();
    const email = user.email.toLowerCase();
    const orders = await myOrders(email);
    const payouts = await myPayouts(email);
    const traderAccounts = await ensureTraderAccounts(user);
    const transactions = (await db.all("fund_transactions"))
      .filter((t) => t.user_id === user.id || str(t.user_email).toLowerCase() === email)
      .sort(byDesc("created_at"));
    const activeAccounts = traderAccounts.filter((a) => ["Active", "Funded"].includes(a.status));
    const capital = traderAccounts.reduce((s, a) => s + num(a.balance), 0);
    const netPnl = traderAccounts.reduce((s, a) => s + num(a.realized_pnl), 0);
    const paid = payouts.filter((x) => x.status === "paid");
    return json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name || "",
        phone: user.phone || "",
        created_at: user.created_at || "",
      },
      simulated_capital: capital,
      funded_accounts_active: activeAccounts.length,
      funded_accounts_total:
        traderAccounts.length + orders.filter((o) => o.status !== "completed").length,
      net_pnl: +netPnl.toFixed(2),
      total_paid_out: paid.reduce((s, x) => s + num(x.amount), 0),
      payouts_count: paid.length,
      accounts: traderAccounts.slice(0, 6),
      recent_transactions: transactions.slice(0, 5),
    });
  }
  if (is("GET", "/me/accounts")) {
    const user = await currentUser();
    const orders = await myOrders(user.email.toLowerCase());
    const traderAccounts = await ensureTraderAccounts(user);
    return json({ accounts: traderAccounts, orders });
  }
  if (is("GET", "/me/trading-state")) {
    const user = await currentUser();
    const accounts = await ensureTraderAccounts(user);
    const requestedAcctId = url.searchParams.get("account_id");
    const activeAccount = accounts.find((a) => a.id === requestedAcctId) || accounts[0];
    const allOrders = (await db.all("virtual_orders"))
      .filter((o) => o.user_id === user.id && o.account_id === activeAccount.id)
      .sort(byDesc("created_at"));
    const allPositions = (await db.all("virtual_positions")).filter(
      (p) => p.user_id === user.id && p.account_id === activeAccount.id && p.qty !== 0,
    );
    const allTrades = (await db.all("virtual_trades"))
      .filter((t) => t.user_id === user.id && t.account_id === activeAccount.id)
      .sort(byDesc("created_at"));
    const transactions = (await db.all("fund_transactions"))
      .filter((t) => t.user_id === user.id)
      .sort(byDesc("created_at"));
    const trialInfo = computeAccountTrialStatus(activeAccount, accounts);
    return json({
      accounts,
      activeAccount,
      trial: trialInfo,
      server_now: now(),
      orders: allOrders,
      positions: allPositions,
      trades: allTrades,
      transactions,
    });
  }
  if (is("POST", "/me/orders")) {
    const user = await currentUser();
    const b = await body();
    const accounts = await ensureTraderAccounts(user);
    const account = accounts.find((a) => a.id === str(b.account_id)) || accounts[0];
    if (!account) fail(404, "Trading account not found");
    if (isTrialAccountRecord(account)) {
      const trialInfo = computeAccountTrialStatus(account, accounts);
      if (trialInfo.isLocked) {
        fail(
          403,
          "5-minute ₹1,00,000 Platform Explorer trial expired. Purchase a challenge account to continue trading.",
          { code: "TRIAL_EXPIRED" },
        );
      }
    }
    const symbol = str(b.symbol).trim().toUpperCase();
    const side = str(b.side).toUpperCase() === "SELL" ? "SELL" : "BUY";
    const type = ["MARKET", "LIMIT", "SL"].includes(str(b.type).toUpperCase())
      ? str(b.type).toUpperCase()
      : "MARKET";
    const qty = Math.max(1, int(b.qty));
    if (!symbol) fail(400, "Instrument symbol is required");
    const { getQuotes, resolveInstrument } = await import("./market-data");
    const inst = resolveInstrument(symbol);
    const qRes = await getQuotes([inst.symbol]);
    const liveQuote = qRes.quotes[0];
    if (!liveQuote || !liveQuote.ltp) fail(502, "Unable to fetch live market price for execution");
    const execPrice =
      type === "MARKET" ? liveQuote.ltp : Math.max(0.05, num(b.limit_price) || liveQuote.ltp);
    const marginRequired = +(execPrice * qty * 0.2).toFixed(2);
    if (type === "MARKET" && marginRequired > num(account.available_margin)) {
      fail(
        400,
        `Insufficient margin. Required ₹${Math.round(marginRequired).toLocaleString("en-IN")}, available ₹${Math.round(num(account.available_margin)).toLocaleString("en-IN")}.`,
      );
    }
    const orderStatus = type === "MARKET" ? "Executed" : "Pending";
    const orderDoc = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      user_id: user.id,
      account_id: account.id,
      symbol: inst.symbol,
      exchange: inst.exchange,
      side,
      qty,
      type,
      price: +execPrice.toFixed(2),
      date: now(),
      status: orderStatus,
      created_at: now(),
    };
    await db.put("virtual_orders", orderDoc);

    let updatedAccount = { ...account };
    if (orderStatus === "Executed") {
      const signedQty = side === "BUY" ? qty : -qty;
      const existing = (await db.all("virtual_positions")).find(
        (pos) =>
          pos.user_id === user.id &&
          pos.account_id === account.id &&
          pos.symbol === inst.symbol &&
          pos.qty !== 0,
      );
      if (!existing) {
        await db.put("virtual_positions", {
          id: uuid(),
          user_id: user.id,
          account_id: account.id,
          symbol: inst.symbol,
          exchange: inst.exchange,
          qty: signedQty,
          avg: +execPrice.toFixed(2),
          margin_used: marginRequired,
          status: "Open",
          created_at: now(),
          updated_at: now(),
        });
        updatedAccount.used_margin = +(num(updatedAccount.used_margin) + marginRequired).toFixed(2);
        updatedAccount.available_margin = Math.max(
          0,
          +(num(updatedAccount.balance) - num(updatedAccount.used_margin)).toFixed(2),
        );
      } else if (Math.sign(existing.qty) === Math.sign(signedQty)) {
        const totalQty = existing.qty + signedQty;
        const absOld = Math.abs(existing.qty);
        const absAdd = Math.abs(signedQty);
        const newAvg = (existing.avg * absOld + execPrice * absAdd) / (absOld + absAdd);
        const addedMargin = +(execPrice * absAdd * 0.2).toFixed(2);
        await db.put("virtual_positions", {
          ...existing,
          qty: totalQty,
          avg: +newAvg.toFixed(2),
          margin_used: +(num(existing.margin_used) + addedMargin).toFixed(2),
          updated_at: now(),
        });
        updatedAccount.used_margin = +(num(updatedAccount.used_margin) + addedMargin).toFixed(2);
        updatedAccount.available_margin = Math.max(
          0,
          +(num(updatedAccount.balance) - num(updatedAccount.used_margin)).toFixed(2),
        );
      } else {
        const closeQty = Math.min(Math.abs(existing.qty), Math.abs(signedQty));
        const isLong = existing.qty > 0;
        const pnl = +(
          (isLong ? execPrice - existing.avg : existing.avg - execPrice) * closeQty
        ).toFixed(2);
        const tradeDoc = {
          id: `TRD-${Date.now().toString().slice(-6)}`,
          user_id: user.id,
          account_id: account.id,
          symbol: inst.symbol,
          exchange: inst.exchange,
          side: isLong ? "BUY" : "SELL",
          entry: existing.avg,
          exit: +execPrice.toFixed(2),
          qty: closeQty,
          pnl,
          in: existing.created_at,
          out: now(),
          created_at: now(),
        };
        await db.put("virtual_trades", tradeDoc);
        const remainQty = existing.qty + signedQty;
        const releasedMargin =
          (num(existing.margin_used) * closeQty) / Math.max(1, Math.abs(existing.qty));
        if (remainQty === 0) {
          await db.del("virtual_positions", existing.id);
        } else {
          await db.put("virtual_positions", {
            ...existing,
            qty: remainQty,
            avg:
              Math.sign(remainQty) === Math.sign(existing.qty)
                ? existing.avg
                : +execPrice.toFixed(2),
            margin_used: Math.max(0, +(num(existing.margin_used) - releasedMargin).toFixed(2)),
            updated_at: now(),
          });
        }
        updatedAccount.balance = +(num(updatedAccount.balance) + pnl).toFixed(2);
        updatedAccount.realized_pnl = +(num(updatedAccount.realized_pnl) + pnl).toFixed(2);
        updatedAccount.used_margin = Math.max(
          0,
          +(num(updatedAccount.used_margin) - releasedMargin).toFixed(2),
        );
        updatedAccount.available_margin = Math.max(
          0,
          +(updatedAccount.balance - updatedAccount.used_margin).toFixed(2),
        );
      }
      updatedAccount.updated_at = now();
      await db.put("trader_accounts", updatedAccount);
    }
    return json({ order: orderDoc, account: updatedAccount });
  }
  if ((p = is("POST", "/me/positions/:id/close"))) {
    const user = await currentUser();
    const pos = await db.get("virtual_positions", p.id);
    if (!pos || pos.user_id !== user.id || pos.qty === 0) fail(404, "Open position not found");
    const accounts = await ensureTraderAccounts(user);
    const account =
      accounts.find((a) => a.id === pos.account_id) || (await db.get("trader_accounts", pos.account_id));
    if (!account) fail(404, "Trading account not found");
    if (isTrialAccountRecord(account)) {
      const trialInfo = computeAccountTrialStatus(account, accounts);
      if (trialInfo.isLocked) {
        fail(
          403,
          "5-minute ₹1,00,000 Platform Explorer trial expired. Purchase a challenge account to unlock your terminal.",
          { code: "TRIAL_EXPIRED" },
        );
      }
    }
    const { getQuotes } = await import("./market-data");
    const qRes = await getQuotes([pos.symbol]);
    const ltp = qRes.quotes[0]?.ltp || pos.avg;
    const isLong = pos.qty > 0;
    const closeQty = Math.abs(pos.qty);
    const pnl = +((isLong ? ltp - pos.avg : pos.avg - ltp) * closeQty).toFixed(2);
    const orderDoc = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      user_id: user.id,
      account_id: account.id,
      symbol: pos.symbol,
      exchange: pos.exchange || "NSE",
      side: isLong ? "SELL" : "BUY",
      qty: closeQty,
      type: "MARKET",
      price: +ltp.toFixed(2),
      date: now(),
      status: "Executed",
      created_at: now(),
    };
    const tradeDoc = {
      id: `TRD-${Date.now().toString().slice(-6)}`,
      user_id: user.id,
      account_id: account.id,
      symbol: pos.symbol,
      exchange: pos.exchange || "NSE",
      side: isLong ? "BUY" : "SELL",
      entry: pos.avg,
      exit: +ltp.toFixed(2),
      qty: closeQty,
      pnl,
      in: pos.created_at,
      out: now(),
      created_at: now(),
    };
    await db.put("virtual_orders", orderDoc);
    await db.put("virtual_trades", tradeDoc);
    await db.del("virtual_positions", pos.id);
    const nextBalance = +(num(account.balance) + pnl).toFixed(2);
    const nextUsed = Math.max(0, +(num(account.used_margin) - num(pos.margin_used)).toFixed(2));
    const updatedAccount = {
      ...account,
      balance: nextBalance,
      realized_pnl: +(num(account.realized_pnl) + pnl).toFixed(2),
      used_margin: nextUsed,
      available_margin: Math.max(0, +(nextBalance - nextUsed).toFixed(2)),
      updated_at: now(),
    };
    await db.put("trader_accounts", updatedAccount);
    return json({ trade: tradeDoc, account: updatedAccount });
  }
  if (is("GET", "/me/payouts")) {
    const user = await currentUser();
    const payouts = await myPayouts(user.email.toLowerCase());
    return json({
      eligible: 0,
      pending_amount: payouts
        .filter((x) => ["pending", "approved"].includes(x.status))
        .reduce((s, x) => s + num(x.amount), 0),
      total_paid: payouts.filter((x) => x.status === "paid").reduce((s, x) => s + num(x.amount), 0),
      history: payouts,
    });
  }
  // ----- AI performance insights from the trader's own history -----
  if (is("GET", "/me/insights")) {
    const user = await currentUser();
    return json(
      (await db.all("insights"))
        .filter((x) => x.user_id === user.id)
        .sort(byDesc("created_at"))
        .slice(0, 20),
    );
  }
  if (is("POST", "/me/insights")) {
    const user = await currentUser();
    const b = await body();
    const { generateTradeInsights, InsightsError, MAX_HISTORY_CHARS } = await import("./insights");
    const history = str(b.history).trim();
    const notes = str(b.notes).slice(0, 1000);
    if (history.length < 20) fail(400, "Please paste or upload your trading history first.");
    if (history.length > MAX_HISTORY_CHARS)
      fail(
        400,
        `Trading history is too long. Keep it under ${MAX_HISTORY_CHARS.toLocaleString("en-IN")} characters.`,
      );
    const recent = await myOrders(user.email.toLowerCase());
    const plan = recent[0]?.plan_id ? await db.get("plans", str(recent[0].plan_id)) : null;
    let result;
    try {
      result = await generateTradeInsights({ history, notes, rules: plan });
    } catch (e) {
      if (e instanceof InsightsError) fail(e.status, e.message);
      throw e;
    }
    const doc = {
      id: uuid(),
      user_id: user.id,
      plan_name: plan?.name || null,
      history_chars: history.length,
      notes,
      ...result,
      created_at: now(),
    };
    await db.put("insights", doc);
    return json(doc);
  }
  if ((p = is("DELETE", "/me/insights/:id"))) {
    const user = await currentUser();
    const doc = await db.get("insights", p.id);
    if (!doc || doc.user_id !== user.id) fail(404, "Not found");
    await db.del("insights", p.id);
    return json({ ok: true });
  }
  if (is("GET", "/me/certificates")) {
    const user = await currentUser();
    const email = user.email.toLowerCase();
    return json(
      (await db.all("certificates")).filter(
        (c) => str(c.trader_email).toLowerCase() === email && c.visible,
      ),
    );
  }
  if (is("GET", "/me/billing")) {
    const user = await currentUser();
    const email = user.email.toLowerCase();
    const orders = await myOrders(email);
    const league = (await db.all("league_registrations")).filter(
      (r) => str(r.email).toLowerCase() === email,
    );
    const items = [
      ...orders.map((o) => ({
        id: o.id,
        kind: "challenge",
        product: o.plan_name || "Challenge",
        amount: o.amount || 0,
        status: o.status || "pending_payment",
        created_at: o.created_at || "",
      })),
      ...league.map((r) => ({
        id: r.id,
        kind: "league",
        product: "Trader League" + (r.is_existing_trader ? " (existing)" : " (new)"),
        amount: r.amount || 0,
        status: r.status || "pending_payment",
        created_at: r.created_at || "",
      })),
    ].sort(byDesc("created_at"));
    return json(items);
  }
  if (is("PUT", "/me/profile")) {
    const user = await currentUser();
    const b = await body();
    const updates = {};
    if (typeof b.name === "string" && b.name.trim()) updates.name = b.name.trim();
    if (typeof b.phone === "string") updates.phone = b.phone.trim();
    if (!Object.keys(updates).length) fail(400, "Nothing to update");
    const { role, ...profile } = user;
    const next = { ...profile, ...updates };
    await db.put("users", next);
    return json({ ...next, role });
  }
  if (is("PUT", "/me/kyc")) {
    const user = await currentUser();
    const b = await body();
    const kyc = {
      full_name: str(b.full_name).trim(),
      pan: str(b.pan).trim().toUpperCase(),
      upi_id: str(b.upi_id).trim(),
      bank_account_number: str(b.bank_account_number).trim(),
      ifsc: str(b.ifsc).trim().toUpperCase(),
      submitted_at: now(),
      status: "submitted",
    };
    if (!kyc.full_name || !kyc.pan) fail(400, "Full name and PAN are required");
    const { role, ...profile } = user;
    await db.put("users", { ...profile, kyc });
    return json(kyc);
  }

  // ===== Admin users & fund management =====
  if (is("GET", "/admin/users")) {
    await currentAdmin();
    let adminIds = new Set();
    if (sb) {
      const { data: admins } = await sb.from("user_roles").select("user_id").eq("role", "admin");
      adminIds = new Set((admins || []).map((a) => a.user_id));
    }
    const [users, allAccounts, allTx] = await Promise.all([
      db.all("users"),
      db.all("trader_accounts"),
      db.all("fund_transactions"),
    ]);
    const enriched = users
      .filter((u) => !adminIds.has(u.id))
      .sort(byDesc("created_at"))
      .map((u) => {
        const email = str(u.email).toLowerCase();
        const accts = allAccounts.filter(
          (a) => a.user_id === u.id || str(a.user_email).toLowerCase() === email,
        );
        const tx = allTx.filter(
          (t) => t.user_id === u.id || str(t.user_email).toLowerCase() === email,
        );
        return {
          ...u,
          accounts: accts,
          total_balance: accts.reduce((s, a) => s + num(a.balance), 0),
          total_capital: accts.reduce((s, a) => s + num(a.starting_capital), 0),
          funded_accounts_count: accts.filter((a) => a.status === "Funded").length,
          transactions_count: tx.length,
        };
      });
    return json(enriched);
  }
  if ((p = is("GET", "/admin/users/:id/ledger"))) {
    await currentAdmin();
    const trader = await db.get("users", p.id);
    if (!trader) fail(404, "Trader not found");
    const email = str(trader.email).toLowerCase();
    const accounts = (await db.all("trader_accounts"))
      .filter((a) => a.user_id === trader.id || str(a.user_email).toLowerCase() === email)
      .sort(byDesc("created_at"));
    const transactions = (await db.all("fund_transactions"))
      .filter((t) => t.user_id === trader.id || str(t.user_email).toLowerCase() === email)
      .sort(byDesc("created_at"));
    return json({ user: trader, accounts, transactions });
  }
  if ((p = is("POST", "/admin/users/:id/funds"))) {
    const admin = await currentAdmin();
    const trader = await db.get("users", p.id);
    if (!trader) fail(404, "Trader not found");
    const b = await body();
    const amount = num(b.amount);
    const kind = str(b.type).toLowerCase() === "debit" ? "debit" : "credit";
    const note =
      str(b.note).trim() || (kind === "credit" ? "Admin fund credit" : "Admin balance adjustment");
    if (!amount || amount <= 0) fail(400, "Amount must be greater than 0");
    const email = str(trader.email).toLowerCase();
    const userAccts = (await db.all("trader_accounts"))
      .filter((a) => a.user_id === trader.id || str(a.user_email).toLowerCase() === email)
      .sort(byDesc("created_at"));
    let target = b.account_id ? userAccts.find((a) => a.id === str(b.account_id)) : userAccts[0];
    if (!target) {
      target = {
        id: `acct-${uuid().slice(0, 8)}`,
        account_number: `IF-WL-${trader.id.slice(0, 4).toUpperCase()}`,
        user_id: trader.id,
        user_email: email,
        plan_name: "Funded Wallet",
        account_type: "Funded",
        starting_capital: 0,
        balance: 0,
        available_margin: 0,
        used_margin: 0,
        realized_pnl: 0,
        profit_split: 70,
        max_loss_limit: 20,
        trades_per_day: 10,
        status: "Funded",
        note: "Created via admin fund credit",
        created_at: now(),
        updated_at: now(),
      };
    }
    const delta = kind === "credit" ? amount : -amount;
    const nextBalance = Math.max(0, +(num(target.balance) + delta).toFixed(2));
    const nextAvail = Math.max(0, +(nextBalance - num(target.used_margin)).toFixed(2));
    const nextCap =
      kind === "credit"
        ? +(num(target.starting_capital) + amount).toFixed(2)
        : Math.max(0, +(num(target.starting_capital) - amount).toFixed(2));
    const updated = {
      ...target,
      starting_capital: nextCap,
      balance: nextBalance,
      available_margin: nextAvail,
      updated_at: now(),
    };
    await db.put("trader_accounts", updated);
    const tx = {
      id: uuid(),
      user_id: trader.id,
      user_email: email,
      account_id: updated.id,
      account_number: updated.account_number,
      kind,
      amount,
      balance_after: nextBalance,
      note,
      admin_email: admin.email,
      created_at: now(),
    };
    await db.put("fund_transactions", tx);
    return json({ account: updated, transaction: tx });
  }
  if ((p = is("POST", "/admin/users/:id/accounts"))) {
    const admin = await currentAdmin();
    const trader = await db.get("users", p.id);
    if (!trader) fail(404, "Trader not found");
    const b = await body();
    const capital = num(b.starting_capital);
    if (!capital || capital <= 0) fail(400, "Account capital must be greater than 0");
    const accountType = str(b.account_type) === "Challenge" ? "Challenge" : "Funded";
    const planName =
      str(b.plan_name).trim() || (accountType === "Funded" ? "Funded Pro" : "Standard");
    const profitSplit = Math.min(95, Math.max(50, int(b.profit_split, 70)));
    const maxLoss = Math.min(50, Math.max(5, int(b.max_loss_limit, 20)));
    const note = str(b.note).trim() || `Provisioned by ${admin.email}`;
    const email = str(trader.email).toLowerCase();
    const prefix = accountType === "Funded" ? "IF-FD" : "IF-CH";
    const account = {
      id: `acct-${uuid().slice(0, 8)}`,
      account_number: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
      user_id: trader.id,
      user_email: email,
      plan_name: planName,
      account_type: accountType,
      starting_capital: capital,
      balance: capital,
      available_margin: capital,
      used_margin: 0,
      realized_pnl: 0,
      profit_split: profitSplit,
      max_loss_limit: maxLoss,
      trades_per_day: int(b.trades_per_day, 5) || 5,
      status: accountType === "Funded" ? "Funded" : "Active",
      note,
      created_at: now(),
      updated_at: now(),
    };
    await db.put("trader_accounts", account);
    const tx = {
      id: uuid(),
      user_id: trader.id,
      user_email: email,
      account_id: account.id,
      account_number: account.account_number,
      kind: "funded_allocation",
      amount: capital,
      balance_after: capital,
      note: `${planName} (${accountType}) — ${note}`,
      admin_email: admin.email,
      created_at: now(),
    };
    await db.put("fund_transactions", tx);
    return json({ account, transaction: tx });
  }
  if ((p = is("DELETE", "/admin/users/:id"))) {
    await currentAdmin();
    if (sb) {
      const { data: isAdm } = await sb
        .from("user_roles")
        .select("id")
        .eq("user_id", p.id)
        .eq("role", "admin");
      if (!isAdm || !isAdm.length) {
        await sb.auth.admin.deleteUser(p.id).catch(() => null);
        await db.del("users", p.id);
      }
    } else {
      await db.del("users", p.id);
    }
    return json({ ok: true });
  }

  // ===== Generic admin CRUD collections =====
  // Plans
  if (is("GET", "/plans")) return json((await db.all("plans")).sort(byNum("order")));
  if ((p = is("GET", "/plans/:id"))) {
    const pl = await db.get("plans", p.id);
    if (!pl) fail(404, "Plan not found");
    return json(pl);
  }
  if (is("POST", "/plans")) {
    await currentAdmin();
    return json(
      await db.put("plans", { id: uuid(), ...planFields(await body()), created_at: now() }),
    );
  }
  if ((p = is("PUT", "/plans/:id"))) {
    await currentAdmin();
    const old = await db.get("plans", p.id);
    if (!old) fail(404, "Plan not found");
    return json(await db.put("plans", { ...old, ...planFields(await body()) }));
  }
  if ((p = is("DELETE", "/plans/:id"))) {
    await currentAdmin();
    await db.del("plans", p.id);
    return json({ ok: true });
  }

  // Blogs
  if (is("GET", "/blogs"))
    return json((await db.all("blogs")).filter((b) => b.published).sort(byDesc("created_at")));
  if (is("GET", "/blogs/all")) {
    await currentAdmin();
    return json((await db.all("blogs")).sort(byDesc("created_at")));
  }
  if ((p = is("GET", "/blogs/:slug"))) {
    const b = await db.findOne("blogs", (x) => x.slug === p.slug);
    if (!b) fail(404, "Blog not found");
    return json(b);
  }
  if (is("POST", "/blogs")) {
    await currentAdmin();
    const f = blogFields(await body());
    if (await db.findOne("blogs", (x) => x.slug === f.slug)) fail(400, "Slug already exists");
    return json(await db.put("blogs", { id: uuid(), ...f, created_at: now() }));
  }
  if ((p = is("PUT", "/blogs/:id"))) {
    await currentAdmin();
    const old = await db.get("blogs", p.id);
    if (!old) fail(404, "Blog not found");
    return json(await db.put("blogs", { ...old, ...blogFields(await body()) }));
  }
  if ((p = is("DELETE", "/blogs/:id"))) {
    await currentAdmin();
    await db.del("blogs", p.id);
    return json({ ok: true });
  }

  // Leads
  if (is("POST", "/leads")) {
    const b = await body();
    if (!str(b.first_name)) fail(422, "first_name is required");
    const lead = {
      id: uuid(),
      first_name: str(b.first_name).slice(0, 200),
      last_name: str(b.last_name).slice(0, 200),
      email: requireEmail(b.email),
      phone: str(b.phone).slice(0, 50),
      city: str(b.city).slice(0, 200),
      challenge_type: str(b.challenge_type).slice(0, 200),
      platform: str(b.platform).slice(0, 200),
      message: str(b.message).slice(0, 5000),
      created_at: now(),
    };
    return json(await db.put("leads", lead));
  }
  if (is("GET", "/leads")) {
    await currentAdmin();
    return json((await db.all("leads")).sort(byDesc("created_at")));
  }
  if ((p = is("DELETE", "/leads/:id"))) {
    await currentAdmin();
    await db.del("leads", p.id);
    return json({ ok: true });
  }

  // Trader stories: signed-in traders submit, admin approves, public sees approved only
  if (is("GET", "/stories")) {
    const all = (await db.all("stories"))
      .filter((s) => s.status === "approved")
      .sort(byDesc("created_at"));
    return json(all.map(({ email, ...rest }) => rest));
  }
  if (is("POST", "/stories")) {
    const user = await currentUser();
    const b = await body();
    const story = str(b.story).trim().slice(0, 2000);
    if (story.length < 20) fail(422, "Story must be at least 20 characters");
    const rating = Math.min(5, Math.max(1, int(b.rating) || 5));
    return json(
      await db.put("stories", {
        id: uuid(),
        name: str(b.name || user.name).slice(0, 80),
        city: str(b.city).slice(0, 60),
        title: str(b.title).slice(0, 120),
        story,
        rating,
        video_url: str(b.video_url).slice(0, 300),
        payout_amount: num(b.payout_amount),
        email: user.email,
        status: "pending",
        created_at: now(),
      }),
    );
  }
  if (is("GET", "/admin/stories")) {
    await currentAdmin();
    return json((await db.all("stories")).sort(byDesc("created_at")));
  }
  if ((p = is("PUT", "/admin/stories/:id"))) {
    await currentAdmin();
    const old = await db.get("stories", p.id);
    if (!old) fail(404, "Not found");
    const st = str((await body()).status);
    if (!["approved", "rejected", "pending"].includes(st)) fail(422, "Invalid status");
    return json(await db.put("stories", { ...old, status: st }));
  }
  if ((p = is("DELETE", "/admin/stories/:id"))) {
    await currentAdmin();
    await db.del("stories", p.id);
    return json({ ok: true });
  }

  // Public trust stats + payout verification (no private fields returned)
  if (is("GET", "/public/stats")) {
    const [users, certs, payouts] = await Promise.all([
      db.all("users"),
      db.all("certificates"),
      db.all("payout_requests"),
    ]);
    return json({
      traders: users.length,
      certificates: certs.filter((c) => c.visible).length,
      payouts:
        payouts.filter((x) =>
          ["paid", "approved", "completed"].includes(str(x.status).toLowerCase()),
        ).length + certs.filter((c) => c.visible).length,
    });
  }
  if (is("GET", "/public/verify-payout")) {
    const q = str(url.searchParams.get("q")).trim().toLowerCase().slice(0, 100);
    if (q.length < 3) fail(404, "Not found");
    const hits = (await db.all("certificates")).filter(
      (c) =>
        c.visible &&
        (str(c.id).toLowerCase() === q || str(c.trader_name).toLowerCase().includes(q)),
    );
    if (!hits.length) fail(404, "Not found");
    return json(
      hits.slice(0, 20).map((c) => ({
        id: c.id,
        trader_name: c.trader_name,
        amount: c.amount,
        date: c.payout_date,
      })),
    );
  }

  // Certificates
  if (is("GET", "/certificates"))
    return json((await db.all("certificates")).filter((c) => c.visible).sort(byNum("order")));
  if (is("GET", "/certificates/all")) {
    await currentAdmin();
    return json((await db.all("certificates")).sort(byNum("order")));
  }
  if (is("POST", "/certificates")) {
    await currentAdmin();
    return json(
      await db.put("certificates", { id: uuid(), ...certFields(await body()), created_at: now() }),
    );
  }
  if ((p = is("PUT", "/certificates/:id"))) {
    await currentAdmin();
    const old = await db.get("certificates", p.id);
    if (!old) fail(404, "Certificate not found");
    return json(await db.put("certificates", { ...old, ...certFields(await body()) }));
  }
  if ((p = is("DELETE", "/certificates/:id"))) {
    await currentAdmin();
    await db.del("certificates", p.id);
    return json({ ok: true });
  }

  // Payout requests
  if (is("POST", "/payout-requests")) {
    const b = await body();
    const amount = num(b.amount);
    const methodName = str(b.method) || "upi";
    if (!str(b.full_name) || !str(b.phone)) fail(422, "Name and phone are required");
    if (amount <= 0) fail(400, "Amount must be greater than 0");
    if (!["upi", "bank"].includes(methodName)) fail(400, "Invalid payout method");
    if (methodName === "upi" && !str(b.upi_id).trim())
      fail(400, "UPI ID is required for UPI payouts");
    if (methodName === "bank" && !(str(b.account_number).trim() && str(b.ifsc).trim()))
      fail(400, "Bank account number and IFSC are required for bank payouts");
    const req = {
      id: uuid(),
      full_name: str(b.full_name),
      email: requireEmail(b.email),
      phone: str(b.phone),
      account_id: str(b.account_id),
      plan: str(b.plan),
      amount,
      method: methodName,
      upi_id: str(b.upi_id),
      bank_name: str(b.bank_name),
      account_number: str(b.account_number),
      ifsc: str(b.ifsc),
      account_holder: str(b.account_holder),
      notes: str(b.notes),
      status: "pending",
      admin_note: "",
      created_at: now(),
    };
    return json(await db.put("payout_requests", req));
  }
  if (is("GET", "/payout-requests")) {
    await currentAdmin();
    return json((await db.all("payout_requests")).sort(byDesc("created_at")));
  }
  if ((p = is("PATCH", "/payout-requests/:id"))) {
    await currentAdmin();
    const b = await body();
    const old = await db.get("payout_requests", p.id);
    if (!old) fail(404, "Payout request not found");
    const upd = {};
    if (b.status != null) {
      if (!["pending", "approved", "paid", "rejected"].includes(b.status))
        fail(400, "Invalid status");
      upd.status = b.status;
    }
    if (b.admin_note != null) upd.admin_note = str(b.admin_note);
    return json(await db.put("payout_requests", { ...old, ...upd }));
  }
  if ((p = is("DELETE", "/payout-requests/:id"))) {
    await currentAdmin();
    await db.del("payout_requests", p.id);
    return json({ ok: true });
  }

  // Uploads & Media Streaming
  if (is("POST", "/uploads/image")) {
    await currentAdmin();
    const b = await body();
    const d = str(b.data_url);
    if (!d.startsWith("data:image/")) fail(400, "Not a valid image data URL");
    if (d.length > 8 * 1024 * 1024) fail(413, "Image too large (max ~6MB)");
    return json({ url: d });
  }
  if (is("POST", "/admin/media")) {
    await currentAdmin();
    const b = await body();
    const dataUrl = str(b.data_url);
    const m = dataUrl.match(/^data:(video\/(?:mp4|webm|quicktime)|image\/(?:jpeg|png|webp));base64,(.+)$/i);
    if (!m) fail(400, "Unsupported media format. Upload MP4, WebM, or MOV short videos.");
    const contentType = m[1].toLowerCase();
    const base64Data = m[2];
    if (base64Data.length > 26 * 1024 * 1024) {
      fail(413, "Video file is too large. Keep short videos under 18 MB.");
    }
    const extMap = {
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const ext = extMap[contentType] || "mp4";
    const id = `vid_${uuid().replace(/-/g, "").slice(0, 14)}`;
    const asset = {
      id,
      ext,
      filename: str(b.filename).slice(0, 120) || `${id}.${ext}`,
      content_type: contentType,
      data_base64: base64Data,
      size: Math.floor((base64Data.length * 3) / 4),
      created_at: now(),
    };
    await db.put("media_assets", asset);
    return json({
      id,
      url: `/api/media/${id}.${ext}`,
      content_type: contentType,
      size: asset.size,
    });
  }
  if ((p = is("GET", "/media/:filename"))) {
    const assetId = str(p.filename).replace(/\.(?:mp4|webm|mov|jpg|jpeg|png|webp)$/i, "");
    const asset = await db.get("media_assets", assetId);
    if (!asset || !asset.data_base64) fail(404, "Media not found");
    const buf = Buffer.from(asset.data_base64, "base64");
    const total = buf.length;
    const range = request.headers.get("range");
    const mime = asset.content_type || "video/mp4";
    if (range) {
      const m = range.match(/bytes=(\d+)-(\d*)/);
      if (m) {
        const start = Math.min(total - 1, Number(m[1]) || 0);
        const end = m[2] ? Math.min(total - 1, Number(m[2])) : total - 1;
        const chunk = buf.subarray(start, end + 1);
        return new Response(chunk, {
          status: 206,
          headers: {
            "content-type": mime,
            "content-range": `bytes ${start}-${end}/${total}`,
            "accept-ranges": "bytes",
            "content-length": String(chunk.length),
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      }
    }
    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": mime,
        "accept-ranges": "bytes",
        "content-length": String(total),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Admin Business Email (Titan SMTP)
  if (is("GET", "/admin/email")) {
    await currentAdmin();
    const { sanitizeEmailConfigForAdmin } = await import("./mailer");
    const stored = await db.get("settings", "email_config");
    return json(sanitizeEmailConfigForAdmin(stored));
  }
  if (is("PUT", "/admin/email")) {
    await currentAdmin();
    const b = await body();
    const { DEFAULT_EMAIL_CONFIG, sanitizeEmailConfigForAdmin } = await import("./mailer");
    const old = (await db.get("settings", "email_config")) || {};
    const port = int(b.smtp_port, 465) || 465;
    const next = {
      ...DEFAULT_EMAIL_CONFIG,
      ...old,
      id: "email_config",
      provider: "titan",
      smtp_host: str(b.smtp_host).trim() || "smtp.titan.email",
      smtp_port: port,
      smtp_secure: b.smtp_secure !== undefined ? Boolean(b.smtp_secure) : port === 465,
      smtp_user: str(b.smtp_user).trim(),
      smtp_password:
        str(b.smtp_password) !== ""
          ? str(b.smtp_password)
          : b.clear_password
            ? ""
            : str(old.smtp_password),
      from_name: str(b.from_name).trim() || "IndiFunded",
      from_email: str(b.from_email).trim() || str(b.smtp_user).trim(),
      reply_to: str(b.reply_to).trim() || str(b.from_email).trim() || str(b.smtp_user).trim(),
      welcome_enabled: bool(b.welcome_enabled, true),
      welcome_subject: str(b.welcome_subject).trim() || DEFAULT_EMAIL_CONFIG.welcome_subject,
      welcome_body: str(b.welcome_body) || DEFAULT_EMAIL_CONFIG.welcome_body,
      updated_at: now(),
    };
    await db.put("settings", next);
    return json(sanitizeEmailConfigForAdmin(next));
  }
  if (is("POST", "/admin/email/test")) {
    await currentAdmin();
    const b = await body();
    const to = requireEmail(b.to, "recipient email");
    const old = (await db.get("settings", "email_config")) || {};
    const draft = {
      ...old,
      smtp_host: str(b.smtp_host).trim() || old.smtp_host || "smtp.titan.email",
      smtp_port: int(b.smtp_port, old.smtp_port || 465) || 465,
      smtp_secure:
        b.smtp_secure !== undefined
          ? Boolean(b.smtp_secure)
          : old.smtp_secure !== undefined
            ? Boolean(old.smtp_secure)
            : true,
      smtp_user: str(b.smtp_user).trim() || str(old.smtp_user),
      smtp_password: str(b.smtp_password) || str(old.smtp_password),
      from_name: str(b.from_name).trim() || old.from_name || "IndiFunded",
      from_email: str(b.from_email).trim() || old.from_email || str(b.smtp_user).trim() || str(old.smtp_user),
      reply_to: str(b.reply_to).trim() || old.reply_to,
    };
    const { sendTestEmail } = await import("./mailer");
    try {
      const info = await sendTestEmail({ to, config: draft, origin: url.origin });
      return json({ ok: true, messageId: info.messageId });
    } catch (err) {
      fail(400, err?.message || "Titan SMTP connection failed");
    }
  }

  // Settings (strip any secret fields from public payload)
  const stripSecrets = (doc) => {
    const merged = doc ? mergeSettings(DEFAULT_SETTINGS, doc) : DEFAULT_SETTINGS;
    const { email_config: _ec, smtp_password: _sp, ...safe } = merged;
    return safe;
  };
  if (is("GET", "/settings")) {
    const doc = await db.get("settings", "site");
    return json(stripSecrets(doc));
  }
  if (is("PUT", "/settings")) {
    await currentAdmin();
    const b = await body();
    delete b._id;
    delete b.email_config;
    delete b.smtp_password;
    const old = (await db.get("settings", "site")) || {};
    const next = { ...old, ...b, id: "site" };
    await db.put("settings", next);
    return json(stripSecrets(next));
  }
  if (is("DELETE", "/settings")) {
    await currentAdmin();
    await db.delAll("settings");
    return json({ ok: true });
  }

  // ===== Orders / pricing =====
  const computePricing = async (plan, couponCode, referralCode) => {
    const base = num(plan.challenge_fee);
    let final = base;
    let discount = 0;
    let ccode = null;
    if (couponCode) {
      const up = str(couponCode).trim().toUpperCase();
      const c = await db.findOne("coupons", (x) => x.code === up);
      if (couponUsable(c)) {
        discount = Math.round(base * num(c.discount_percent)) / 100;
        final = Math.max(0, Math.round((base - discount) * 100) / 100);
        ccode = up;
        await db.put("coupons", { ...c, used_count: (c.used_count || 0) + 1 });
      }
    }
    let rcode = null;
    if (referralCode) {
      const rc = str(referralCode).trim().toUpperCase();
      const r = await db.findOne("referrals", (x) => x.code === rc);
      if (r) {
        rcode = rc;
        await db.put("referrals", {
          ...r,
          referrals_count: (r.referrals_count || 0) + 1,
          earnings: (r.earnings || 0) + Math.trunc(final * 0.05),
        });
      }
    }
    return { base, final, discount, ccode, rcode };
  };
  const orderCustomer = (b) => {
    if (!str(b.customer_name) || !str(b.customer_phone)) fail(422, "Name and phone are required");
    return {
      customer_name: str(b.customer_name),
      customer_email: requireEmail(b.customer_email, "customer_email"),
      customer_phone: str(b.customer_phone),
      notes: str(b.notes),
    };
  };

  if (is("POST", "/orders/upi")) {
    const b = await body();
    const cust = orderCustomer(b);
    if (!str(b.utr).trim()) fail(422, "UTR is required");
    const plan = await db.get("plans", str(b.plan_id));
    if (!plan) fail(404, "Plan not found");
    const pr = await computePricing(plan, b.coupon_code, b.referral_code);
    const order = {
      id: uuid(),
      plan_id: plan.id,
      plan_name: plan.name,
      plan_account_size: plan.account_size,
      amount: pr.final,
      base_amount: pr.base,
      discount_amount: pr.discount,
      coupon_code: pr.ccode,
      referral_code: pr.rcode,
      currency: "inr",
      payment_method: "upi",
      upi_id: "indifunded@upi",
      utr: str(b.utr).trim(),
      ...cust,
      status: "pending_verification",
      created_at: now(),
    };
    return json(await db.put("orders", order));
  }

  if (is("POST", "/orders/razorpay/create")) {
    requireRazorpay();
    const b = await body();
    const cust = orderCustomer(b);
    const plan = await db.get("plans", str(b.plan_id));
    if (!plan) fail(404, "Plan not found");
    const pr = await computePricing(plan, b.coupon_code, b.referral_code);
    const paise = Math.round(pr.final * 100);
    if (paise < 100) fail(400, "Amount too low for online payment");
    const orderId = uuid();
    const resp = await rz("POST", "/payments/qr_codes", {
      type: "upi_qr",
      name: `IndiFunded - ${plan.name}`.slice(0, 50),
      usage: "single_use",
      fixed_amount: true,
      payment_amount: paise,
      description: `IndiFunded ${plan.name} Challenge`.slice(0, 100),
      notes: { order_id: orderId, plan: plan.name, email: cust.customer_email },
    });
    if (![200, 201].includes(resp.status))
      fail(502, `Razorpay error: ${(await resp.text()).slice(0, 300)}`);
    const qr = await resp.json();
    await db.put("orders", {
      id: orderId,
      plan_id: plan.id,
      plan_name: plan.name,
      plan_account_size: plan.account_size,
      amount: pr.final,
      base_amount: pr.base,
      discount_amount: pr.discount,
      coupon_code: pr.ccode,
      referral_code: pr.rcode,
      currency: "inr",
      payment_method: "razorpay_qr",
      razorpay_qr_id: qr.id,
      razorpay_qr_image: qr.image_url,
      razorpay_payment_id: null,
      ...cust,
      status: "pending_payment",
      created_at: now(),
    });
    return json({ order_id: orderId, qr_image: qr.image_url, qr_id: qr.id, amount: pr.final });
  }

  if ((p = is("GET", "/orders/razorpay/status/:id"))) {
    const order = await db.get("orders", p.id);
    if (!order) fail(404, "Order not found");
    if (order.status === "completed") return json({ status: "completed", paid: true });
    if (!order.razorpay_qr_id || !env("RAZORPAY_KEY_ID"))
      return json({ status: order.status, paid: false });
    const resp = await rz("GET", `/payments/qr_codes/${order.razorpay_qr_id}/payments`).catch(
      () => null,
    );
    if (!resp || resp.status !== 200) return json({ status: order.status, paid: false });
    const items = (await resp.json()).items || [];
    const captured = items.find((x) => x.status === "captured");
    if (captured) {
      await db.put("orders", { ...order, status: "completed", razorpay_payment_id: captured.id });
      await rz("POST", `/payments/qr_codes/${order.razorpay_qr_id}/close`).catch(() => null);
      return json({ status: "completed", paid: true });
    }
    return json({ status: order.status, paid: false });
  }

  if (is("POST", "/orders/razorpay/checkout-order")) {
    requireRazorpay();
    const b = await body();
    const cust = orderCustomer(b);
    const plan = await db.get("plans", str(b.plan_id));
    if (!plan) fail(404, "Plan not found");
    const pr = await computePricing(plan, b.coupon_code, b.referral_code);
    const paise = Math.round(pr.final * 100);
    if (paise < 100) fail(400, "Amount too low for online payment");
    const orderId = uuid();
    const resp = await rz("POST", "/orders", {
      amount: paise,
      currency: "INR",
      receipt: orderId.slice(0, 40),
      notes: { order_id: orderId, plan: plan.name, kind: "challenge", email: cust.customer_email },
    });
    if (![200, 201].includes(resp.status))
      fail(502, `Razorpay error: ${(await resp.text()).slice(0, 300)}`);
    const rzo = await resp.json();
    await db.put("orders", {
      id: orderId,
      plan_id: plan.id,
      plan_name: plan.name,
      plan_account_size: plan.account_size,
      amount: pr.final,
      base_amount: pr.base,
      discount_amount: pr.discount,
      coupon_code: pr.ccode,
      referral_code: pr.rcode,
      currency: "inr",
      payment_method: "razorpay_checkout",
      razorpay_order_id: rzo.id,
      razorpay_payment_id: null,
      ...cust,
      status: "pending_payment",
      created_at: now(),
    });
    return json({
      order_id: orderId,
      razorpay_order_id: rzo.id,
      amount: pr.final,
      amount_paise: paise,
      key_id: env("RAZORPAY_KEY_ID"),
      customer: {
        name: cust.customer_name,
        email: cust.customer_email,
        phone: cust.customer_phone,
      },
      description: `IndiFunded ${plan.name} Challenge`,
    });
  }

  if (is("POST", "/orders/razorpay/verify")) {
    const b = await body();
    const oid = str(b.razorpay_order_id);
    const pid = str(b.razorpay_payment_id);
    const sig = str(b.razorpay_signature);
    if (!(oid && pid && sig)) fail(400, "Missing payment fields");
    const secret = env("RAZORPAY_KEY_SECRET");
    if (!secret) fail(500, "Razorpay is not configured");
    if (!safeEqual(await hmacHex(secret, `${oid}|${pid}`), sig))
      fail(400, "Invalid Razorpay signature");
    const order = await db.findOne("orders", (x) => x.razorpay_order_id === oid);
    if (order) {
      await db.put("orders", { ...order, status: "completed", razorpay_payment_id: pid });
      return json({ status: "completed", kind: "order", id: order.id });
    }
    const reg = await db.findOne("league_registrations", (x) => x.razorpay_order_id === oid);
    if (reg) {
      await db.put("league_registrations", {
        ...reg,
        status: "completed",
        razorpay_payment_id: pid,
      });
      return json({ status: "completed", kind: "league", id: reg.id });
    }
    fail(404, "Order not found");
  }

  if (is("POST", "/webhooks/razorpay")) {
    const raw = await request.text();
    const secret = env("RAZORPAY_WEBHOOK_SECRET");
    if (!secret) fail(400, "Webhook secret not configured");
    const sig = request.headers.get("x-razorpay-signature") || "";
    if (!safeEqual(await hmacHex(secret, raw), sig)) fail(400, "Invalid signature");
    let evt;
    try {
      evt = JSON.parse(raw);
    } catch {
      fail(400, "Invalid payload");
    }
    const pay = evt?.payload?.payment?.entity || {};
    const qrE = evt?.payload?.qr_code?.entity || {};
    const qrId = qrE.id || pay.qr_code_id;
    let order = null;
    if (qrId) order = await db.findOne("orders", (x) => x.razorpay_qr_id === qrId);
    if (!order && pay.notes?.order_id) order = await db.get("orders", str(pay.notes.order_id));
    if (order && order.status !== "completed" && pay.status === "captured") {
      await db.put("orders", { ...order, status: "completed", razorpay_payment_id: pay.id });
    }
    return json({ status: "ok" });
  }

  if ((p = is("PATCH", "/orders/:id/status"))) {
    await currentAdmin();
    const status = url.searchParams.get("status") || str((await body()).status);
    if (!["pending_verification", "completed", "rejected"].includes(status))
      fail(400, "Invalid status");
    const o = await db.get("orders", p.id);
    if (!o) fail(404, "Order not found");
    return json(await db.put("orders", { ...o, status }));
  }
  if ((p = is("DELETE", "/orders/:id"))) {
    await currentAdmin();
    await db.del("orders", p.id);
    return json({ ok: true });
  }
  if (is("GET", "/orders")) {
    await currentAdmin();
    return json((await db.all("orders")).sort(byDesc("created_at")));
  }
  if (is("GET", "/admin/stats")) {
    await currentAdmin();
    const [plans, blogs, leads, orders, payouts] = await Promise.all(
      ["plans", "blogs", "leads", "orders", "payout_requests"].map((c) => db.all(c)),
    );
    return json({
      plans: plans.length,
      blogs: blogs.length,
      leads: leads.length,
      orders: orders.length,
      pending_orders: orders.filter((o) => o.status === "pending_verification").length,
      revenue: orders
        .filter((o) => o.status === "completed")
        .reduce((s, o) => s + num(o.amount), 0),
      payout_requests: payouts.length,
      pending_payouts: payouts.filter((x) => x.status === "pending").length,
    });
  }

  // Stripe endpoints from the original are not used by the site's pages.
  if (
    is("POST", "/checkout/session") ||
    is("POST", "/webhook/stripe") ||
    (seg[0] === "checkout" && seg[1] === "status")
  ) {
    fail(410, "Card checkout is not available. Please pay via UPI.");
  }

  // ===== Weekly highest payouts =====
  if (is("GET", "/weekly-highest-payouts")) {
    const curated = (await db.all("weekly_payouts"))
      .filter((x) => x.visible)
      .sort((a, b) => num(a.order) - num(b.order) || num(b.amount) - num(a.amount));
    if (curated.length) {
      const seen = new Map();
      for (const r of curated) if (!seen.has(r.plan || "")) seen.set(r.plan || "", r);
      return json([...seen.values()]);
    }
    const certs = (await db.all("certificates")).filter((c) => c.visible);
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const group = (rows) => {
      const m = new Map();
      for (const c of [...rows].sort(byNum("amount", -1))) {
        if (!m.has(c.plan))
          m.set(c.plan, {
            trader_name: c.trader_name,
            amount: c.amount,
            plan: c.plan,
            account_size: c.account_size,
            payout_date: c.payout_date,
            image_url: c.image_url,
          });
      }
      return [...m.values()].sort(byNum("amount", -1));
    };
    let rows = group(certs.filter((c) => str(c.created_at) >= since));
    if (!rows.length) rows = group(certs);
    return json(rows);
  }
  const wpFields = certFields;
  if (is("GET", "/admin/weekly-payouts")) {
    await currentAdmin();
    return json(
      (await db.all("weekly_payouts")).sort(
        (a, b) => num(a.order) - num(b.order) || str(b.created_at).localeCompare(str(a.created_at)),
      ),
    );
  }
  if (is("POST", "/admin/weekly-payouts")) {
    await currentAdmin();
    return json(
      await db.put("weekly_payouts", { id: uuid(), ...wpFields(await body()), created_at: now() }),
    );
  }
  if ((p = is("PUT", "/admin/weekly-payouts/:id"))) {
    await currentAdmin();
    const old = await db.get("weekly_payouts", p.id);
    if (!old) return json(null);
    return json(await db.put("weekly_payouts", { ...old, ...wpFields(await body()) }));
  }
  if ((p = is("DELETE", "/admin/weekly-payouts/:id"))) {
    await currentAdmin();
    await db.del("weekly_payouts", p.id);
    return json({ ok: true });
  }

  // ===== Trader League =====
  const leagueEnabled = async () => !!(await db.get("system_meta", "league_enabled"))?.value;
  if (is("GET", "/league/config"))
    return json({
      enabled: await leagueEnabled(),
      fee_existing: LEAGUE_FEE_EXISTING,
      fee_new: LEAGUE_FEE_NEW,
    });
  if (is("PUT", "/league/config")) {
    await currentAdmin();
    const enabled = !!(await body()).enabled;
    await db.put("system_meta", {
      id: "league_enabled",
      key: "league_enabled",
      value: enabled,
      updated_at: now(),
    });
    return json({ enabled });
  }
  if (is("POST", "/league/register")) {
    if (!(await leagueEnabled())) fail(403, "Trader League registration is currently closed");
    requireRazorpay();
    const b = await body();
    const existing = !!b.is_existing_trader;
    if (!str(b.full_name) || !str(b.phone)) fail(422, "Name and phone are required");
    const email = requireEmail(b.email);
    if (existing && !str(b.trader_id).trim())
      fail(400, "Trader ID is required for existing traders");
    const amount = existing ? LEAGUE_FEE_EXISTING : LEAGUE_FEE_NEW;
    const reg = {
      id: uuid(),
      full_name: str(b.full_name),
      email,
      phone: str(b.phone),
      is_existing_trader: existing,
      trader_id: str(b.trader_id),
      notes: str(b.notes),
      amount,
      status: "pending_payment",
      razorpay_qr_id: "",
      razorpay_qr_image: "",
      razorpay_order_id: "",
      razorpay_payment_id: "",
      created_at: now(),
    };
    const paise = Math.round(amount * 100);
    const resp = await rz("POST", "/orders", {
      amount: paise,
      currency: "INR",
      receipt: reg.id.slice(0, 40),
      notes: { reg_id: reg.id, email, kind: "league" },
    });
    if (![200, 201].includes(resp.status))
      fail(502, `Razorpay error: ${(await resp.text()).slice(0, 300)}`);
    reg.razorpay_order_id = (await resp.json()).id || "";
    await db.put("league_registrations", reg);
    return json({
      registration_id: reg.id,
      razorpay_order_id: reg.razorpay_order_id,
      amount,
      amount_paise: paise,
      key_id: env("RAZORPAY_KEY_ID"),
      customer: { name: reg.full_name, email, phone: reg.phone },
      description: "IndiFunded Trader League Registration",
    });
  }
  if ((p = is("GET", "/league/status/:id"))) {
    const reg = await db.get("league_registrations", p.id);
    if (!reg) fail(404, "Registration not found");
    return json({ status: reg.status, amount: reg.amount });
  }
  if (is("GET", "/league/registrations")) {
    await currentAdmin();
    return json((await db.all("league_registrations")).sort(byDesc("created_at")));
  }
  if ((p = is("DELETE", "/league/registrations/:id"))) {
    await currentAdmin();
    await db.del("league_registrations", p.id);
    return json({ ok: true });
  }

  // ===== Certificate AI reader =====
  if (is("POST", "/admin/certificates/analyze")) {
    await currentAdmin();
    const b = await body();
    const d = str(b.data_url);
    if (!d.startsWith("data:image/")) fail(400, "Not a valid image data URL");
    const key = env("LOVABLE_API_KEY");
    if (!key) fail(500, "AI is not configured");
    const system =
      'You are a receipt/bank-transfer OCR assistant. You will be shown a screenshot of a UPI/bank payout receipt. Extract these fields and return ONLY valid JSON (no markdown fences, no commentary): {"name": "recipient full name", "amount": <number in INR without commas or currency symbol>, "date": "YYYY-MM-DD", "plan": "Starter | Standard | Pro (guess based on amount: <15000 Starter, 15000-30000 Standard, >30000 Pro)", "raw_text": "short summary of what the receipt shows"}. If a field is not visible, use null.';
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the fields from this payout receipt." },
              { type: "image_url", image_url: { url: d } },
            ],
          },
        ],
      }),
    });
    if (resp.status === 429) fail(429, "AI is busy, please try again in a moment.");
    if (resp.status === 402)
      fail(402, "AI credits are used up. Add credits in workspace settings.");
    if (!resp.ok) fail(502, `AI analysis failed: ${(await resp.text()).slice(0, 200)}`);
    const text = str((await resp.json()).choices?.[0]?.message?.content)
      .replace(/^```(?:json)?\s*|\s*```$/gm, "")
      .trim();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m)
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = null;
        }
    }
    if (!parsed)
      return json({
        name: null,
        amount: null,
        date: null,
        plan: null,
        raw_text: text.slice(0, 500),
      });
    return json({
      name: parsed.name ?? null,
      amount: parsed.amount ?? null,
      date: parsed.date ?? null,
      plan: parsed.plan ?? null,
      raw_text: parsed.raw_text || "",
    });
  }

  // ===== Coupons =====
  if (is("GET", "/coupons")) {
    await currentAdmin();
    return json((await db.all("coupons")).sort(byDesc("created_at")));
  }
  if (is("POST", "/coupons")) {
    await currentAdmin();
    const f = couponFields(await body());
    if (!f.code) fail(400, "Code required");
    if (await db.findOne("coupons", (x) => x.code === f.code))
      fail(400, "Coupon code already exists");
    return json(await db.put("coupons", { ...f, id: uuid(), used_count: 0, created_at: now() }));
  }
  if ((p = is("PUT", "/coupons/:id"))) {
    await currentAdmin();
    const old = await db.get("coupons", p.id);
    if (!old) fail(404, "Coupon not found");
    return json(await db.put("coupons", { ...old, ...couponFields(await body()) }));
  }
  if ((p = is("DELETE", "/coupons/:id"))) {
    await currentAdmin();
    await db.del("coupons", p.id);
    return json({ ok: true });
  }
  if (is("POST", "/coupons/validate")) {
    const b = await body();
    const code = str(b.code).trim().toUpperCase();
    const c = await db.findOne("coupons", (x) => x.code === code);
    if (!c || c.active === false) fail(404, "Invalid or inactive coupon");
    if (c.max_uses !== null && c.max_uses !== undefined && (c.used_count || 0) >= c.max_uses)
      fail(400, "Coupon usage limit reached");
    if (c.expires_at) {
      const exp = new Date(c.expires_at);
      if (!isNaN(exp.getTime()) && exp < new Date()) fail(400, "Coupon has expired");
    }
    const amount = num(b.amount);
    const discount = Math.round(amount * num(c.discount_percent)) / 100;
    return json({
      code,
      discount_percent: c.discount_percent,
      discount_amount: discount,
      final_amount: Math.max(0, Math.round((amount - discount) * 100) / 100),
      description: c.description || "",
    });
  }

  // ===== Leaderboard =====
  if (is("GET", "/leaderboard")) {
    const limit = Math.min(int(url.searchParams.get("limit"), 20) || 20, 100);
    return json((await db.all("leaderboard")).sort(byNum("total_payout", -1)).slice(0, limit));
  }
  if (is("POST", "/leaderboard")) {
    await currentAdmin();
    return json(
      await db.put("leaderboard", {
        ...leaderboardFields(await body()),
        id: uuid(),
        created_at: now(),
      }),
    );
  }
  if ((p = is("PUT", "/leaderboard/:id"))) {
    await currentAdmin();
    const old = await db.get("leaderboard", p.id);
    if (!old) fail(404, "Entry not found");
    return json(await db.put("leaderboard", { ...old, ...leaderboardFields(await body()) }));
  }
  if ((p = is("DELETE", "/leaderboard/:id"))) {
    await currentAdmin();
    await db.del("leaderboard", p.id);
    return json({ ok: true });
  }

  // ===== Referrals =====
  if (is("POST", "/referrals")) {
    const b = await body();
    if (!str(b.name)) fail(422, "name is required");
    const email = requireEmail(b.email);
    const existing = await db.findOne("referrals", (x) => x.email === email);
    const publicView = (r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      referrals_count: r.referrals_count || 0,
      earnings: r.earnings || 0,
      created_at: r.created_at,
    });
    if (existing) return json(publicView(existing));
    const all = await db.all("referrals");
    const base =
      str(b.name)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6) || "TRADE";
    let code = "";
    for (let i = 0; i < 5; i++) {
      code = base + String(Math.floor(Math.random() * 10000)).padStart(4, "0");
      if (!all.some((x) => x.code === code)) break;
    }
    const doc = {
      id: uuid(),
      code,
      name: str(b.name),
      email,
      phone: str(b.phone),
      referrals_count: 0,
      earnings: 0,
      created_at: now(),
    };
    await db.put("referrals", doc);
    return json(publicView(doc));
  }
  if ((p = is("GET", "/referrals/:code"))) {
    const code = p.code.trim().toUpperCase();
    const r = await db.findOne("referrals", (x) => x.code === code);
    if (!r) fail(404, "Referral code not found");
    return json({ code: r.code, name: r.name, referrals_count: r.referrals_count || 0 });
  }
  if (is("GET", "/admin/referrals")) {
    await currentAdmin();
    return json((await db.all("referrals")).sort(byDesc("created_at")));
  }
  if ((p = is("DELETE", "/admin/referrals/:id"))) {
    await currentAdmin();
    await db.del("referrals", p.id);
    return json({ ok: true });
  }

  fail(404, "Not Found");
}
