import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "../context/AuthContext";
import { computeAccountTrialStatus } from "./trial";

export function useTraderState(options = {}) {
  const { pollMs = 5000 } = options;
  const { user } = useAuth();
  const [accountId, setAccountId] = useState("");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [forcedLock, setForcedLock] = useState(false);

  const load = useCallback(
    async (overrideId) => {
      if (!user) {
        setState(null);
        setLoading(false);
        return null;
      }
      try {
        const targetId = overrideId ?? accountId;
        const params = targetId ? { account_id: targetId } : {};
        const { data } = await api.get("/me/trading-state", { params });
        setState(data);
        if (data?.server_now) {
          const parsedServer = Date.parse(data.server_now);
          if (!Number.isNaN(parsedServer)) {
            setClockOffsetMs(parsedServer - Date.now());
          }
        }
        if (data?.activeAccount?.id && !targetId) {
          setAccountId(data.activeAccount.id);
        }
        setForcedLock(Boolean(data?.trial?.isLocked));
        return data;
      } catch {
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, accountId],
  );

  useEffect(() => {
    load();
    if (!user || !pollMs || pollMs < 1500) return;
    const id = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) {
        load();
      }
    }, pollMs);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [load, pollMs, user]);

  const activeAccount = state?.activeAccount || null;
  const accounts = state?.accounts || [];

  const trialStatus = useMemo(() => {
    const computed = computeAccountTrialStatus(activeAccount, accounts, nowMs + clockOffsetMs);
    return {
      ...computed,
      isLocked: forcedLock ? true : computed.isLocked,
      secondsRemaining: forcedLock ? 0 : computed.secondsRemaining,
    };
  }, [activeAccount, accounts, nowMs, clockOffsetMs, forcedLock]);

  useEffect(() => {
    if (!user || !trialStatus.isTrialAccount || trialStatus.isLocked) return;
    const tick = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(tick);
  }, [user, trialStatus.isTrialAccount, trialStatus.isLocked]);

  const selectAccount = useCallback(
    async (nextId) => {
      setForcedLock(false);
      setAccountId(nextId);
      return load(nextId);
    },
    [load],
  );

  const placeOrder = useCallback(
    async ({ symbol, side, qty, type = "MARKET", limit_price }) => {
      setSubmitting(true);
      try {
        const { data } = await api.post("/me/orders", {
          account_id: state?.activeAccount?.id || accountId,
          symbol,
          side,
          qty,
          type,
          limit_price,
        });
        await load();
        return data;
      } catch (err) {
        if (err?.response?.data?.code === "TRIAL_EXPIRED") {
          setForcedLock(true);
          load();
        }
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [accountId, load, state?.activeAccount?.id],
  );

  const closePosition = useCallback(
    async (posId) => {
      setSubmitting(true);
      try {
        const { data } = await api.post(`/me/positions/${posId}/close`);
        await load();
        return data;
      } catch (err) {
        if (err?.response?.data?.code === "TRIAL_EXPIRED") {
          setForcedLock(true);
          load();
        }
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [load],
  );

  return {
    authenticated: !!user,
    isAdmin: user?.role === "admin",
    accounts,
    activeAccount,
    trialStatus,
    orders: state?.orders || [],
    positions: state?.positions || [],
    trades: state?.trades || [],
    transactions: state?.transactions || [],
    loading,
    submitting,
    selectAccount,
    placeOrder,
    closePosition,
    refresh: () => load(),
  };
}
