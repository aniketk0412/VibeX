// The "art director": looks at a SCREENSHOT of the generated app and judges how vibe-coded it
// looks, returning structural directions the Coder can act on. Mirrors describeImage's multi-
// provider fallback (Claude vision → GPT-4o vision → OpenRouter vision) but returns structured
// JSON. Never throws — returns null when no vision-capable key is available.

import Anthropic from "@anthropic-ai/sdk";
import { MODELS, costOf } from "./models";
import type { Spec } from "@/lib/steps";

export type CriticKeys = { anthropic?: string; openai?: string; openrouter?: string };

export type Critique = {
  verdict: "pass" | "revise";
  score: number; // 0-100 distinctiveness
  summary: string; // one line on what it saw
  directions: string; // concrete structural changes for the Coder ("" when pass)
  model: string; // which model judged
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

const ART_DIRECTOR = `You are a world-class product designer and art director reviewing a SCREENSHOT of a web app an AI just generated. Most AI-generated apps look generic and "vibe-coded": a centered single column, the default system font, a flat blue/grey palette, evenly spaced cards, and no real hierarchy, depth, or personality.

Judge how distinctive and intentional THIS design looks, then give the coding AI SPECIFIC, STRUCTURAL directions to make it look hand-crafted rather than templated. Focus on:
- Typography: a real display typeface for headings, a deliberate type scale, weight contrast.
- Spacing & rhythm: generous, consistent whitespace and clear vertical rhythm.
- Colour: a considered palette (warm neutrals, a genuine accent) — not default blue/grey.
- Layout: intentional composition and asymmetry where it helps — not just one centered column.
- Depth & detail: elevation, borders, texture, distinctive touches, micro-interactions.

Use the provided design references as the quality bar. Be concrete and prescriptive — name the change, not the vibe (e.g. "swap the system font for a strong serif display face on headings; move to an 8pt spacing rhythm; replace pure white with a warm off-white; add a left-aligned hero with an asymmetric two-column split").

Respond with ONLY a JSON object — no prose, no code fences:
{"verdict":"pass"|"revise","score":<0-100>,"summary":"<one line>","directions":"<specific structural changes for the coder; empty string if pass>"}
Only "pass" if it already looks genuinely distinctive (score >= 80).`;

function userText(spec: Spec, refs: string): string {
  const vibe = [spec.vibe, spec.accent].filter(Boolean).join(", ");
  return [
    `App: ${spec.idea ?? "an app"}.`,
    spec.platform ? `Category: ${spec.platform}.` : "",
    vibe ? `Requested look & feel: ${vibe}.` : "",
    refs ? `Design references (the quality bar to push toward):\n${refs}` : "",
    `Critique the attached screenshot and return ONLY the JSON object.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Pull the first {...} JSON object out of a model reply (tolerates fences / stray prose).
function parseCritique(text: string): Pick<Critique, "verdict" | "score" | "summary" | "directions"> | null {
  if (!text) return null;
  let s = text.trim().replace(/^```[a-zA-Z0-9]*\s*\n?/, "").replace(/\n?```\s*$/, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a === -1 || b === -1 || b <= a) return null;
  try {
    const o = JSON.parse(s.slice(a, b + 1));
    const verdict = o.verdict === "pass" ? "pass" : "revise";
    const score = Math.max(0, Math.min(100, Number(o.score) || 0));
    return {
      verdict,
      score,
      summary: typeof o.summary === "string" ? o.summary.trim() : "",
      directions: typeof o.directions === "string" ? o.directions.trim() : "",
    };
  } catch {
    return null;
  }
}

type RawVision = { text: string; inputTokens: number; outputTokens: number; model: string; spec?: keyof typeof MODELS } | null;

async function viaAnthropic(dataUrl: string, system: string, user: string, key: string): Promise<RawVision> {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!m) return null;
  const client = new Anthropic({ apiKey: key });
  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: m[1] as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: m[2] } },
          { type: "text", text: user },
        ],
      },
    ],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, model: "claude-sonnet-4-6", spec: "Claude Sonnet" };
}

async function viaOpenAILike(
  endpoint: string,
  model: string,
  dataUrl: string,
  system: string,
  user: string,
  key: string,
  extraHeaders: Record<string, string> = {},
): Promise<RawVision> {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, ...extraHeaders },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      messages: [
        { role: "system", content: system },
        { role: "user", content: [{ type: "text", text: user }, { type: "image_url", image_url: { url: dataUrl } }] },
      ],
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return {
    text: j?.choices?.[0]?.message?.content ?? "",
    inputTokens: j?.usage?.prompt_tokens ?? 0,
    outputTokens: j?.usage?.completion_tokens ?? 0,
    model,
  };
}

// Try the strongest available vision model first. Returns null when nothing is usable.
export async function critiqueDesign(screenshot: string, refs: string, spec: Spec, keys: CriticKeys): Promise<Critique | null> {
  const system = ART_DIRECTOR;
  const user = userText(spec, refs);

  const attempts: Array<() => Promise<RawVision>> = [];
  const aKey = keys.anthropic ?? process.env.ANTHROPIC_API_KEY;
  if (aKey) attempts.push(() => viaAnthropic(screenshot, system, user, aKey));
  const oKey = keys.openai ?? process.env.OPENAI_API_KEY;
  if (oKey) attempts.push(() => viaOpenAILike("https://api.openai.com/v1/chat/completions", "gpt-4o", screenshot, system, user, oKey));
  const orKey = keys.openrouter ?? process.env.OPENROUTER_API_KEY;
  if (orKey) {
    const model = process.env.OPENROUTER_VISION_MODEL ?? "nvidia/nemotron-nano-12b-v2-vl:free";
    attempts.push(() => viaOpenAILike("https://openrouter.ai/api/v1/chat/completions", model, screenshot, system, user, orKey, { "X-Title": "Vibex" }));
  }

  for (const attempt of attempts) {
    try {
      const raw = await attempt();
      if (!raw) continue;
      const parsed = parseCritique(raw.text);
      if (!parsed) continue;
      const ms = raw.spec ? MODELS[raw.spec] : raw.model === "gpt-4o" ? MODELS["GPT-4o"] : null;
      const cost = ms ? costOf(ms, raw.inputTokens, raw.outputTokens) : 0;
      return { ...parsed, model: raw.model, inputTokens: raw.inputTokens, outputTokens: raw.outputTokens, cost };
    } catch {
      /* try the next provider */
    }
  }
  return null;
}
