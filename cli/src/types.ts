// Mirrors the server's public event/data shapes (app/api/run SSE + lib/steps types).
// Kept hand-synced — the CLI is a thin client and only reads these fields.

export type Spec = {
  idea?: string;
  platform?: string;
  coder?: string;
  reviewer?: string;
};

export type GenFile = { path: string; content: string };

export type RunEvent =
  | { type: "planned"; steps: string[]; live: boolean }
  | { type: "step_start"; index: number; title: string }
  | { type: "coder"; index: number; path: string; preview: string; tokens: number; cost: number; stub?: boolean }
  | { type: "reviewer"; index: number; verdict: "pass" | "revise"; note: string; tokens: number; cost: number }
  | { type: "step_done"; index: number }
  | { type: "usage"; tokens: number; cost: number; window: { kind: string; remaining: number; resetInMs: number } }
  | { type: "paused"; reason: string; resetInMs: number }
  | { type: "complete"; tokens: number; cost: number; steps: number; files: GenFile[] }
  | { type: "error"; message: string };

export type CliConfig = {
  baseUrl: string;
  token: string;
};
