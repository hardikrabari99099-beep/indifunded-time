import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Link, Navigate, useNavigate, useLocation } from "@/lib/router-compat";
import { formatApiError } from "../lib/api";
import { useSEO } from "../lib/useSEO";
import { passwordChecks, friendlyAuthError } from "../lib/auth-messages";
import { Loader2, LockKeyhole, UserPlus, Eye, EyeOff, AlertCircle, Check, X } from "lucide-react";

export default function Login() {
  useSEO({
    title: "Sign in — IndiFunded",
    description: "IndiFunded trader sign-in.",
    path: "/login",
  });
  const { user, login, signup } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const initialMode = new URLSearchParams(loc.search).get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  // Block taps before the page is interactive (otherwise the form does a plain reload and "nothing happens").
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  useEffect(() => {
    setError("");
  }, [mode]);

  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/app"} replace />;

  const isSignup = mode === "signup";
  const checks = passwordChecks(form.password);
  const pwOk = checks.every((c) => c.ok);
  const field = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (error) setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (isSignup) {
      if (!form.name.trim()) return setError("Please enter your full name.");
      if (!pwOk)
        return setError(
          "Please choose a stronger password — see the checklist below the password box.",
        );
    }
    setBusy(true);
    try {
      const nextParam = new URLSearchParams(loc.search).get("next");
      if (isSignup) {
        const me = await signup({ ...form, email: form.email.trim().toLowerCase() });
        toast.success(`Welcome to IndiFunded, ${(me?.name || form.name).split(" ")[0]}!`);
        nav(nextParam || "/app");
      } else {
        const res = await login(form.email, form.password);
        toast.success(`Welcome back${res?.name ? ", " + res.name.split(" ")[0] : ""}`);
        nav(res?.role === "admin" ? "/admin" : nextParam || "/app");
      }
    } catch (err) {
      setError(
        friendlyAuthError(formatApiError(err.response?.data?.detail) || err.message, isSignup),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-xl pt-12 md:pt-16 pb-24 max-w-md">
      <div className="card-panel p-6 sm:p-8 md:p-10 glow-border auth-card" data-testid="auth-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl grid place-items-center bg-[var(--accent)] text-white">
            {isSignup ? <UserPlus size={18} /> : <LockKeyhole size={18} />}
          </div>
          <div>
            <div className="font-display text-2xl">
              {isSignup ? "Create your account" : "Welcome back"}
            </div>
            <div className="text-xs text-[var(--muted-2)] font-mono tracking-wider uppercase mt-0.5">
              IndiFunded Trader
            </div>
          </div>
        </div>

        <div
          className="flex gap-2 rounded-full bg-[var(--bg-1)] p-1 border border-[var(--border-hi)] mb-6"
          role="tablist"
          data-testid="auth-mode-switch"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            onClick={() => setMode("login")}
            className={`flex-1 rounded-full py-2 text-sm transition-colors ${!isSignup ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white"}`}
            data-testid="auth-tab-login"
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-full py-2 text-sm transition-colors ${isSignup ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white"}`}
            data-testid="auth-tab-signup"
          >
            Sign up
          </button>
        </div>

        {error && (
          <div role="alert" className="auth-error mb-5" data-testid="auth-error">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form method="post" action="#" onSubmit={submit} className="space-y-4" noValidate={false}>
          {isSignup && (
            <>
              <div>
                <label
                  htmlFor="su-name"
                  className="text-xs uppercase tracking-wider text-[var(--muted-2)] font-mono"
                >
                  Full name
                </label>
                <input
                  id="su-name"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={field("name")}
                  className="input-dark mt-2"
                  placeholder="Rahul Sharma"
                  data-testid="signup-name"
                />
              </div>
              <div>
                <label
                  htmlFor="su-phone"
                  className="text-xs uppercase tracking-wider text-[var(--muted-2)] font-mono"
                >
                  Mobile (optional)
                </label>
                <input
                  id="su-phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={field("phone")}
                  className="input-dark mt-2"
                  placeholder="+91 9XXXXXXXXX"
                  data-testid="signup-phone"
                />
              </div>
            </>
          )}
          <div>
            <label
              htmlFor="au-email"
              className="text-xs uppercase tracking-wider text-[var(--muted-2)] font-mono"
            >
              Email
            </label>
            <input
              id="au-email"
              required
              type="email"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={field("email")}
              className="input-dark mt-2"
              placeholder="you@example.com"
              data-testid="auth-email"
            />
          </div>
          <div>
            <label
              htmlFor="au-pw"
              className="text-xs uppercase tracking-wider text-[var(--muted-2)] font-mono"
            >
              Password
            </label>
            <div className="relative mt-2">
              <input
                id="au-pw"
                required
                type={showPw ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={form.password}
                onChange={field("password")}
                className="input-dark pr-11"
                placeholder={isSignup ? "Create a strong password" : "••••••••"}
                data-testid="auth-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white"
              >
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {isSignup ? (
              <ul className="auth-checks mt-3" aria-label="Password requirements">
                {checks.map((c) => (
                  <li key={c.label} className={c.ok ? "is-ok" : ""}>
                    {c.ok ? <Check size={13} /> : <X size={13} />} {c.label}
                  </li>
                ))}
              </ul>
            ) : (
              <Link
                to="/forgot-password"
                className="text-xs text-[var(--muted)] hover:text-white mt-2 inline-block"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <button
            type="submit"
            disabled={busy || !ready}
            className="btn-amber rounded-full w-full py-3 text-sm inline-flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
            data-testid="auth-submit"
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" size={16} />{" "}
                {isSignup ? "Creating account…" : "Signing in…"}
              </>
            ) : isSignup ? (
              "Create account"
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <div className="text-xs text-[var(--muted-2)] text-center mt-6">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-[var(--accent)] hover:underline"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New to IndiFunded?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-[var(--accent)] hover:underline"
              >
                Create an account
              </button>
            </>
          )}
        </div>
        <div className="text-[10px] text-[var(--muted-2)] text-center mt-4">
          By continuing, you agree to our{" "}
          <Link to="/rules" className="hover:text-white">
            rules
          </Link>{" "}
          and privacy policy.
        </div>
      </div>
    </div>
  );
}
