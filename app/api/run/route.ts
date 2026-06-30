// Streams the dual-AI engine to the /run workspace as Server-Sent Events, and — when the caller
// owns a project (signed-in) — persists the run: a Run row, a Prompt per Coder/Reviewer step,
// rolling UsageWindow accounting, and a final status (COMPLETED / PAUSED / INTERRUPTED).

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runEngine } from "@/lib/engine";
import { createRun, recordPrompt, setRunStep, finishRun, saveRunOutput, interruptIfRunning, recordUsage, getUserPlan, getStartWindow } from "@/lib/runs";
import { getUserKeys } from "@/lib/keys";
import { isSameOrigin } from "@/lib/http";
import { rateLimit, rateSubject, tooMany } from "@/lib/ratelimit";
import { resolveModel } from "@/lib/ai/models";
import type { Plan, WindowState } from "@/lib/usage";
import type { UserKeys } from "@/lib/engine";
import type { Spec } from "@/lib/steps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const rl = await rateLimit(`run:${rateSubject(req)}`, 30, 5 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterMs);
  const body = await req.json().catch(() => ({}));
  let spec: Spec = body?.spec ?? {};
  const startIndex = typeof body?.startIndex === "number" ? body.startIndex : 0;
  const projectId: string | undefined = body?.projectId;
  const steer: string | undefined = typeof body?.steer === "string" && body.steer.trim() ? body.steer : undefined;
  const images: string[] | undefined = Array.isArray(body?.images)
    ? body.images.filter((x: unknown): x is string => typeof x === "string" && x.startsWith("data:image")).slice(0, 2)
    : undefined;
  // Design-critic refine pass: regenerate only these files, seeded from the current build.
  const only: string[] | undefined = Array.isArray(body?.only)
    ? body.only.filter((x: unknown): x is string => typeof x === "string").slice(0, 8)
    : undefined;
  const baseFiles: { path: string; content: string }[] | undefined = Array.isArray(body?.baseFiles)
    ? body.baseFiles
        .filter((x: unknown): x is { path: string; content: string } =>
          !!x && typeof (x as { path?: unknown }).path === "string" && typeof (x as { content?: unknown }).content === "string",
        )
        .slice(0, 24)
    : undefined;

  // If a project id is supplied, only persist when the signed-in user owns it.
  let userId: string | null = null;
  if (projectId) {
    const session = await auth();
    if (session?.user) {
      const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
      if (project) {
        userId = session.user.id;
        spec = project.spec as Spec;
      }
    }
  }

  // For an owned run: the user's plan (limit enforcement), BYOK keys, and real usage window.
  let plan: Plan = "free";
  let userKeys: UserKeys = {};
  let startWindow: WindowState | undefined;
  if (userId) {
    plan = await getUserPlan(userId);
    userKeys = await getUserKeys(userId);
    startWindow = await getStartWindow(userId);
  }

  const coderModel = resolveModel(spec.coder).model;
  const reviewerModel = resolveModel(spec.reviewer).model;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      let runId: string | null = null;
      let prevTokens = 0;
      let prevCost = 0;

      try {
        for await (const ev of runEngine(spec, { startIndex, signal: req.signal, plan, userKeys, startWindow, steer, images, only, baseFiles })) {
          send(ev);
          if (!userId) continue;
          try {
            switch (ev.type) {
              case "planned":
                runId = (await createRun(projectId!, ev.steps.length)).id;
                break;
              case "coder":
                if (runId) await recordPrompt(runId, ev.index, "CODER", coderModel, ev.path, ev.tokens, ev.cost);
                break;
              case "reviewer":
                if (runId) await recordPrompt(runId, ev.index, "REVIEWER", reviewerModel, ev.note, ev.tokens, ev.cost);
                break;
              case "step_done":
                if (runId) await setRunStep(runId, ev.index + 1);
                break;
              case "usage":
                await recordUsage(userId, ev.tokens - prevTokens, ev.cost - prevCost);
                prevTokens = ev.tokens;
                prevCost = ev.cost;
                break;
              case "paused":
                if (runId) await finishRun(runId, "PAUSED");
                break;
              case "complete":
                if (runId) await saveRunOutput(runId, ev.files);
                break;
              default:
                break;
            }
          } catch {
            /* a persistence hiccup shouldn't kill the live stream */
          }
        }
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "engine error" });
      } finally {
        // If the stream ended without a terminal status (e.g. client interrupted), mark it.
        if (userId && runId) await interruptIfRunning(runId).catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
