"use server";

// Server actions used by client screens.

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createProjectForUser, getUserPlan } from "@/lib/runs";
import { getProjectCount } from "@/lib/projects";
import { saveUserKey, deleteUserKey, type ProviderId } from "@/lib/keys";
import type { Spec } from "@/lib/steps";

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
