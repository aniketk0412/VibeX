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
    cta: { label: "Choose Starter", href: "/signin" },
    features: [
      "Everything in Free",
      "Higher rolling limits",
      "All Coder + Reviewer combos",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    tagline: "For builders shipping every week.",
    projects: "Unlimited projects",
    cta: { label: "Choose Pro", href: "/signin" },
    highlight: true,
    features: [
      "Everything in Starter",
      "Pro-tier rolling limits",
      "Priority execution",
      "Longer runs before reset",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    price: 79,
    tagline: "For heavy, back-to-back runs.",
    projects: "Unlimited projects",
    cta: { label: "Choose Scale", href: "/signin" },
    features: [
      "Everything in Pro",
      "Highest rolling limits",
      "Concurrent runs",
      "Priority support",
    ],
  },
];

export const BYOK = {
  name: "Bring your own key",
  price: 5,
  tagline: "Use your own provider keys — we just run the loop.",
  cta: { label: "Set up your own key", href: "/signin" },
  features: [
    "Your Anthropic / OpenAI / Google keys",
    "Provider rate limits apply",
    "Auto-retry on rate-limit errors",
    "Full usage visibility, always",
  ],
};
