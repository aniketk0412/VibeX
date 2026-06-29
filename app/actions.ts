"use server";

// Server actions used by client screens.

import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createProjectForUser, getUserPlan } from "@/lib/runs";
import { getProjectCount } from "@/lib/projects";
import { saveUserKey, deleteUserKey, getUserKey, type ProviderId } from "@/lib/keys";
import type { Spec, GenFile } from "@/lib/steps";
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

// Export a project's generated files to a brand-new public GitHub repo using the user's
// encrypted PAT (BYOK "github" provider). Returns the repo URL, or an error code the client maps
// to a toast. The token is never logged.
export type GitHubExportResult = { url?: string; repo?: string; error?: string; message?: string };

export async function exportToGitHub(projectId: string): Promise<GitHubExportResult> {
  const session = await auth();
  if (!session?.user) return { error: "unauthorized" };
  const uid = session.user.id;

  const pat = await getUserKey(uid, "github");
  if (!pat) return { error: "no_key" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: uid },
    include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } },
  });
  if (!project) return { error: "not_found" };
  const files = (project.runs[0]?.files as unknown as GenFile[] | null) ?? [];
  if (!files.length) return { error: "no_files" };

  const gh = (path: string, init?: RequestInit) =>
    fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Vibex",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

  // Identify the account.
  const meRes = await gh("/user");
  if (meRes.status === 401) return { error: "bad_token" };
  if (!meRes.ok) return { error: "failed", message: "GitHub authentication failed" };
  const login = (await meRes.json()).login as string;

  // Create the repo (retry on name-taken).
  const base =
    (project.title || "vibex-app")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "vibex-app";
  let name = base;
  let repoUrl = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await gh("/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name,
        description: "Generated by Vibex — from idea to code, automatically.",
        private: false,
        auto_init: false,
      }),
    });
    if (res.ok) {
      repoUrl = (await res.json()).html_url as string;
      break;
    }
    if (res.status === 422) {
      name = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      continue;
    }
    return { error: "failed", message: "Could not create the repository" };
  }
  if (!repoUrl) return { error: "name_taken" };

  // Push each file via the contents API (first PUT initializes the default branch).
  for (const f of files) {
    const apiPath = f.path.split("/").map(encodeURIComponent).join("/");
    const res = await gh(`/repos/${login}/${name}/contents/${apiPath}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Add ${f.path}`,
        content: Buffer.from(f.content, "utf8").toString("base64"),
      }),
    });
    if (!res.ok) return { url: repoUrl, repo: name, error: "push_failed", message: `Failed to add ${f.path}` };
  }

  return { url: repoUrl, repo: `${login}/${name}` };
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
