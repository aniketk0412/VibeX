// Server entry for /run — signed-in only. With ?project=<id>, loads the user's project spec
// from the DB and hands it (plus the id) to the client workspace, which streams + persists the
// build. Without a project, the workspace reads the spec from sessionStorage (interview flow).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasModelAccess } from "@/lib/keys";
import { getUserPlan } from "@/lib/runs";
import { isPaid } from "@/lib/usage";
import type { Spec } from "@/lib/steps";
import RunWorkspace from "./RunWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Building…", robots: { index: false } };

export default async function RunPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const projectId = typeof searchParams.project === "string" ? searchParams.project : undefined;
  const session = await auth();
  // Hard gate (middleware only checks cookie presence): builds are for signed-in users.
  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(projectId ? `/run?project=${projectId}` : "/run")}`);
  }
  let spec: Spec | undefined;
  let ownedId: string | undefined;

  if (projectId && session?.user) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });
    if (project) {
      spec = project.spec as Spec;
      ownedId = project.id;
    }
  }

  const hasKey = await hasModelAccess(session?.user?.id);
  const paidPlan = session?.user ? isPaid(await getUserPlan(session.user.id)) : false;

  return <RunWorkspace initialSpec={spec} projectId={ownedId} hasKey={hasKey} paidPlan={paidPlan} />;
}
