// Settings — BYOK keys (encrypted) and plan. Server component with inline server actions.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { KEY_PROVIDERS, listKeyProviders, type ProviderId } from "@/lib/keys";
import { getUserPlan } from "@/lib/runs";
import { saveApiKey, removeApiKey, devSetPlan } from "@/app/actions";
import styles from "./settings.module.css";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const [connected, plan] = await Promise.all([
    listKeyProviders(session.user.id),
    getUserPlan(session.user.id),
  ]);
  const has = (p: ProviderId) => connected.includes(p);
  const devPlans = process.env.ALLOW_DEV_PLAN === "true";

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" aria-label="Vibex home">
          <Logo size={28} />
        </Link>
        <div className={styles.right}>
          <ThemeToggle />
          <Link href="/dashboard" className="btn btn-ghost">Dashboard</Link>
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>Settings</h1>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>Your API keys</h2>
            <p>Bring your own provider keys. Stored encrypted, used for your builds instead of Vibex&apos;s — so usage is billed to you.</p>
          </div>
          <div className={styles.keys}>
            {KEY_PROVIDERS.map((p) => (
              <div key={p.id} className={styles.keyRow}>
                <div className={styles.keyInfo}>
                  <span className={styles.keyLabel}>{p.label}</span>
                  <span className={styles.keyState} data-on={has(p.id)}>{has(p.id) ? "Connected" : "Not set"}</span>
                </div>
                {has(p.id) ? (
                  <form
                    action={async () => {
                      "use server";
                      await removeApiKey(p.id);
                    }}
                  >
                    <button type="submit" className={styles.removeBtn}>Remove</button>
                  </form>
                ) : (
                  <form
                    className={styles.keyForm}
                    action={async (fd: FormData) => {
                      "use server";
                      await saveApiKey(p.id, String(fd.get("key") ?? ""));
                    }}
                  >
                    <input className={styles.keyInput} type="password" name="key" placeholder={p.hint} autoComplete="off" />
                    <button type="submit" className={styles.saveBtn}>Save</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>Plan</h2>
            <p>You&apos;re on the <b>{plan}</b> plan. <Link href="/pricing">See plans →</Link></p>
          </div>
          {devPlans && (
            <div className={styles.devPlans}>
              <span className={styles.devLabel}>Dev · switch plan</span>
              {(["free", "starter", "pro", "scale"] as const).map((pl) => (
                <form
                  key={pl}
                  action={async () => {
                    "use server";
                    await devSetPlan(pl);
                  }}
                >
                  <button type="submit" className={styles.planBtn} data-active={plan === pl}>{pl}</button>
                </form>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
