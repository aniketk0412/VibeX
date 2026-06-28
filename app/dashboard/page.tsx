// Dashboard — the returning-user home. Project count drives routing (0 → /new). Shows the
// user's plan, real 5-hour usage, and each project's latest run status.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlan } from "@/lib/runs";
import { TOKEN_LIMITS } from "@/lib/usage";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const uid = session.user.id;

  const [plan, projects, win] = await Promise.all([
    getUserPlan(uid),
    prisma.project.findMany({
      where: { userId: uid },
      orderBy: { updatedAt: "desc" },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 1, select: { status: true } } },
    }),
    prisma.usageWindow.findUnique({ where: { userId_kind: { userId: uid, kind: "FIVE_HOUR" } } }),
  ]);
  if (projects.length === 0) redirect("/new");

  const used = win && Date.now() < win.resetsAt.getTime() ? win.tokens : 0;
  const limit = TOKEN_LIMITS[plan].FIVE_HOUR;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" aria-label="Vibex home">
          <Logo size={28} />
        </Link>
        <div className={styles.right}>
          <ThemeToggle />
          <Link href="/settings" className="btn btn-ghost">Settings</Link>
          <Link href="/new" className="btn btn-primary">New project →</Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit" className="btn btn-ghost">Sign out</button>
          </form>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.head}>
          <h1 className={styles.title}>Your projects</h1>
          <span className={styles.count}>{projects.length}</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.sl}>Plan</span>
            <span className={styles.sv} style={{ textTransform: "capitalize" }}>{plan}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.sl}>Usage · this 5h</span>
            <span className={styles.sv}>{(used / 1000).toFixed(1)}k / {(limit / 1000).toFixed(0)}k tokens</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.sl}>Projects</span>
            <span className={styles.sv}>{projects.length}</span>
          </div>
        </div>

        <div className={styles.grid}>
          {projects.map((p) => {
            const status = p.runs[0]?.status;
            return (
              <Link key={p.id} href={`/result?project=${p.id}`} className={styles.proj}>
                <div className={styles.projTop}>
                  <div className={styles.projTitle}>{p.title}</div>
                  {status && <span className={styles.badge} data-s={status}>{status.toLowerCase()}</span>}
                </div>
                <div className={styles.projMeta}>Updated {p.updatedAt.toLocaleDateString()}</div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
