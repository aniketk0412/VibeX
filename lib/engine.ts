// Dual-AI execution engine. For each build step: the Coder model writes, then the Reviewer
// model checks — goal-driven, not a fixed prompt count. Token usage is tracked against rolling
// windows; hitting a limit auto-pauses with a reset countdown (progress is never lost — the
// run resumes from the next step). Emits a stream of events as an async generator.
//
// Runs for real when provider keys are set; otherwise it simulates so the product is fully
// demoable without credentials. The route streams these events to the /run screen.

import { resolveModel, costOf, type ModelSpec } from "@/lib/ai/models";
import { generate, hasKey, MissingKeyError, type GenResult } from "@/lib/ai/providers";
import {
  rolled,
  overLimit,
  limitFor,
  msUntilReset,
  type WindowState,
  type WindowKind,
  type Plan,
} from "@/lib/usage";
import { buildSteps, type Spec } from "@/lib/steps";

export type RunEvent =
  | { type: "planned"; steps: string[]; live: boolean }
  | { type: "step_start"; index: number; title: string }
  | { type: "coder"; index: number; preview: string; tokens: number; cost: number }
  | { type: "reviewer"; index: number; verdict: "pass" | "revise"; note: string; tokens: number; cost: number }
  | { type: "step_done"; index: number }
  | { type: "usage"; tokens: number; cost: number; window: { kind: WindowKind; remaining: number; resetInMs: number } }
  | { type: "paused"; reason: string; resetInMs: number }
  | { type: "complete"; tokens: number; cost: number; steps: number }
  | { type: "error"; message: string };

type Prompt = { system: string; user: string };

function coderPrompt(spec: Spec, step: string, doneSoFar: string[]): Prompt {
  return {
    system: `You are the Coder AI in Vibex, an autonomous app builder. Implement one step cleanly and idiomatically. Idea: ${spec.idea ?? "an app"}. Platform: ${spec.platform ?? "web"}. Stack: ${spec.stack ?? "recommended"}.`,
    user: `Already built: ${doneSoFar.join("; ") || "nothing yet"}.\nNow implement this step: "${step}". Return the code and a one-line summary.`,
  };
}

function reviewerPrompt(step: string, code: string): Prompt {
  return {
    system: "You are the Reviewer AI in Vibex. Review the Coder's work for correctness, security, and quality. Reply with a short verdict starting with PASS or REVISE.",
    user: `Step: "${step}".\nCoder output:\n${code.slice(0, 4000)}`,
  };
}

function firstLine(text: string): string {
  const line = (text.split("\n").find((l) => l.trim()) ?? "").trim();
  return line.length > 120 ? `${line.slice(0, 117)}…` : line || "(no output)";
}

// Deterministic-ish stand-in when a provider key is absent.
function simulate(p: Prompt, role: "coder" | "reviewer"): Promise<GenResult> {
  const text =
    role === "coder"
      ? `// ${firstLine(p.user)}\nexport function step() { /* generated */ }`
      : `PASS — looks correct and idiomatic.`;
  const inputTokens = 900 + Math.floor(p.user.length / 3);
  const outputTokens = role === "coder" ? 1600 : 700;
  return new Promise((res) => setTimeout(() => res({ text, inputTokens, outputTokens }), 650));
}

async function callModel(spec: ModelSpec, p: Prompt, role: "coder" | "reviewer", live: boolean): Promise<GenResult> {
  if (!live) return simulate(p, role);
  try {
    return await generate(spec.provider, spec.model, p.system, p.user, role === "coder" ? 1500 : 600);
  } catch (e) {
    if (e instanceof MissingKeyError) return simulate(p, role);
    throw e;
  }
}

export async function* runEngine(
  spec: Spec,
  opts: { plan?: Plan; startIndex?: number; signal?: AbortSignal } = {},
): AsyncGenerator<RunEvent> {
  const plan = opts.plan ?? "free";
  const steps = buildSteps(spec);
  const coder = resolveModel(spec.coder);
  const reviewer = resolveModel(spec.reviewer);
  const live = hasKey(coder.provider) && hasKey(reviewer.provider);

  yield { type: "planned", steps, live };

  let totalTokens = 0;
  let totalCost = 0;
  // Track the tightest window for auto-pause demonstration (5-hour).
  let win: WindowState = { kind: "FIVE_HOUR", used: 0, startedAt: Date.now() };

  const account = (used: number) => {
    win = rolled({ ...win, used: win.used + used }, Date.now());
    totalTokens += used;
  };

  for (let i = opts.startIndex ?? 0; i < steps.length; i++) {
    if (opts.signal?.aborted) return;
    yield { type: "step_start", index: i, title: steps[i] };

    // Coder pass
    const c = await callModel(coder, coderPrompt(spec, steps[i], steps.slice(0, i)), "coder", live);
    const cTok = c.inputTokens + c.outputTokens;
    const cCost = costOf(coder, c.inputTokens, c.outputTokens);
    totalCost += cCost;
    account(cTok);
    yield { type: "coder", index: i, preview: firstLine(c.text), tokens: cTok, cost: cCost };
    if (opts.signal?.aborted) return;

    // Reviewer pass
    const r = await callModel(reviewer, reviewerPrompt(steps[i], c.text), "reviewer", live);
    const rTok = r.inputTokens + r.outputTokens;
    const rCost = costOf(reviewer, r.inputTokens, r.outputTokens);
    totalCost += rCost;
    account(rTok);
    const verdict = /^revise|revis|change|issue|bug|fix/i.test(r.text.trim()) ? "revise" : "pass";
    yield { type: "reviewer", index: i, verdict, note: firstLine(r.text), tokens: rTok, cost: rCost };

    yield {
      type: "usage",
      tokens: totalTokens,
      cost: totalCost,
      window: {
        kind: win.kind,
        remaining: Math.max(0, limitFor(plan, win.kind) - win.used),
        resetInMs: msUntilReset(win, Date.now()),
      },
    };

    if (overLimit(win, plan)) {
      yield { type: "paused", reason: `${win.kind} token window reached`, resetInMs: msUntilReset(win, Date.now()) };
      return;
    }

    yield { type: "step_done", index: i };
  }

  yield { type: "complete", tokens: totalTokens, cost: totalCost, steps: steps.length };
}
