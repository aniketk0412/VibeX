// Dashboard — the returning-user home. Project count drives routing:
//   not signed in → /signin · 0 projects → /new onboarding · ≥1 → this list.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { listProjects } from "@/lib/projects";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import styles from "./dashboard.module.css";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const projects = await listProjects(session.user.id);
  if (projects.length === 0) redirect("/new"); // first-timer onboarding

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" aria-label="Vibex home">
          <Logo size={28} />
        </Link>
        <div className={styles.right}>
          <ThemeToggle />
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

        <div className={styles.grid}>
          {projects.map((p) => (
            <Link key={p.id} href={`/result?project=${p.id}`} className={styles.proj}>
              <div className={styles.projTitle}>{p.title}</div>
              <div className={styles.projMeta}>Updated {p.updatedAt.toLocaleDateString()}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
