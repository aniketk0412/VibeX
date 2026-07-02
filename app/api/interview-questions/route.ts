// Generates a few idea-specific interview questions (the "deep-dive") so the spec the Coder
// builds from is tailored, not generic. Plain language, no jargon — a non-developer must follow
// every word. Reuses the engine's key-resolution order; degrades to { ok:false } so the static
// interview still works when no key / bad output.

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getUserKeys } from "@/lib/keys";
import { generate, generateOpenRouter, envKey, type GenResult } from "@/lib/ai/providers";
import { isSameOrigin } from "@/lib/http";
import { rateLimit, rateSubject, tooMany } from "@/lib/ratelimit";
import type { Provider } from "@/lib/ai/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenQuestion = { id: string; phase: string; prompt: string; hint?: string; allowCustom: boolean; options: { label: string; desc: string }[] };

const SYSTEM = `You are a sharp product interviewer talking to a NON-TECHNICAL founder about their app idea. Ask the few questions that uncover what makes THIS idea's core actually work: the main thing people do with it, the key pieces of information involved, the important rules or edge cases, and what a great version looks like.

Rules:
- Plain, everyday language. NO technical jargon — a non-developer must understand every word. No "schema", "auth", "API", "entities", etc.
- Specific to THIS idea, not generic. Each question must only make sense for this kind of app.
- Give each question 3-4 concrete, mutually-exclusive options written in plain language, each with a short description.
- 2 to 4 questions total. Quality over quantity.

Respond with ONLY a JSON array, no prose or code fences:
[{"prompt":"...","hint":"one short line","options":[{"label":"...","desc":"..."}]}]`;

function userMsg(idea: string, platform: string, audience: string): string {
  return [
    `Idea: ${idea}`,
    platform ? `Where it runs: ${platform}` : "",
    audience ? `Who it's for: ${audience}` : "",
    `Write the JSON array of 2-4 plain-language questions now.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Pull the first [...] array out of a model reply (tolerates fences / stray prose).
function parseQuestions(text: string): GenQuestion[] {
  if (!text) return [];
  const s = text.trim().replace(/^```[a-zA-Z0-9]*\s*\n?/, "").replace(/\n?```\s*$/, "");
  const a = s.indexOf("[");
  const b = s.lastIndexOf("]");
  if (a === -1 || b === -1 || b <= a) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(s.slice(a, b + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const out: GenQuestion[] = [];
  for (const item of raw.slice(0, 4)) {
    const q = item as { prompt?: unknown; hint?: unknown; options?: unknown };
    if (typeof q.prompt !== "string" || !q.prompt.trim() || !Array.isArray(q.options)) continue;
    const seen = new Set<string>();
    const options = q.options
      .map((o) => o as { label?: unknown; desc?: unknown })
      .filter((o) => typeof o.label === "string" && o.label.trim())
      .map((o) => ({ label: (o.label as string).trim(), desc: typeof o.desc === "string" ? o.desc.trim() : "" }))
      .filter((o) => (seen.has(o.label) ? false : (seen.add(o.label), true))) // unique labels (QuestionCard keys on label)
      .slice(0, 5);
    if (options.length < 2) continue;
    out.push({
      id: `dd${out.length + 1}`,
      phase: "Scope",
      prompt: q.prompt.trim(),
      hint: typeof q.hint === "string" && q.hint.trim() ? q.hint.trim() : undefined,
      allowCustom: true,
      options,
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const rl = await rateLimit(`iq:${rateSubject(req)}`, 40, 5 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterMs);
  const body = await req.json().catch(() => ({}));
  const idea: string = typeof body?.idea === "string" ? body.idea.slice(0, 600) : "";
  const platform: string = typeof body?.platform === "string" ? body.platform.slice(0, 80) : "";
  const audience: string = typeof body?.audience === "string" ? body.audience.slice(0, 80) : "";
  if (!idea.trim()) return Response.json({ ok: false, reason: "no-idea" });

  // BYOK (if signed in) then env. Anonymous callers may use the free OpenRouter route but never our
  // paid server env keys — this endpoint is reachable pre-signup, so that would be uncapped spend.
  let keys: Awaited<ReturnType<typeof getUserKeys>> = {};
  let allowServerKeys = false;
  try {
    const session = await auth();
    if (session?.user) {
      keys = await getUserKeys(session.user.id);
      allowServerKeys = true;
    }
  } catch {
    /* anonymous — free route only */
  }

  // Precedence: 1) the user's own provider key (honour their spend), 2) the free OpenRouter route,
  // 3) — signed-in only — a server env key.
  let call: ((system: string, user: string, maxTokens: number) => Promise<GenResult>) | null = null;
  const modelFor = (p: Provider) => (p === "anthropic" ? "claude-sonnet-4-6" : p === "openai" ? "gpt-4o" : "gemini-1.5-flash");
  const ownProvider: Provider | null = keys.anthropic ? "anthropic" : keys.openai ? "openai" : keys.google ? "google" : null;
  const orKey = keys.openrouter ?? process.env.OPENROUTER_API_KEY;
  if (ownProvider) {
    const key = keys[ownProvider]!;
    call = (s, u, m) => generate(ownProvider, modelFor(ownProvider), s, u, m, key);
  } else if (orKey) {
    call = (s, u, m) => generateOpenRouter(s, u, m, orKey);
  } else if (allowServerKeys) {
    const provider: Provider | null =
      process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.OPENAI_API_KEY ? "openai" : process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "google" : null;
    if (provider) call = (s, u, m) => generate(provider, modelFor(provider), s, u, m, envKey(provider));
  }
  if (!call) return Response.json({ ok: false, reason: "no-key" });

  // Free models are non-deterministic about JSON — retry a couple times on a parse miss before
  // giving up (a real Anthropic/OpenAI key follows the format on the first try).
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await call(SYSTEM, userMsg(idea, platform, audience), 900);
      const questions = parseQuestions(r.text);
      if (questions.length) return Response.json({ ok: true, questions });
    }
    return Response.json({ ok: false, reason: "parse" });
  } catch {
    return Response.json({ ok: false, reason: "error" });
  }
}
