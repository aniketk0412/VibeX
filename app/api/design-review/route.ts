// Design-critic endpoint. Takes a screenshot of the just-generated app, retrieves design
// references (RAG), and asks the vision "art director" how vibe-coded it looks + what to change.
// Returns a structured verdict the /run client uses to drive an automatic restyle pass.
// Auth/ownership + BYOK + usage accounting mirror /api/run; degrades gracefully with no vision key.

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserKeys } from "@/lib/keys";
import { isSameOrigin } from "@/lib/http";
import { getUserPlan, getStartWindow, recordUsage } from "@/lib/runs";
import { overLimit } from "@/lib/usage";
import { embed } from "@/lib/ai/embeddings";
import { critiqueDesign } from "@/lib/ai/critic";
import { retrieveDesignRefs, categoryForSpec, formatRefs, DESIGN_RUBRIC } from "@/lib/rag";
import type { Spec } from "@/lib/steps";
import type { Plan, WindowState } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
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
    const session = await auth();
    if (session?.user) {
      const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
      if (project) {
        userId = session.user.id;
        spec = project.spec as Spec;
        plan = await getUserPlan(userId);
        userKeys = await getUserKeys(userId);
        win = await getStartWindow(userId);
      }
    }
  }

  if (userId && win && overLimit(win, plan)) {
    return Response.json({ ok: false, reason: "limit" });
  }

  // RAG: embed the project context, retrieve top references (falls back to category match).
  const category = categoryForSpec(spec.platform);
  const queryText = [spec.idea, spec.platform, spec.vibe, spec.accent].filter(Boolean).join(" ");
  const queryVec = await embed(queryText, { openai: userKeys.openai });
  const refs = await retrieveDesignRefs(queryVec, category, 4);
  const refBlock = [DESIGN_RUBRIC, refs.length ? formatRefs(refs) : ""].filter(Boolean).join("\n\n");

  // The art-director vision call. Null → no vision-capable key; the client skips the loop.
  const critique = await critiqueDesign(screenshot, refBlock, spec, {
    anthropic: userKeys.anthropic,
    openai: userKeys.openai,
    openrouter: userKeys.openrouter,
  });
  if (!critique) return Response.json({ ok: false, reason: "no-vision-key" });

  if (userId) {
    await recordUsage(userId, critique.inputTokens + critique.outputTokens, critique.cost).catch(() => {});
  }

  return Response.json({
    ok: true,
    verdict: critique.verdict,
    score: critique.score,
    summary: critique.summary,
    directions: critique.directions,
    model: critique.model,
    refs: refs.map((r) => r.title),
  });
}
