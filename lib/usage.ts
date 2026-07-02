// Time-based rolling usage windows (5-hour / daily / monthly) — NOT credit top-ups.
// Pure logic: roll a window when it expires, check token limits, compute reset countdowns.
// On limit hit the engine auto-pauses and reports when the window resets.

export type WindowKind = "FIVE_HOUR" | "DAILY" | "MONTHLY";

export const WINDOW_MS: Record<WindowKind, number> = {
  FIVE_HOUR: 5 * 3600_000,
  DAILY: 24 * 3600_000,
  MONTHLY: 30 * 24 * 3600_000,
};

export type Plan = "free" | "starter" | "pro" | "scale";

// ── plan feature gates — the single vocabulary for "what does paid buy" ─────
// Free proves the loop: dual-AI build, critique score, preview, zip. Paid buys the quality
// engine (chosen model, auto design-polish, reference images) and shipping conveniences
// (GitHub export, one-click deploy); Pro adds version history. Enforced server-side.
export const isPaid = (p: Plan) => p !== "free";
export const canAutoPolish = isPaid; // automatic design-critic restyle passes
export const canUseReferenceImages = isPaid;
export const canShipDirect = isPaid; // GitHub export + one-click deploy (zip is always free)
export const hasVersionHistory = (p: Plan) => p === "pro" || p === "scale";

// Token ceilings per rolling window per plan (illustrative tiers).
export const TOKEN_LIMITS: Record<Plan, Record<WindowKind, number>> = {
  free: { FIVE_HOUR: 50_000, DAILY: 120_000, MONTHLY: 300_000 },
  starter: { FIVE_HOUR: 200_000, DAILY: 600_000, MONTHLY: 4_000_000 },
  pro: { FIVE_HOUR: 500_000, DAILY: 1_500_000, MONTHLY: 12_000_000 },
  scale: { FIVE_HOUR: 1_500_000, DAILY: 5_000_000, MONTHLY: 40_000_000 },
};

export type WindowState = { kind: WindowKind; used: number; startedAt: number };

export function resetAt(w: WindowState): number {
  return w.startedAt + WINDOW_MS[w.kind];
}

// Returns a fresh window (used reset to 0) if the current one has elapsed.
export function rolled(w: WindowState, now: number): WindowState {
  return now >= resetAt(w) ? { kind: w.kind, used: 0, startedAt: now } : w;
}

export function limitFor(plan: Plan, kind: WindowKind): number {
  return TOKEN_LIMITS[plan][kind];
}

export function overLimit(w: WindowState, plan: Plan): boolean {
  return w.used >= limitFor(plan, w.kind);
}

export function msUntilReset(w: WindowState, now: number): number {
  return Math.max(0, resetAt(w) - now);
}

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}
