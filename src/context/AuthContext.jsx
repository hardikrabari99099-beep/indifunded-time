import { createContext, useContext, useEffect, useState } from "react";
import { api, clearAdminToken, getAdminToken, setAdminToken } from "../lib/api";
import { supabase } from "@/integrations/supabase/client";

const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  refresh: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch {
      clearAdminToken();
      setUser(null);
      return null;
    }
  };

  const clearStoredSupabaseSession = () => {
    if (typeof window === "undefined") return "";
    let accessToken = "";
    try {
      const keysToRemove = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && /^sb-.*-auth-token/.test(k)) {
          keysToRemove.push(k);
          try {
            const parsed = JSON.parse(window.localStorage.getItem(k) || "null");
            if (parsed?.access_token && !accessToken) accessToken = parsed.access_token;
          } catch {
            // ignore non-JSON entries
          }
        }
      }
      for (const k of keysToRemove) window.localStorage.removeItem(k);
    } catch {
      // ignore storage errors in restricted iframes
    }
    return accessToken;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (getAdminToken()) {
          const me = await loadMe();
          if (me) {
            if (alive) setLoading(false);
            return;
          }
        }
        const { data } = await supabase.auth.getSession();
        if (data?.session) await loadMe();
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !getAdminToken()) setUser(null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await api.post("/auth/admin-login", { email: cleanEmail, password });
      if (res.data?.token) {
        setAdminToken(res.data.token);
        const me = await loadMe();
        return me || res.data.user;
      }
    } catch (admErr) {
      if (admErr?.response?.status === 401) {
        const err = new Error("Wrong email or password.");
        err.response = { data: { detail: "Wrong email or password." } };
        throw err;
      }
      // 404 NOT_ADMIN falls through cleanly to standard Supabase trader sign-in
    }

    clearAdminToken();
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) {
      const msg = /confirm/i.test(error.message)
        ? "Please confirm your email first — check your inbox."
        : /invalid/i.test(error.message)
          ? "Wrong email or password. No account yet? Tap Sign up."
          : error.message;
      const err = new Error(error.message);
      err.response = { data: { detail: msg } };
      throw err;
    }
    const me = await loadMe();
    return me;
  };

  const signup = async (payload) => {
    clearAdminToken();
    const { data } = await api.post("/auth/signup", payload);
    await supabase.auth.signInWithPassword({ email: data.email, password: payload.password });
    const me = await loadMe();
    return { ...me, ...data };
  };

  const refresh = loadMe;

  const logout = async () => {
    clearAdminToken();
    const sbToken = clearStoredSupabaseSession();
    setUser(null);
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    if (sbToken) {
      api.post("/auth/logout", { access_token: sbToken }).catch(() => {});
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
