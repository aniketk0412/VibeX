// Postgres-backed fixed-window rate limiter (no external infra). One row per (route + subject);
// the counter resets when its window elapses. `increment` is atomic; the reset branch can race
// by a hair under a burst, which is acceptable for an abuse guard. Fails OPEN — a DB hiccup must
// never block a legitimate build.

import { prisma } from "@/lib/prisma";

export type RateResult = { ok: boolean; retryAfterMs: number };

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  const now = Date.now();
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key } });
    if (!row || row.resetsAt.getTime() <= now) {
      const resetsAt = new Date(now + windowMs);
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetsAt },
        update: { count: 1, resetsAt },
      });
      return { ok: true, retryAfterMs: 0 };
    }
    if (row.count >= limit) {
      return { ok: false, retryAfterMs: row.resetsAt.getTime() - now };
    }
    await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return { ok: true, retryAfterMs: 0 };
  } catch {
    return { ok: true, retryAfterMs: 0 }; // fail open
  }
}

// Subject for limiting: the signed-in user if known, else the client IP (Vercel forwards it).
export function rateSubject(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

// A 429 Response with a Retry-After header.
export function tooMany(retryAfterMs: number): Response {
  const sec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new Response(JSON.stringify({ ok: false, reason: "rate_limited", retryAfterMs }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": String(sec) },
  });
}
