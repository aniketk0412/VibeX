// Maps the interview's model labels to real provider model IDs and per-MTok pricing.
// Latest Claude models per the Anthropic model catalog (Opus 4.8 / Sonnet 4.6).

export type Provider = "anthropic" | "openai" | "google";

export type ModelSpec = {
  provider: Provider;
  model: string;
  inPerM: number; // $ per 1M input tokens
  outPerM: number; // $ per 1M output tokens
};

export const MODELS: Record<string, ModelSpec> = {
  "Claude Opus": { provider: "anthropic", model: "claude-opus-4-8", inPerM: 5, outPerM: 25 },
  "Claude Sonnet": { provider: "anthropic", model: "claude-sonnet-4-6", inPerM: 3, outPerM: 15 },
  "GPT-4o": { provider: "openai", model: "gpt-4o", inPerM: 2.5, outPerM: 10 },
  "Gemini Flash": { provider: "google", model: "gemini-1.5-flash", inPerM: 0.075, outPerM: 0.3 },
  "Gemini Pro": { provider: "google", model: "gemini-1.5-pro", inPerM: 1.25, outPerM: 5 },
};

// Falls back to Sonnet (the recommended coder) for unknown/custom labels.
export function resolveModel(label?: string): ModelSpec {
  return (label && MODELS[label]) || MODELS["Claude Sonnet"];
}

export function costOf(spec: ModelSpec, inTok: number, outTok: number): number {
  return (inTok / 1e6) * spec.inPerM + (outTok / 1e6) * spec.outPerM;
}

// Typical token profile for one project, used for the pre-run estimate. Mirrors what the engine
// ACTUALLY does (lib/engine.ts): ~4 coder calls (one per planned file, ≤3000 out each), 1 short
// reviewer pass, plus a design-critic allowance of up to 2 restyle calls with file context. The
// previous profile assumed 14 coder+reviewer step pairs and quoted users ~3× the real spend.
const PROFILE = {
  coderCalls: 4,
  coderIn: 1000,
  coderOut: 1900,
  reviewerIn: 800,
  reviewerOut: 150,
  restyleCalls: 2, // design-critic refine passes (styles.css + index.html)
  restyleIn: 2400, // includes the other files as context
  restyleOut: 2300,
};

export function estimateProjectCost(coderLabel?: string, reviewerLabel?: string): {
  cost: number;
  tokens: number;
  known: boolean;
} {
  const coder = resolveModel(coderLabel);
  const reviewer = resolveModel(reviewerLabel);
  const cIn = PROFILE.coderCalls * PROFILE.coderIn + PROFILE.restyleCalls * PROFILE.restyleIn;
  const cOut = PROFILE.coderCalls * PROFILE.coderOut + PROFILE.restyleCalls * PROFILE.restyleOut;
  const cost = costOf(coder, cIn, cOut) + costOf(reviewer, PROFILE.reviewerIn, PROFILE.reviewerOut);
  const tokens = cIn + cOut + PROFILE.reviewerIn + PROFILE.reviewerOut;
  const known = !!coderLabel && coderLabel in MODELS && !!reviewerLabel && reviewerLabel in MODELS;
  return { cost, tokens, known };
}
