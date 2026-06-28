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

// Typical token profile for one project, used for the pre-run estimate. Matches the
// engine's per-step Coder/Reviewer shape so the quote tracks what a real run will spend.
const PROFILE = { steps: 14, coderIn: 1200, coderOut: 1600, reviewerIn: 900, reviewerOut: 700 };

export function estimateProjectCost(coderLabel?: string, reviewerLabel?: string): {
  cost: number;
  tokens: number;
  known: boolean;
} {
  const coder = resolveModel(coderLabel);
  const reviewer = resolveModel(reviewerLabel);
  const cIn = PROFILE.steps * PROFILE.coderIn;
  const cOut = PROFILE.steps * PROFILE.coderOut;
  const rIn = PROFILE.steps * PROFILE.reviewerIn;
  const rOut = PROFILE.steps * PROFILE.reviewerOut;
  const cost = costOf(coder, cIn, cOut) + costOf(reviewer, rIn, rOut);
  const tokens = cIn + cOut + rIn + rOut;
  const known = !!coderLabel && coderLabel in MODELS && !!reviewerLabel && reviewerLabel in MODELS;
  return { cost, tokens, known };
}
