// Server entry for /result. With ?project=<id>, loads the signed-in user's project + its latest
// run's prompts and renders the real prompt history. Otherwise falls back to the client view's
// sessionStorage spec + sample history.

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildSteps, type Spec } from "@/lib/steps";
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
  const steps = buildSteps(spec);
  const history: HistoryRow[] = (project.runs[0]?.prompts ?? []).map((p) => ({
    step: steps[p.step] ?? `Step ${p.step + 1}`,
    role: p.role === "CODER" ? "Coder" : "Reviewer",
    tokens: p.tokens,
    cost: p.cost,
  }));

  return (
    <ResultView
      spec={{ idea: spec.idea, platform: spec.platform, coder: spec.coder, reviewer: spec.reviewer }}
      history={history}
    />
  );
}
