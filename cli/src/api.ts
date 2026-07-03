// Thin client of the Vibex backend — the same endpoints the web app uses, authenticated with
// a bearer token instead of a session cookie.

import type { RunEvent, Spec } from "./types.js";

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

function headers(token: string): Record<string, string> {
  return { "content-type": "application/json", authorization: `Bearer ${token}` };
}

export async function apiMe(baseUrl: string, token: string) {
  const r = await fetch(new URL("/api/me", baseUrl), { headers: headers(token) });
  const j = (await r.json().catch(() => null)) as
    | { ok: boolean; error?: string; user?: { name: string | null; email: string | null }; plan?: string }
    | null;
  if (!r.ok || !j?.ok) {
    throw new ApiError(
      j?.error === "invalid_token" ? "Invalid or revoked token — mint a new one in Settings → CLI access." : `API error (${r.status})`,
      r.status,
    );
  }
  return { user: j.user!, plan: j.plan ?? "free" };
}

export async function createProject(baseUrl: string, token: string, spec: Spec) {
  const r = await fetch(new URL("/api/projects", baseUrl), {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ spec }),
  });
  const j = (await r.json().catch(() => null)) as
    | { ok: boolean; id?: string; title?: string; error?: string; message?: string }
    | null;
  if (!r.ok || !j?.ok || !j.id) {
    throw new ApiError(j?.message ?? (j?.error === "invalid_token" ? "Invalid token — run `vibex login`." : `Couldn't create the project (${r.status}).`), r.status);
  }
  return { id: j.id, title: j.title ?? "" };
}

// Stream a build for an owned project. Yields the server's SSE events as they arrive.
export async function* streamRun(baseUrl: string, token: string, projectId: string, opts?: { steer?: string; startIndex?: number }): AsyncGenerator<RunEvent> {
  const r = await fetch(new URL("/api/run", baseUrl), {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ spec: {}, projectId, steer: opts?.steer, startIndex: opts?.startIndex ?? 0 }),
  });
  if (r.status === 409 || r.status === 429) {
    const j = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(j?.message ?? (r.status === 429 ? "Rate limit reached — wait a moment, then retry." : "Another build is already running."), r.status);
  }
  if (!r.ok || !r.body) throw new ApiError(`API error (${r.status}).`, r.status);

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = block.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        yield JSON.parse(line.slice(5).trim()) as RunEvent;
      } catch {
        /* skip malformed frame */
      }
    }
  }
}
