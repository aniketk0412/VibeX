// Server entry for /result. With ?project=<id>, loads the signed-in user's project + its latest
// run's real generated files and prompt history, plus the user's other projects for the workspace
// sidebar. A still-building run is handed back to /run; a missing/unauthorized id 404s. Without a
// project (anonymous), the client view falls back to its sessionStorage spec + sample output.

import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Spec, GenFile } from "@/lib/steps";
import ResultView, { type HistoryRow } from "./ResultView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your project", robots: { index: false } };

export default async function ResultPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const projectId = typeof searchParams.project === "string" ? searchParams.project : undefined;
  if (!projectId) return <ResultView />;

  const session = await auth();
  if (!session?.user) redirect(`/signin?callbackUrl=${encodeURIComponent(`/result?project=${projectId}`)}`);

  const [project, projects] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      include: {
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
          include: { prompts: { orderBy: [{ step: "asc" }, { createdAt: "asc" }] } },
        },
      },
    }),
    prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 1, select: { status: true } } },
    }),
  ]);

  // Unknown or not-yours → 404 instead of silently showing a sample app.
  if (!project) notFound();

  const run = project.runs[0];
  // Still building → resume the live stream rather than show an empty result.
  if (run?.status === "RUNNING") redirect(`/run?project=${project.id}`);

  const spec = project.spec as Spec;
  const files = (run?.files as unknown as GenFile[] | null) ?? [];
  const history: HistoryRow[] = (run?.prompts ?? []).map((p) => ({
    step: p.content || (p.role === "CODER" ? "Wrote a file" : "Review"),
    role: p.role === "CODER" ? "Coder" : "Reviewer",
    tokens: p.tokens,
    cost: p.cost,
  }));

  return (
    <ResultView
      spec={{ idea: spec.idea, platform: spec.platform, coder: spec.coder, reviewer: spec.reviewer }}
      files={files}
      history={history}
      projects={projects.map((p) => ({ id: p.id, title: p.title, status: p.runs[0]?.status ?? null }))}
      current={{ id: project.id, title: project.title, status: run?.status ?? null }}
      user={{ name: session.user.name, email: session.user.email, image: session.user.image }}
    />
  );
}
