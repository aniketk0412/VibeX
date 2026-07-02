// The usage-window logic gates real money (plan enforcement) — pin its behavior.

import { describe, it, expect } from "vitest";
import {
  WINDOW_MS,
  TOKEN_LIMITS,
  rolled,
  overLimit,
  limitFor,
  msUntilReset,
  resetAt,
  formatDuration,
  type WindowState,
} from "@/lib/usage";

const t0 = 1_750_000_000_000; // fixed epoch for determinism

describe("rolled", () => {
  it("keeps a live window untouched", () => {
    const w: WindowState = { kind: "FIVE_HOUR", used: 42_000, startedAt: t0 };
    expect(rolled(w, t0 + WINDOW_MS.FIVE_HOUR - 1)).toEqual(w);
  });

  it("resets used to 0 exactly at expiry", () => {
    const w: WindowState = { kind: "FIVE_HOUR", used: 42_000, startedAt: t0 };
    const next = rolled(w, t0 + WINDOW_MS.FIVE_HOUR);
    expect(next.used).toBe(0);
    expect(next.startedAt).toBe(t0 + WINDOW_MS.FIVE_HOUR);
  });
});

describe("overLimit / limitFor", () => {
  it("free plan pauses at exactly the ceiling, not before", () => {
    const limit = TOKEN_LIMITS.free.FIVE_HOUR;
    expect(overLimit({ kind: "FIVE_HOUR", used: limit - 1, startedAt: t0 }, "free")).toBe(false);
    expect(overLimit({ kind: "FIVE_HOUR", used: limit, startedAt: t0 }, "free")).toBe(true);
  });

  it("every plan's limits grow monotonically with tier", () => {
    for (const kind of ["FIVE_HOUR", "DAILY", "MONTHLY"] as const) {
      expect(limitFor("free", kind)).toBeLessThan(limitFor("starter", kind));
      expect(limitFor("starter", kind)).toBeLessThan(limitFor("pro", kind));
      expect(limitFor("pro", kind)).toBeLessThan(limitFor("scale", kind));
    }
  });

  it("no plan's monthly limit is smaller than its daily limit", () => {
    for (const plan of ["free", "starter", "pro", "scale"] as const) {
      expect(limitFor(plan, "MONTHLY")).toBeGreaterThanOrEqual(limitFor(plan, "DAILY"));
      expect(limitFor(plan, "DAILY")).toBeGreaterThanOrEqual(limitFor(plan, "FIVE_HOUR"));
    }
  });
});

describe("reset timing", () => {
  it("msUntilReset counts down and clamps at 0", () => {
    const w: WindowState = { kind: "DAILY", used: 0, startedAt: t0 };
    expect(msUntilReset(w, t0)).toBe(WINDOW_MS.DAILY);
    expect(msUntilReset(w, resetAt(w) + 5_000)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("renders minutes and hours", () => {
    expect(formatDuration(9 * 60_000)).toBe("9m");
    expect(formatDuration(3 * 3600_000 + 12 * 60_000)).toBe("3h 12m");
  });
});
