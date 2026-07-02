// Persistence for the execution loop: a Project per locked goal, a Run per build, a Prompt per
// Coder/Reviewer step, and rolling UsageWindow accounting. Server-only (uses prisma).

import { prisma } from "@/lib/prisma";
import { WINDOW_MS, type WindowKind, type Plan, type WindowState } from "@/lib/usage";
import type { GenFile } from "@/lib/steps";
import type { Prisma } from "@prisma/client";

export async function getUserPlan(userId: string): Promise<Plan> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  const p = u?.plan;
  return p === "starter" || p === "pro" || p === "scale" ? p : "free";
}

// The user's current 5-hour window (rolled if elapsed) — seeds the engine so limits are real.
export async function getStartWindow(userId: string): Promise<WindowState> {
  const w = await prisma.usageWindow.findUnique({ where: { userId_kind: { userId, kind: "FIVE_HOUR" } } });
  const now = Date.now();
  if (!w || now >= w.resetsAt.getTime()) return { kind: "FIVE_HOUR", used: 0, startedAt: now };
  return { kind: "FIVE_HOUR", used: w.tokens, startedAt: w.startedAt.getTime() };
}

export async function createProjectForUser(userId: string, spec: Record<string, unknown>) {
  const name = typeof spec.name === "string" ? spec.name.trim() : "";
  const idea = typeof spec.idea === "string" ? spec.idea.trim() : "";
  const title =
    name && name !== "Decide later" ? name.slice(0, 120) : idea ? idea.slice(0, 120) : "Untitled project";
  return prisma.project.create({
    data: { userId, title, spec: spec as Prisma.InputJsonValue },
  });
}

export async function createRun(projectId: string, totalSteps: number) {
  return prisma.run.create({ data: { projectId, totalSteps, status: "RUNNING" } });
}

export async function recordPrompt(
  runId: string,
  step: number,
  role: "CODER" | "REVIEWER",
  model: string,
  content: string,
  tokens: number,
  cost: number,
) {
  return prisma.prompt.create({
    data: { runId, step, role, model, content: content.slice(0, 4000), tokens, cost },
  });
}

// Bound what a run may persist as its generated output. `Run.files` is a Postgres Json column with
// no schema-level size limit, and `saveProjectFiles` accepts client-supplied content — without a
// cap a hostile (or runaway) caller could bloat rows on the shared Neon DB and slow every
// dashboard/result read. Limits are far above anything the engine legitimately produces.
const MAX_FILES = 24;
const MAX_FILE_CHARS = 200_000; // ~200 KB per file
const MAX_TOTAL_CHARS = 1_500_000; // ~1.5 MB per run

export function capFiles(files: GenFile[]): GenFile[] {
  const out: GenFile[] = [];
  let total = 0;
  for (const f of files.slice(0, MAX_FILES)) {
    if (typeof f?.path !== "string" || typeof f?.content !== "string") continue;
    const content = f.content.slice(0, MAX_FILE_CHARS);
    if (total + content.length > MAX_TOTAL_CHARS) break;
    total += content.length;
    out.push({ path: f.path.slice(0, 300), content });
  }
  return out;
}

export async function setRunStep(runId: string, step: number) {
  return prisma.run.update({ where: { id: runId }, data: { currentStep: step } });
}

export async function finishRun(runId: string, status: "COMPLETED" | "PAUSED" | "INTERRUPTED" | "FAILED") {
  return prisma.run.update({ where: { id: runId }, data: { status, endedAt: new Date() } });
}

// Complete a run and store its generated files (the real output).
export async function saveRunOutput(runId: string, files: GenFile[]) {
  return prisma.run.update({
    where: { id: runId },
    data: { status: "COMPLETED", endedAt: new Date(), files: capFiles(files) as unknown as Prisma.InputJsonValue },
  });
}

// Mark a still-RUNNING run as interrupted (e.g. the client aborted the stream).
export async function interruptIfRunning(runId: string) {
  await prisma.run.updateMany({
    where: { id: runId, status: "RUNNING" },
    data: { status: "INTERRUPTED", endedAt: new Date() },
  });
}

// Lazy reaper for orphaned RUNNING rows. On serverless the SSE handler's `finally` isn't
// guaranteed to run (the function can be killed mid-stream), so runs can be stranded as RUNNING
// forever — confusing on the dashboard and blocking the one-active-run gate. A real run streams a
// model call at least every ~90s (the provider timeout), so anything RUNNING for 15+ minutes is
// dead. Called lazily from the run route and the dashboard; errors are swallowed (best-effort).
const STALE_RUN_MS = 15 * 60_000;

export async function reapStaleRuns(userId: string) {
  try {
    await prisma.run.updateMany({
      where: {
        status: "RUNNING",
        startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) },
        project: { userId },
      },
      data: { status: "INTERRUPTED", endedAt: new Date() },
    });
  } catch {
    /* best-effort */
  }
}

// How many of the user's runs are currently live — drives the per-plan concurrency gate.
export function countActiveRuns(userId: string) {
  return prisma.run.count({ where: { status: "RUNNING", project: { userId } } });
}

const KINDS: WindowKind[] = ["FIVE_HOUR", "DAILY", "MONTHLY"];

// Add token/cost to each rolling window, resetting a window that has elapsed.
// The common case — incrementing a still-live window — is a single atomic UPDATE (guarded by
// resetsAt), so concurrent runs can't lose each other's writes the way a read-then-write would.
// Only when no live window matches (missing, or elapsed and needing a reset) do we fall back to an
// upsert; a lost increment in that rarer race is at most one run's worth, fine for a soft cap.
export async function recordUsage(userId: string, tokens: number, cost: number) {
  if (tokens <= 0 && cost <= 0) return;
  const now = new Date();
  for (const kind of KINDS) {
    const live = await prisma.usageWindow.updateMany({
      where: { userId, kind, resetsAt: { gt: now } },
      data: { tokens: { increment: tokens }, cost: { increment: cost } },
    });
    if (live.count > 0) continue;

    const fresh = { tokens, cost, startedAt: now, resetsAt: new Date(now.getTime() + WINDOW_MS[kind]) };
    await prisma.usageWindow.upsert({
      where: { userId_kind: { userId, kind } },
      create: { userId, kind, ...fresh },
      update: fresh,
    });
  }
}
