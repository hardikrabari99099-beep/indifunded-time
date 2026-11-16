import axios from "axios";
import { supabase } from "@/integrations/supabase/client";

// Same-origin API (implemented in src/routes/api/$.ts).
export const API = "/api";

export const api = axios.create({ baseURL: API, withCredentials: false });

const ADMIN_TOKEN_KEY = "if_admin_token";
let memAdminToken = "";

export function getAdminToken() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_KEY) || memAdminToken;
  } catch {
    return memAdminToken;
  }
}

export function setAdminToken(token) {
  memAdminToken = token || "";
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore storage errors in private iframes
  }
}

export function clearAdminToken() {
  setAdminToken("");
}

// Attach the signed-in user's session token.
api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const adminToken = getAdminToken();
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
      return config;
    }
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    if (t) config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
