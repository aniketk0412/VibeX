// Server entry for /result. With ?project=<id>, loads the signed-in user's project + its latest
// run's real generated files and prompt history. Otherwise falls back to the client view's
// sessionStorage spec + sample output.

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Spec, GenFile } from "@/lib/steps";
import ResultView, { type HistoryRow } from "./ResultView";

export const dynamic = "force-dynamic";

export default async function ResultPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const projectId = typeof searchParams.project === "string" ? searchParams.project : undefined;
  if (!projectId) return <ResultView />;

  const session = await auth();
  if (!session?.user) return <ResultView />;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
        include: { prompts: { orderBy: [{ step: "asc" }, { createdAt: "asc" }] } },
      },
    },
  });
  if (!project) return <ResultView />;

  const spec = project.spec as Spec;
  const run = project.runs[0];
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
    />
  );
}
