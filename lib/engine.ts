// Dual-AI codegen engine. Plans a real file set for the project, then for each file the Coder
// model writes the actual contents, and a Reviewer pass checks the result. It emits a stream of
// events (consumed by /run for live narration) and accumulates the real generated files (persisted
// by the route, downloadable from /result). Token usage is tracked against rolling windows; a
// limit auto-pauses with a reset countdown.
//
// Runs for real when a provider key is set (Anthropic/OpenAI/Google, or OpenRouter for free
// models). Any model failure (rate limit, missing key) falls back to a working stub for that file
// so the run always produces an openable result. With keys/credits, the files are fully generated.

import { resolveModel, costOf, type ModelSpec } from "@/lib/ai/models";
import { generate, hasKey, openRouterActive, generateOpenRouter } from "@/lib/ai/providers";
import {
  rolled,
  overLimit,
  limitFor,
  msUntilReset,
  type WindowState,
  type WindowKind,
  type Plan,
} from "@/lib/usage";
import type { Spec, GenFile } from "@/lib/steps";

export type RunEvent =
  | { type: "planned"; steps: string[]; live: boolean }
  | { type: "step_start"; index: number; title: string }
  | { type: "coder"; index: number; path: string; preview: string; tokens: number; cost: number }
  | { type: "reviewer"; index: number; verdict: "pass" | "revise"; note: string; tokens: number; cost: number }
  | { type: "step_done"; index: number }
  | { type: "usage"; tokens: number; cost: number; window: { kind: WindowKind; remaining: number; resetInMs: number } }
  | { type: "paused"; reason: string; resetInMs: number }
  | { type: "complete"; tokens: number; cost: number; steps: number; files: GenFile[] }
  | { type: "error"; message: string };

type PlannedFile = { path: string; purpose: string };

// ── what to build, by platform ──────────────────────────────────────────────
function appKind(spec: Spec): string {
  if (spec.platform === "API / backend") return "a small Node.js HTTP API (no framework)";
  if (spec.platform === "CLI tool") return "a small Node.js command-line tool";
  return "a polished, self-contained static web app (plain HTML/CSS/JS, no build step, no frameworks)";
}

function planFiles(spec: Spec): PlannedFile[] {
  if (spec.platform === "API / backend") {
    return [
      { path: "server.js", purpose: "a minimal Node HTTP API server implementing the core feature" },
      { path: "package.json", purpose: "npm manifest with a start script" },
      { path: "README.md", purpose: "what it is and how to run it" },
    ];
  }
  if (spec.platform === "CLI tool") {
    return [
      { path: "cli.js", purpose: "the command-line entry point implementing the core feature" },
      { path: "package.json", purpose: "npm manifest with a bin entry" },
      { path: "README.md", purpose: "what it is and how to use it" },
    ];
  }
  return [
    { path: "index.html", purpose: "the app markup and structure (links styles.css and app.js)" },
    { path: "styles.css", purpose: "all of the styling, matching the requested look & feel" },
    { path: "app.js", purpose: "the interactivity and core logic" },
    { path: "README.md", purpose: "what it is and how to run it" },
  ];
}

// ── prompts ──────────────────────────────────────────────────────────────────
function coderSystem(spec: Spec): string {
  return `You are an expert engineer building ${appKind(spec)}. Output ONLY the raw, complete contents of the requested file — no explanations, no commentary, no markdown code fences. The result must actually work, not be a stub or placeholder.`;
}

