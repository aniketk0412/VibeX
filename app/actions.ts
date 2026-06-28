"use server";

// Server actions used by client screens.

import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createProjectForUser, getUserPlan } from "@/lib/runs";
import { getProjectCount } from "@/lib/projects";
import { saveUserKey, deleteUserKey, type ProviderId } from "@/lib/keys";
import type { Spec } from "@/lib/steps";
import type { Prisma } from "@prisma/client";

// Persist the locked goal as a Project. Free plan is capped at 1 project ever.
// Returns { id: null } for anonymous users (ephemeral, unsaved run).
export async function startProject(spec: Spec): Promise<{ id: string | null; error?: "free_limit" }> {
  const session = await auth();
  if (!session?.user) return { id: null };
  const [plan, count] = await Promise.all([getUserPlan(session.user.id), getProjectCount(session.user.id)]);
  if (plan === "free" && count >= 1) return { id: null, error: "free_limit" };
  const project = await createProjectForUser(session.user.id, spec);
  return { id: project.id };
}

// Sign out from anywhere (header user menu, settings) → back to the marketing home.
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

// ── Project management (rename / delete / duplicate) ───────────────────────
// All scoped to the signed-in owner via the userId in the where-clause, so a forged id can't
// touch someone else's project.

export async function renameProject(projectId: string, title: string) {
  const session = await auth();
  if (!session?.user) return;
  const clean = title.trim().slice(0, 120);
  if (!clean) return;
  await prisma.project.updateMany({
    where: { id: projectId, userId: session.user.id },
    data: { title: clean },
  });
  revalidatePath("/dashboard");
  revalidatePath("/result");
}

export async function deleteProject(projectId: string) {
  const session = await auth();
  if (!session?.user) return;
  // Runs + prompts cascade (see schema onDelete: Cascade).
  await prisma.project.deleteMany({ where: { id: projectId, userId: session.user.id } });
  revalidatePath("/dashboard");
}

// Copy a project's locked goal — and, if it has built output, that output too — into a new
// project. Respects the free-plan 1-project cap. Returns the new id (or null if blocked).
export async function duplicateProject(projectId: string): Promise<{ id: string | null; error?: "free_limit" }> {
  const session = await auth();
  if (!session?.user) return { id: null };
  const uid = session.user.id;

  const [plan, count] = await Promise.all([getUserPlan(uid), getProjectCount(uid)]);
  if (plan === "free" && count >= 1) return { id: null, error: "free_limit" };

  const src = await prisma.project.findFirst({
    where: { id: projectId, userId: uid },
    include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } },
  });
  if (!src) return { id: null };

  const srcRun = src.runs[0];
  const created = await prisma.project.create({
    data: {
      userId: uid,
      title: `${src.title} (copy)`.slice(0, 120),
      spec: src.spec as Prisma.InputJsonValue,
      ...(srcRun?.files
        ? {
            runs: {
              create: {
                status: "COMPLETED",
                totalSteps: srcRun.totalSteps,
                currentStep: srcRun.currentStep,
                files: srcRun.files as Prisma.InputJsonValue,
                endedAt: new Date(),
              },
            },
          }
        : {}),
    },
  });
  revalidatePath("/dashboard");
  return { id: created.id };
}

export async function saveApiKey(provider: ProviderId, key: string) {
  const session = await auth();
  if (!session?.user || !key.trim()) return;
  await saveUserKey(session.user.id, provider, key);
  revalidatePath("/settings");
}

export async function removeApiKey(provider: ProviderId) {
  const session = await auth();
  if (!session?.user) return;
  await deleteUserKey(session.user.id, provider);
  revalidatePath("/settings");
}

// Dev-only plan switch (no billing) — gated by ALLOW_DEV_PLAN so it can't run in prod.
export async function devSetPlan(plan: string) {
  if (process.env.ALLOW_DEV_PLAN !== "true") return;
  const session = await auth();
  if (!session?.user) return;
  const p = ["free", "starter", "pro", "scale"].includes(plan) ? plan : "free";
  await prisma.user.update({ where: { id: session.user.id }, data: { plan: p } });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
