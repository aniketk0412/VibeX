"use server";

// Server actions used by client screens.

import { auth } from "@/auth";
import { createProjectForUser } from "@/lib/runs";
import type { Spec } from "@/lib/steps";

// Persist the locked goal as a Project when the user is signed in.
// Returns { id: null } for anonymous users (they run an ephemeral, unsaved build).
export async function startProject(spec: Spec): Promise<{ id: string | null }> {
  const session = await auth();
  if (!session?.user) return { id: null };
  const project = await createProjectForUser(session.user.id, spec as Record<string, unknown>);
  return { id: project.id };
}
