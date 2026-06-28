// Persistence for the execution loop: a Project per locked goal, a Run per build, a Prompt per
// Coder/Reviewer step, and rolling UsageWindow accounting. Server-only (uses prisma).

import { prisma } from "@/lib/prisma";
import { WINDOW_MS, type WindowKind } from "@/lib/usage";
import type { Prisma } from "@prisma/client";

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

export async function setRunStep(runId: string, step: number) {
  return prisma.run.update({ where: { id: runId }, data: { currentStep: step } });
}

export async function finishRun(runId: string, status: "COMPLETED" | "PAUSED" | "INTERRUPTED" | "FAILED") {
  return prisma.run.update({ where: { id: runId }, data: { status, endedAt: new Date() } });
}

// Mark a still-RUNNING run as interrupted (e.g. the client aborted the stream).
export async function interruptIfRunning(runId: string) {
  await prisma.run.updateMany({
    where: { id: runId, status: "RUNNING" },
    data: { status: "INTERRUPTED", endedAt: new Date() },
  });
}

const KINDS: WindowKind[] = ["FIVE_HOUR", "DAILY", "MONTHLY"];

// Add token/cost to each rolling window, resetting a window that has elapsed.
export async function recordUsage(userId: string, tokens: number, cost: number) {
  if (tokens <= 0 && cost <= 0) return;
  const now = Date.now();
  for (const kind of KINDS) {
    const existing = await prisma.usageWindow.findUnique({ where: { userId_kind: { userId, kind } } });
    if (!existing || now >= existing.resetsAt.getTime()) {
      const fresh = {
        tokens,
        cost,
        startedAt: new Date(now),
        resetsAt: new Date(now + WINDOW_MS[kind]),
      };
      await prisma.usageWindow.upsert({
        where: { userId_kind: { userId, kind } },
        create: { userId, kind, ...fresh },
        update: fresh,
      });
    } else {
      await prisma.usageWindow.update({
        where: { userId_kind: { userId, kind } },
        data: { tokens: { increment: tokens }, cost: { increment: cost } },
      });
    }
  }
}
