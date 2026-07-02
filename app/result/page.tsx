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

  // ?run=<id> selects an older build (version history); default is the latest run.
  const runParam = typeof searchParams.run === "string" ? searchParams.run : undefined;

  const [project, projects] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      include: {
        runs: { orderBy: { startedAt: "desc" }, select: { id: true, status: true, startedAt: true } },
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

  const runMeta = runParam ? project.runs.find((r) => r.id === runParam) : project.runs[0];
  if (runParam && !runMeta) notFound(); // forged/stale run id
  // Still building → resume the live stream rather than show an empty result.
  if (runMeta?.status === "RUNNING") redirect(`/run?project=${project.id}`);

  const run = runMeta
    ? await prisma.run.findUnique({
        where: { id: runMeta.id },
        include: { prompts: { orderBy: [{ step: "asc" }, { createdAt: "asc" }] } },
      })
    : null;

  const spec = project.spec as Spec;
  const files = (run?.files as unknown as GenFile[] | null) ?? [];
  const history: HistoryRow[] = (run?.prompts ?? []).map((p) => ({
    step: p.content || (p.role === "CODER" ? "Wrote a file" : "Review"),
    role: p.role === "CODER" ? "Coder" : "Reviewer",
    tokens: p.tokens,
    cost: p.cost,
  }));

  // Version history: every non-live run, newest first (only meaningful with 2+ builds).
  const versions = project.runs
    .filter((r) => r.status !== "RUNNING")
    .map((r) => ({ id: r.id, startedAt: r.startedAt.getTime(), status: r.status }));

  return (
    <ResultView
      spec={{ idea: spec.idea, platform: spec.platform, coder: spec.coder, reviewer: spec.reviewer }}
      files={files}
      history={history}
      projects={projects.map((p) => ({ id: p.id, title: p.title, status: p.runs[0]?.status ?? null }))}
      current={{ id: project.id, title: project.title, status: run?.status ?? null }}
      user={{ name: session.user.name, email: session.user.email, image: session.user.image }}
      runs={versions}
      currentRunId={run?.id}
    />
  );
}
