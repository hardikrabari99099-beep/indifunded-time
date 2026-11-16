export const TRIAL_DURATION_SECONDS = 300;
export const TRIAL_DURATION_MS = TRIAL_DURATION_SECONDS * 1000;
export const TRIAL_CAPITAL_INR = 100000;

export interface TrialStatus {
  hasTrialAccount: boolean;
  isTrialAccount: boolean;
  isLocked: boolean;
  hasPurchasedAccount: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  secondsRemaining: number;
}

export function isTrialAccountRecord(account: Record<string, unknown> | null | undefined): boolean {
  if (!account) return false;
  if (account.is_trial === true) return true;
  if (account.account_type === "Trial Explorer") return true;
  const id = String(account.id || "");
  return id.startsWith("acct-wallet-") && !account.order_id && account.status !== "Funded";
}

export function computeAccountTrialStatus(
  activeAccount: Record<string, unknown> | null | undefined,
  allAccounts: Array<Record<string, unknown>> = [],
  nowMs: number = Date.now(),
): TrialStatus {
  const hasPurchasedAccount = allAccounts.some(
    (a) => a && !isTrialAccountRecord(a) && ["Active", "Funded", "Passed"].includes(String(a.status || "Active")),
  );
  const trialAccount = allAccounts.find((a) => isTrialAccountRecord(a)) || null;
  const isCurrentTrial = isTrialAccountRecord(activeAccount);

  if (!activeAccount || !isCurrentTrial) {
    return {
      hasTrialAccount: Boolean(trialAccount),
      isTrialAccount: false,
      isLocked: false,
      hasPurchasedAccount,
      startedAt: (trialAccount?.trial_started_at as string) || null,
      expiresAt: (trialAccount?.trial_expires_at as string) || null,
      secondsRemaining: 0,
    };
  }

  const startedAt =
    typeof activeAccount.trial_started_at === "string"
      ? activeAccount.trial_started_at
      : typeof activeAccount.created_at === "string"
        ? activeAccount.created_at
        : new Date(nowMs).toISOString();

  const startMs = Date.parse(startedAt);
  const explicitExpMs =
    typeof activeAccount.trial_expires_at === "string"
      ? Date.parse(activeAccount.trial_expires_at)
      : NaN;
  const expiresMs = !Number.isNaN(explicitExpMs)
    ? explicitExpMs
    : (!Number.isNaN(startMs) ? startMs : nowMs) + TRIAL_DURATION_MS;
  const expiresAt = new Date(expiresMs).toISOString();
  const remainingMs = Math.max(0, expiresMs - nowMs);
  const secondsRemaining = Math.ceil(remainingMs / 1000);
  const isLocked = Boolean(activeAccount.trial_locked) || remainingMs <= 0;

  return {
    hasTrialAccount: true,
    isTrialAccount: true,
    isLocked,
    hasPurchasedAccount,
    startedAt,
    expiresAt,
    secondsRemaining: isLocked ? 0 : secondsRemaining,
  };
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
