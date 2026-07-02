// Plan catalog — the single source of truth for pricing UI. Limits are derived from the
// engine's real rolling-window token ceilings (lib/usage.ts) so marketing and enforcement
// never drift apart. Time-based windows, not credit top-ups.

import { TOKEN_LIMITS, type Plan as PlanId } from "@/lib/usage";

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  tagline: string;
  projects: string;
  cta: { label: string; href: string };
  highlight?: boolean;
  features: string[];
};

function compact(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `${Math.round(n / 1000)}k`;
}

// "50k / 5h · 300k / mo" — human-readable window limits for a plan.
export function windowNote(id: PlanId): string {
  const l = TOKEN_LIMITS[id];
  return `${compact(l.FIVE_HOUR)} tokens / 5h · ${compact(l.MONTHLY)} / mo`;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free trial",
    price: 0,
    tagline: "Run the whole loop, once.",
    projects: "1 project ever",
    cta: { label: "Start free", href: "/new" },
    features: [
      "Coder + Reviewer dual-AI",
      "Live usage & always-on interrupt",
      "Auto-pause & resume on limits",
      "Download code + prompt history",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 12,
    tagline: "For steady side-project building.",
    projects: "Unlimited projects",
    cta: { label: "Choose Starter", href: "/api/checkout?plan=starter" },
    features: [
      "Everything in Free",
      "Your chosen model on Vibex keys",
      "Higher rolling limits",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    tagline: "For builders shipping every week.",
    projects: "Unlimited projects",
    cta: { label: "Choose Pro", href: "/api/checkout?plan=pro" },
    highlight: true,
    features: [
      "Everything in Starter",
      "Pro-tier rolling limits",
      "Longer runs before reset",
      "Priority support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    price: 79,
    tagline: "For heavy, back-to-back runs.",
    projects: "Unlimited projects",
    cta: { label: "Choose Scale", href: "/api/checkout?plan=scale" },
    features: [
      "Everything in Pro",
      "Highest rolling limits",
      "Concurrent runs (up to 3)",
      "Priority support",
    ],
  },
];

// BYOK is a capability, not a billable plan — nothing in the product charges or enforces a BYOK
// fee (there's no `byok` plan id and no checkout variant), so the page must not advertise one.
// Builds on your own keys skip Vibex's token windows entirely (see lib/engine.ts).
export const BYOK = {
  name: "Bring your own key",
  price: 0,
  priceNote: "works with every plan",
  tagline: "Use your own provider keys — we just run the loop, billed to you.",
  cta: { label: "Set up your own key", href: "/settings" },
  features: [
    "Your Anthropic / OpenAI / Google / OpenRouter keys",
    "No Vibex token windows — provider limits apply",
    "Your chosen model, always",
    "Keys encrypted at rest (AES-256)",
  ],
};

// ── plan comparison matrix — drives the pricing table ─────────────────
// One row per capability, one value per plan (order matches PLANS). `true` → included,
// `false` → not included, string → shown verbatim. Limits derive from TOKEN_LIMITS so the
// table can never drift from what the engine enforces.
export type MatrixValue = boolean | string;
export type MatrixRow = { label: string; values: [MatrixValue, MatrixValue, MatrixValue, MatrixValue]; note?: string };
export type MatrixGroup = { group: string; rows: MatrixRow[] };

function limits(kind: "FIVE_HOUR" | "MONTHLY"): [string, string, string, string] {
  return PLANS.map((p) => compact(TOKEN_LIMITS[p.id][kind])) as [string, string, string, string];
}

export const MATRIX: MatrixGroup[] = [
  {
    group: "Usage",
    rows: [
      { label: "Projects", values: ["1 ever", "Unlimited", "Unlimited", "Unlimited"] },
      { label: "Tokens per 5-hour window", values: limits("FIVE_HOUR") },
      { label: "Tokens per month", values: limits("MONTHLY") },
      { label: "Concurrent builds", values: [false, false, false, "Up to 3"] },
    ],
  },
  {
    group: "Build quality",
    rows: [
      { label: "Coder + Reviewer dual-AI loop", values: [true, true, true, true] },
      { label: "Art-director design review", values: [true, true, true, true] },
      { label: "Your chosen model on Vibex keys", values: [false, true, true, true], note: "Free runs on community models" },
      { label: "Interrupt & steer mid-build", values: [true, true, true, true] },
      { label: "Auto-pause & resume on limits", values: [true, true, true, true] },
    ],
  },
  {
    group: "Ship",
    rows: [
      { label: "Live preview + in-app IDE", values: [true, true, true, true] },
      { label: "Download .zip + prompt history", values: [true, true, true, true] },
      { label: "GitHub export & one-click deploy", values: [true, true, true, true] },
    ],
  },
  {
    group: "Support",
    rows: [{ label: "Support", values: ["Community", "Email", "Priority", "Priority"] }],
  },
];
