// Server entry for /run. With ?project=<id>, loads the signed-in user's project spec from the
// DB and hands it (plus the id) to the client workspace, which streams + persists the build.
// Without a project (anonymous), the workspace reads the spec from sessionStorage and runs
// ephemerally.

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Spec } from "@/lib/steps";
import RunWorkspace from "./RunWorkspace";

export const dynamic = "force-dynamic";

export default async function RunPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const projectId = typeof searchParams.project === "string" ? searchParams.project : undefined;
  let spec: Spec | undefined;
  let ownedId: string | undefined;

  if (projectId) {
    const session = await auth();
    if (session?.user) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: session.user.id },
      });
      if (project) {
        spec = project.spec as Spec;
        ownedId = project.id;
      }
    }
  }

  return <RunWorkspace initialSpec={spec} projectId={ownedId} />;
}
