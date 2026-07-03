// Create a project from the vibex CLI (bearer auth). Mirrors the web's startProject action:
// same free-plan 1-project cap, same title derivation — the CLI is another client, not a
// side door around plan limits.

import type { NextRequest } from "next/server";
import { resolveBearer } from "@/lib/cliTokens";
import { createProjectForUser, getUserPlan } from "@/lib/runs";
import { getProjectCount } from "@/lib/projects";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import type { Spec } from "@/lib/steps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await resolveBearer(req);
  if (!userId) return Response.json({ ok: false, error: "invalid_token" }, { status: 401 });

  const rl = await rateLimit(`cli-projects:u:${userId}`, 20, 5 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterMs);

  const body = (await req.json().catch(() => null)) as { spec?: Spec } | null;
  const idea = typeof body?.spec?.idea === "string" ? body.spec.idea.trim().slice(0, 500) : "";
  if (!idea) return Response.json({ ok: false, error: "missing_idea" }, { status: 400 });

  const spec: Spec = {
    idea,
    platform: typeof body?.spec?.platform === "string" ? body.spec.platform : "web",
    coder: typeof body?.spec?.coder === "string" ? body.spec.coder : undefined,
    reviewer: typeof body?.spec?.reviewer === "string" ? body.spec.reviewer : undefined,
  };

  const [plan, count] = await Promise.all([getUserPlan(userId), getProjectCount(userId)]);
  if (plan === "free" && count >= 1) {
    return Response.json(
      { ok: false, error: "free_limit", message: "Free plan includes 1 project — upgrade to create more." },
      { status: 403 },
    );
  }

  const project = await createProjectForUser(userId, spec as Record<string, unknown>);
  return Response.json({ ok: true, id: project.id, title: project.title });
}
