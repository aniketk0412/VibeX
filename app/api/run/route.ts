// Streams the dual-AI engine to the /run workspace as Server-Sent Events, and — when the caller
// owns a project (signed-in) — persists the run: a Run row, a Prompt per Coder/Reviewer step,
// rolling UsageWindow accounting, and a final status (COMPLETED / PAUSED / INTERRUPTED).

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBearer } from "@/lib/cliTokens";
import { runEngine } from "@/lib/engine";
import { createRun, recordPrompt, setRunStep, finishRun, saveRunOutput, interruptIfRunning, recordUsage, getUserPlan, getStartWindow, reapStaleRuns, countActiveRuns } from "@/lib/runs";
import { getUserKeys } from "@/lib/keys";
import { isSameOrigin } from "@/lib/http";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { resolveModel } from "@/lib/ai/models";
import { canAutoPolish, canUseReferenceImages, type Plan, type WindowState } from "@/lib/usage";
import type { UserKeys } from "@/lib/engine";
import type { Spec } from "@/lib/steps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A build streams through several model calls (each capped at 90s); give the function room so a
// slow provider doesn't truncate the stream into an INTERRUPTED run. Clamped to the plan limit.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Non-browser clients (vibex CLI) authenticate with a bearer token instead of the session
  // cookie. Bearer requests carry no ambient credentials, so the same-origin (CSRF) guard
  // only applies to the cookie path.
  const bearerUserId = await resolveBearer(req);
  if (!bearerUserId && !isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
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

  // Identity is required — a browser session or a CLI bearer token. Anonymous builds are gone:
  // signed-out visitors keep only the basic tabs, and unauthenticated model spend was the
  // biggest abuse surface this route had.
  const uid = bearerUserId ?? (await auth())?.user?.id ?? null;
  if (!uid) {
    return Response.json({ ok: false, reason: "auth", message: "Sign in to run builds." }, { status: 401 });
  }

  // If a project id is supplied, only persist when the caller owns it. `userId` set = persist.
  let userId: string | null = null;
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: uid } });
    if (project) {
      userId = uid;
      spec = project.spec as Spec;
    }
  }

  // Every caller is identified now — rate limit per user (fairer behind shared NATs).
  const rl = await rateLimit(`run:u:${uid}`, 30, 5 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterMs);

  // The caller's plan (limit enforcement), BYOK keys, and real usage window.
  const plan: Plan = await getUserPlan(uid);
  const userKeys: UserKeys = await getUserKeys(uid);
  const startWindow: WindowState | undefined = await getStartWindow(uid);

  // Concurrency gate. Two reasons: "concurrent runs" is a Scale-plan feature, and the engine's
  // window enforcement reads a per-run snapshot — parallel runs could each see headroom and
  // together blow past the plan ceiling. One active run below Scale (a small cap on Scale)
  // bounds that overspend. Reap first so a stranded RUNNING row never locks the user out.
  await reapStaleRuns(uid);
  const active = await countActiveRuns(uid);
  const maxConcurrent = plan === "scale" ? 3 : 1;
  if (active >= maxConcurrent) {
    return new Response(
      JSON.stringify({ ok: false, reason: "concurrent", message: plan === "scale" ? "Concurrent-run limit reached — wait for a build to finish." : "Another build is already running. Wait for it to finish (or upgrade to Scale for concurrent runs)." }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  }

  // Plan feature gates (belt to the UI's braces — a crafted client must hit the same wall).
  // Auto design-polish (restyle passes) and reference images are paid features.
  if (only?.length && !canAutoPolish(plan)) {
    return new Response(
      JSON.stringify({ ok: false, reason: "plan", message: "Automatic design polish is a Starter feature." }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }
  const allowedImages = canUseReferenceImages(plan) ? images : undefined;

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
        // anonymous:false — every caller is a signed-in user now; plan (not anonymity) decides
        // which keys the engine may use.
        for await (const ev of runEngine(spec, { startIndex, signal: req.signal, plan, userKeys, startWindow, steer, images: allowedImages, anonymous: false, only, baseFiles })) {
          send(ev);
          // Usage is billed to the CALLER even when the run isn't persisted (no owned project) —
          // server-key spend is never free just because the build was ephemeral.
          if (ev.type === "usage") {
            try {
              await recordUsage(uid, ev.tokens - prevTokens, ev.cost - prevCost);
              prevTokens = ev.tokens;
              prevCost = ev.cost;
            } catch {
              /* an accounting hiccup shouldn't kill the live stream */
            }
            continue;
          }
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
