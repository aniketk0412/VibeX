// Dashboard — the returning-user home. Greets the user, shows their plan, real 5-hour usage,
// and each project with its latest run status. Project count drives routing (0 → /new).

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlan, reapStaleRuns } from "@/lib/runs";
import { TOKEN_LIMITS, formatDuration } from "@/lib/usage";
import { greeting, firstName } from "@/lib/format";
import { hasModelAccess } from "@/lib/keys";
import AppHeader from "@/components/AppHeader";
import ProjectGrid from "@/components/ProjectGrid";
import KeyNotice from "@/components/KeyNotice";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect(`/signin?callbackUrl=${encodeURIComponent("/dashboard")}`);
  const user = session.user;
  const uid = user.id;

  // Heal orphaned RUNNING rows first so project status badges reflect reality.
  await reapStaleRuns(uid);

  const [plan, projects, win, hasKey] = await Promise.all([
    getUserPlan(uid),
    prisma.project.findMany({
      where: { userId: uid },
      orderBy: { updatedAt: "desc" },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 1, select: { status: true } } },
    }),
    prisma.usageWindow.findUnique({ where: { userId_kind: { userId: uid, kind: "FIVE_HOUR" } } }),
    hasModelAccess(uid),
  ]);
  if (projects.length === 0) redirect("/new");

  const used = win && Date.now() < win.resetsAt.getTime() ? win.tokens : 0;
  const limit = TOKEN_LIMITS[plan].FIVE_HOUR;
  const usagePct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className={styles.page}>
      <AppHeader
        back={{ href: "/", label: "Home" }}
        user={user}
        maxWidth={980}
        actions={<Link href="/new" className="btn btn-primary btn-sm">New project →</Link>}
      />

      <main className={styles.main}>
        {!hasKey && (
          <div className={styles.notice}>
            <KeyNotice message="No AI model is connected — builds will run as simulated placeholders. Connect a key to generate real, reviewed apps." />
          </div>
        )}

        <div className={styles.greeting}>
          <h1 className={styles.hello}>{greeting()}, {firstName(user.name, user.email)}</h1>
          <p className={styles.subtitle}>
            {projects.length === 1 ? "You have 1 project." : `You have ${projects.length} projects.`} Pick up where you left off, or start something new.
          </p>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.sl}>Plan</span>
            <span className={styles.sv} style={{ textTransform: "capitalize" }}>{plan}</span>
            <span className={styles.ss}>{(limit / 1000).toFixed(0)}k tokens per 5h window</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.sl}>Usage · this 5h</span>
            <span className={styles.sv}>{(used / 1000).toFixed(1)}k / {(limit / 1000).toFixed(0)}k tokens</span>
            <div className={styles.bar} role="progressbar" aria-valuenow={usagePct} aria-valuemin={0} aria-valuemax={100} aria-label="5-hour usage">
              <div className={styles.barFill} data-high={usagePct >= 90} style={{ width: `${usagePct}%` }} />
            </div>
            {usagePct >= 90 && win && (
              <span className={styles.usageHint}>Near your limit — resets in {formatDuration(win.resetsAt.getTime() - Date.now())}.</span>
            )}
          </div>
          <div className={styles.stat}>
            <span className={styles.sl}>Projects</span>
            <span className={styles.sv}>{projects.length}</span>
            <span className={styles.ss}>
              {projects.filter((p) => p.runs[0]?.status === "COMPLETED").length} with a completed build
            </span>
          </div>
        </div>

        <div className={styles.head}>
          <h2 className={styles.sectionTitle}>Your projects</h2>
          <span className={styles.count}>{projects.length}</span>
        </div>

        <ProjectGrid
          projects={projects.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.runs[0]?.status ?? null,
            updatedAt: p.updatedAt.getTime(),
          }))}
        />
      </main>
    </div>
  );
}
