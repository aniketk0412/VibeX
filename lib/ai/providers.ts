// One generate() entry point across providers. Claude goes through the official Anthropic
// SDK (adaptive thinking, latest models); OpenAI and Google via their REST endpoints.
// Keys are read from env at call time — missing key → MissingKeyError (the engine then
// falls back to simulation so the product is demoable without credentials).

import Anthropic from "@anthropic-ai/sdk";
import type { Provider } from "./models";

export class MissingKeyError extends Error {
  constructor(public provider: Provider) {
    super(`No API key configured for ${provider}`);
    this.name = "MissingKeyError";
  }
}

export type GenResult = { text: string; inputTokens: number; outputTokens: number };

export function hasKey(provider: Provider): boolean {
  if (provider === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
  if (provider === "openai") return !!process.env.OPENAI_API_KEY;
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

export async function generate(
  provider: Provider,
  model: string,
  system: string,
  prompt: string,
  maxTokens = 1024,
): Promise<GenResult> {
  if (provider === "anthropic") return viaAnthropic(model, system, prompt, maxTokens);
  if (provider === "openai") return viaOpenAI(model, system, prompt, maxTokens);
  return viaGoogle(model, system, prompt, maxTokens);
}

async function viaAnthropic(model: string, system: string, prompt: string, maxTokens: number): Promise<GenResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingKeyError("anthropic");
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
}

async function viaOpenAI(model: string, system: string, prompt: string, maxTokens: number): Promise<GenResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new MissingKeyError("openai");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const j = await r.json();
  return {
    text: j.choices?.[0]?.message?.content ?? "",
    inputTokens: j.usage?.prompt_tokens ?? 0,
    outputTokens: j.usage?.completion_tokens ?? 0,
  };
}

// ── OpenRouter (OpenAI-compatible aggregator; free models available) ──────────
// When OPENROUTER_API_KEY is set, the engine routes everything here for a $0 demo.
const OPENROUTER_DEFAULT_MODEL = "openai/gpt-oss-20b:free";

export function openRouterActive(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

// Free models are heavily rate-limited, so retry on 429 (respecting Retry-After, capped)
// before giving up — the engine then falls back to simulation so the run never breaks.
export async function generateOpenRouter(system: string, prompt: string, maxTokens: number): Promise<GenResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
  const model = process.env.OPENROUTER_MODEL ?? OPENROUTER_DEFAULT_MODEL;

  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "X-Title": "Vibex",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://vibex.app",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (r.status === 429) {
      const retryAfter = Number(r.headers.get("retry-after")) || 2;
      await new Promise((res) => setTimeout(res, Math.min(retryAfter, 6) * 1000));
      continue;
    }
    if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
    const j = await r.json();
    return {
      text: j.choices?.[0]?.message?.content ?? "",
      inputTokens: j.usage?.prompt_tokens ?? 0,
      outputTokens: j.usage?.completion_tokens ?? 0,
    };
  }
  throw new Error("OpenRouter rate-limited");
}

async function viaGoogle(model: string, system: string, prompt: string, maxTokens: number): Promise<GenResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new MissingKeyError("google");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (!r.ok) throw new Error(`Google ${r.status}`);
  const j = await r.json();
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  return {
    text,
    inputTokens: j.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: j.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
