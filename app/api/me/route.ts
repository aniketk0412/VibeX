// Who am I — bearer-token identity check for the vibex CLI (`vibex login` / `vibex whoami`).
// Token auth only: browsers have their own session; this route exists for non-browser clients.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBearer } from "@/lib/cliTokens";
import { getUserPlan } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await resolveBearer(req);
  if (!userId) {
    return Response.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }
  const [user, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    getUserPlan(userId),
  ]);
  if (!user) return Response.json({ ok: false, error: "invalid_token" }, { status: 401 });
  return Response.json({ ok: true, user: { name: user.name, email: user.email }, plan });
}
