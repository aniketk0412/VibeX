// Settings — account profile, BYOK keys (encrypted), and plan. Server component with inline
// server actions. Identity + sign-out live here so the page is self-sufficient.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import BackLink from "@/components/BackLink";
import UserMenu from "@/components/UserMenu";
import SubmitButton from "@/components/SubmitButton";
import ConfirmDialog from "@/components/ConfirmDialog";
import { KEY_PROVIDERS, listKeyProviders, type ProviderId } from "@/lib/keys";
import { getUserPlan } from "@/lib/runs";
import { saveApiKey, removeApiKey, devSetPlan, signOutAction } from "@/app/actions";
import styles from "./settings.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings", robots: { index: false } };

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect(`/signin?callbackUrl=${encodeURIComponent("/settings")}`);
  const user = session.user;

  const [connected, plan] = await Promise.all([
    listKeyProviders(user.id),
    getUserPlan(user.id),
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
          <BackLink href="/dashboard" label="Dashboard" />
          <ThemeToggle />
          <UserMenu name={user.name} email={user.email} image={user.image} />
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>Settings</h1>

        <section className={`${styles.card} ${styles.profile}`}>
          <div className={styles.pAvatar}>
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className={styles.pImg} referrerPolicy="no-referrer" />
            ) : (
              <span className={styles.pInitials}>{initials(user.name, user.email)}</span>
            )}
          </div>
          <div className={styles.pInfo}>
            <span className={styles.pName}>{user.name || "Your account"}</span>
            {user.email && <span className={styles.pEmail}>{user.email}</span>}
          </div>
          <form action={signOutAction} className={styles.pActions}>
            <button type="submit" className={styles.signoutBtn}>Sign out</button>
          </form>
        </section>

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
                  <ConfirmDialog
                    triggerLabel="Remove"
                    triggerClassName={styles.removeBtn}
                    title="Remove this key?"
                    message={`Your ${p.label} key will be deleted. Builds will fall back to Vibex's provider until you add it again.`}
                    confirmLabel="Remove key"
                    confirmAction={removeApiKey.bind(null, p.id)}
                  />
                ) : (
                  <form
                    className={styles.keyForm}
                    action={async (fd: FormData) => {
                      "use server";
                      await saveApiKey(p.id, String(fd.get("key") ?? ""));
                    }}
                  >
                    <input className={styles.keyInput} type="password" name="key" placeholder={p.hint} autoComplete="off" />
                    <SubmitButton className={styles.saveBtn} pendingLabel="Saving…">Save</SubmitButton>
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