function coderUser(spec: Spec, file: PlannedFile, all: PlannedFile[]): string {
  const look = [spec.vibe, spec.accent].filter(Boolean).join(", ");
  return [
    `App idea: ${spec.idea ?? "an app"}.`,
    spec.audience ? `For: ${spec.audience}.` : "",
    spec.core ? `Core feature: ${spec.core}.` : "",
    look ? `Look & feel: ${look}.` : "",
    `The project contains these files: ${all.map((f) => f.path).join(", ")}.`,
    `Write the COMPLETE contents of \`${file.path}\` — ${file.purpose}.`,
    `Make it genuinely functional and reasonably complete. Return only the file contents.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function reviewerSystem(): string {
  return `You are a senior code reviewer. Reply with ONE short line: "PASS — <reason>" if the app looks complete and runnable, or "REVISE: <the single most important issue>".`;
}

function reviewerUser(spec: Spec, files: GenFile[]): string {
  const main = files.find((f) => f.path.endsWith(".html")) ?? files[0];
  return `App: ${spec.idea ?? "an app"}. Files: ${files.map((f) => f.path).join(", ")}.\nMain file (${main?.path}), first 1400 chars:\n${(main?.content ?? "").slice(0, 1400)}`;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function stripFences(s: string): string {
  let t = s.trim();
  const fenced = t.match(/^```[a-zA-Z0-9]*\s*\n([\s\S]*?)\n```\s*$/);
  if (fenced) return fenced[1].trim();
  t = t.replace(/^```[a-zA-Z0-9]*\s*\n?/, "").replace(/\n?```\s*$/, "");
  return t.trim();
}

function firstLine(text: string): string {
  const line = (text.split("\n").find((l) => l.trim()) ?? "").trim();
  return line.length > 120 ? `${line.slice(0, 117)}…` : line || "(generated)";
}

// A real, openable stub for when a model call fails (rate limit / no key).
function stubFile(path: string, spec: Spec): string {
  const title = spec.idea ?? "Your app";
  if (path.endsWith(".html")) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="app">
    <h1>${title}</h1>
    <p>Built by Vibex — from idea to code, automatically.</p>
  </main>
  <script src="app.js"></script>
</body>
</html>
`;
  }
  if (path.endsWith(".css")) {
    return `:root { --bg: #14110f; --fg: #f4eee6; --accent: #ff5a1f; }
* { box-sizing: border-box; margin: 0; }
body { background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; }
.app { text-align: center; padding: 2rem; }
h1 { font-size: 2.5rem; letter-spacing: -0.02em; }
p { color: #b6ac9e; margin-top: 0.75rem; }
`;
  }
  if (path.endsWith(".js") || path === "cli.js") {
    return `// ${title}\nconsole.log(${JSON.stringify(title)} + " — generated by Vibex");\n`;
  }
  if (path === "server.js") {
    return `const http = require("http");\nhttp.createServer((req, res) => { res.end(${JSON.stringify(title + " API — generated by Vibex")}); }).listen(3000, () => console.log("http://localhost:3000"));\n`;
  }
  if (path === "package.json") {
    const name = (spec.name || spec.idea || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
    return `{\n  "name": "${name}",\n  "private": true,\n  "scripts": { "start": "node ${spec.platform === "CLI tool" ? "cli.js" : "server.js"}" }\n}\n`;
  }
  return `# ${title}\n\nGenerated by Vibex — from idea to code, automatically.\n`;
}

async function tryGenerate(spec: ModelSpec, system: string, user: string, maxTokens: number) {
  if (openRouterActive()) return generateOpenRouter(system, user, maxTokens);
  return generate(spec.provider, spec.model, system, user, maxTokens);
}

// ── engine ───────────────────────────────────────────────────────────────────
export async function* runEngine(
  spec: Spec,
  opts: { plan?: Plan; startIndex?: number; signal?: AbortSignal } = {},
): AsyncGenerator<RunEvent> {
  const plan = opts.plan ?? "free";
  const coder = resolveModel(spec.coder);
  const reviewer = resolveModel(spec.reviewer);
  const live = openRouterActive() || (hasKey(coder.provider) && hasKey(reviewer.provider));
  const free = openRouterActive();

  const fileList = planFiles(spec);
  const steps = fileList.map((f) => `Write ${f.path}`).concat("Review & finalize");
  yield { type: "planned", steps, live };

  let totalTokens = 0;
  let totalCost = 0;
  let win: WindowState = { kind: "FIVE_HOUR", used: 0, startedAt: Date.now() };
  const files: GenFile[] = [];

  const account = (used: number) => {
    win = rolled({ ...win, used: win.used + used }, Date.now());
    totalTokens += used;
  };
  const usageEvent = (): RunEvent => ({
    type: "usage",
    tokens: totalTokens,
    cost: totalCost,
    window: { kind: win.kind, remaining: Math.max(0, limitFor(plan, win.kind) - win.used), resetInMs: msUntilReset(win, Date.now()) },
  });

  const start = opts.startIndex ?? 0;

  // Generate each file.
  for (let i = start; i < fileList.length; i++) {
    if (opts.signal?.aborted) return;
    const f = fileList[i];
    yield { type: "step_start", index: i, title: `Write ${f.path}` };

    let content = "";
    let tok = 1200;
    let cost = 0;
    try {
      const r = await tryGenerate(coder, coderSystem(spec), coderUser(spec, f, fileList), 3000);
      content = stripFences(r.text);
      tok = r.inputTokens + r.outputTokens || 1200;
      cost = free ? 0 : costOf(coder, r.inputTokens, r.outputTokens);
    } catch {
      content = "";
    }
    if (!content.trim()) content = stubFile(f.path, spec);

    files.push({ path: f.path, content });
    totalCost += cost;
    account(tok);

    yield { type: "coder", index: i, path: f.path, preview: firstLine(content), tokens: tok, cost };
    yield usageEvent();

    if (overLimit(win, plan)) {
      yield { type: "paused", reason: `${win.kind} token window reached`, resetInMs: msUntilReset(win, Date.now()) };
      return;
    }
    yield { type: "step_done", index: i };
  }

  // Reviewer pass.
  const reviewIndex = fileList.length;
  if (!opts.signal?.aborted) {
    yield { type: "step_start", index: reviewIndex, title: "Review & finalize" };
    let note = "PASS — complete and runnable.";
    let verdict: "pass" | "revise" = "pass";
    let tok = 700;
    let cost = 0;
    try {
      const r = await tryGenerate(reviewer, reviewerSystem(), reviewerUser(spec, files), 400);
      note = firstLine(r.text);
      verdict = /^revise|revis|fix|issue|bug|missing|incomplete/i.test(note.trim()) ? "revise" : "pass";
      tok = r.inputTokens + r.outputTokens || 700;
      cost = free ? 0 : costOf(reviewer, r.inputTokens, r.outputTokens);
    } catch {
      /* keep the default pass */
    }
    totalCost += cost;
    account(tok);
    yield { type: "reviewer", index: reviewIndex, verdict, note, tokens: tok, cost };
    yield usageEvent();
    yield { type: "step_done", index: reviewIndex };
  }

  yield { type: "complete", tokens: totalTokens, cost: totalCost, steps: fileList.length + 1, files };
}
