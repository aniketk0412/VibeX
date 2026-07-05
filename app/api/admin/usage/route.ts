// Operator spend view — you carry the COGS risk on server keys, so you need a quick answer to
// "what are we burning and on whom?" before scaling marketing. Secret-gated JSON (same pattern
// as seed-design): ADMIN_SECRET, falling back to SEED_SECRET so one secret can run both.
//
//   curl -H "x-admin-secret: $ADMIN_SECRET" https://<host>/api/admin/usage
//
// Totals come from Prompt rows (one per model call, timestamped); "top" is the current monthly
// usage window per user. Anonymous runs are not persisted and can only use the free OpenRouter
// route, so this view covers everything that can actually cost money.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeEqual } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function totalsSince(since: Date) {
  const agg = await prisma.prompt.aggregate({
    where: { createdAt: { gte: since } },
    _sum: { tokens: true, cost: true },
    _count: { _all: true },
  });
  return {
    calls: agg._count._all,
    tokens: agg._sum.tokens ?? 0,
    cost: Number((agg._sum.cost ?? 0).toFixed(4)),
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET || process.env.SEED_SECRET;
  const provided = req.headers.get("x-admin-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!secret || !provided || !safeEqual(provided, secret)) return new Response("Forbidden", { status: 403 });

  const now = Date.now();
  const [day, week, month, topWindows, users] = await Promise.all([
    totalsSince(new Date(now - 24 * 3600_000)),
    totalsSince(new Date(now - 7 * 24 * 3600_000)),
    totalsSince(new Date(now - 30 * 24 * 3600_000)),
    prisma.usageWindow.findMany({
      where: { kind: "MONTHLY", resetsAt: { gt: new Date(now) } },
      orderBy: { cost: "desc" },
      take: 20,
      include: { user: { select: { email: true, plan: true } } },
    }),
    prisma.user.count(),
  ]);

  return Response.json({
    ok: true,
    users,
    totals: { last24h: day, last7d: week, last30d: month },
    topSpendersThisWindow: topWindows.map((w) => ({
      email: w.user.email,
      plan: w.user.plan,
      tokens: w.tokens,
      cost: Number(w.cost.toFixed(4)),
      resetsAt: w.resetsAt,
    })),
  });
}
