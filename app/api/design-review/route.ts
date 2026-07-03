// Design-critic endpoint. Takes a screenshot of the just-generated app, retrieves design
// references (RAG), and asks the vision "art director" how vibe-coded it looks + what to change.
// Returns a structured verdict the /run client uses to drive an automatic restyle pass.
// Auth/ownership + BYOK + usage accounting mirror /api/run; degrades gracefully with no vision key.

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserKeys } from "@/lib/keys";
import { isSameOrigin } from "@/lib/http";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { getUserPlan, getStartWindow, recordUsage } from "@/lib/runs";
import { overLimit, canAutoPolish } from "@/lib/usage";
import { embed } from "@/lib/ai/embeddings";
import { critiqueDesign } from "@/lib/ai/critic";
import { retrieveDesignRefs, categoryForSpec, formatRefs, DESIGN_RUBRIC } from "@/lib/rag";
import type { Spec } from "@/lib/steps";
import type { Plan, WindowState } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The vision call is capped at 90s; give the function headroom. Clamped to the plan limit.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
  // Signed-in only — this endpoint spends model tokens and the app surface is auth-gated now.
  const session = await auth();
  if (!session?.user) return Response.json({ ok: false, reason: "auth" }, { status: 401 });
  const rl = await rateLimit(`review:u:${session.user.id}`, 60, 5 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterMs);
  const body = await req.json().catch(() => ({}));
  const screenshot: string | undefined =
    typeof body?.screenshot === "string" && body.screenshot.startsWith("data:image") ? body.screenshot : undefined;
  if (!screenshot) return Response.json({ ok: false, reason: "no-screenshot" }, { status: 400 });

  let spec: Spec = body?.spec ?? {};
  const projectId: string | undefined = body?.projectId;

  // Owned run → BYOK keys, plan, and real usage window (and authoritative spec).
  let userId: string | null = null;
  let plan: Plan = "free";
  let userKeys: Awaited<ReturnType<typeof getUserKeys>> = {};
  let win: WindowState | undefined;
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
    if (project) {
      userId = session.user.id;
      spec = project.spec as Spec;
      plan = await getUserPlan(userId);
      userKeys = await getUserKeys(userId);
      win = await getStartWindow(userId);
    }
  }

  // The vision call prefers the user's own key when present (see critiqueDesign) — a critique on
  // their own spend isn't gated by plan windows, matching the engine's BYOK enforcement rule.
  const ownVision = !!(userKeys.anthropic || userKeys.openai || userKeys.openrouter);
  if (userId && win && !ownVision && overLimit(win, plan)) {
    return Response.json({ ok: false, reason: "limit" });
  }

  // RAG: embed the project context, retrieve top references (falls back to category match).
  const category = categoryForSpec(spec.platform);
  const queryText = [spec.idea, spec.platform, spec.vibe, spec.accent].filter(Boolean).join(" ");
  const queryVec = await embed(queryText, { openai: userKeys.openai }, !!userId);
  const refs = await retrieveDesignRefs(queryVec, category, 4);
  const refBlock = [DESIGN_RUBRIC, refs.length ? formatRefs(refs) : ""].filter(Boolean).join("\n\n");

  // The art-director vision call. Null → no vision-capable key; the client skips the loop.
  // Anonymous callers (no owned project) may only use the free OpenRouter vision route.
  const critique = await critiqueDesign(
    screenshot,
    refBlock,
    spec,
    { anthropic: userKeys.anthropic, openai: userKeys.openai, openrouter: userKeys.openrouter },
    !!userId,
  );
  if (!critique) return Response.json({ ok: false, reason: "no-vision-key" });

  if (userId) {
    await recordUsage(userId, critique.inputTokens + critique.outputTokens, critique.cost).catch(() => {});
  }

  // Free tier gets the critique (score + summary — the honest teaser) but not the directions
  // that drive the automatic restyle: auto design-polish is what Starter buys. `gated` tells
  // the client to show the upgrade nudge instead of silently shipping.
  const polish = userId ? canAutoPolish(plan) : false;
  const gated = !polish && critique.verdict === "revise";

  return Response.json({
    ok: true,
    verdict: critique.verdict,
    score: critique.score,
    summary: critique.summary,
    directions: gated ? "" : critique.directions,
    gated,
    model: critique.model,
    refs: refs.map((r) => r.title),
  });
}
