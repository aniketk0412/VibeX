// Sign in — Google OAuth + email magic link. Server actions call Auth.js directly.
// Handles ?error= (failed sign-in) and ?verify=email (magic-link sent) states, shows pending
// states on submit, and offers "keep me signed in". Already signed in → straight to dashboard.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import BackLink from "@/components/BackLink";
import SubmitButton from "@/components/SubmitButton";
import RememberMe from "@/components/RememberMe";
import styles from "./signin.module.css";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z" />
    </svg>
  );
}

// Only allow internal, non-protocol-relative paths as a post-login destination (no open redirect).
function safeCallback(raw?: string | string[]): string {
  const v = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/dashboard";
  return v;
}

function errorMessage(code: string): string {
  switch (code) {
    case "OAuthAccountNotLinked":
      return "That email is already linked to a different sign-in method. Use the method you signed up with.";
    case "Verification":
      return "That sign-in link is invalid or has expired. Request a new one below.";
    case "Configuration":
      return "Sign-in isn’t available right now. Please try again later.";
    case "AccessDenied":
      return "Access was denied. Please try a different account.";
    default:
      return "Something went wrong signing you in. Please try again.";
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const callbackUrl = safeCallback(searchParams.callbackUrl);

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const verifySent = searchParams.verify === "email";

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.left}>
          <BackLink href="/" label="Home" />
          <Link href="/" aria-label="Vibex home">
            <Logo size={28} />
          </Link>
        </div>
        <ThemeToggle />
      </header>

      <main className={styles.main}>
        {verifySent ? (
          <div className={styles.card}>
            <div className={styles.verifyIcon} aria-hidden>✉</div>
            <h1 className={styles.title}>Check your inbox</h1>
            <p className={styles.sub}>
              We sent a magic link to your email. Click it to finish signing in — you can close this tab.
            </p>
            <Link href="/signin" className="btn btn-ghost btn-lg" style={{ width: "100%", marginTop: 22, textAlign: "center" }}>
              ← Use a different method
            </Link>
          </div>
        ) : (
          <div className={styles.card}>
            <h1 className={styles.title}>Sign in to Vibex</h1>
            <p className={styles.sub}>From idea to code, automatically.</p>

            {error && (
              <div className={styles.errBanner} role="alert">
                {errorMessage(error)}
              </div>
            )}

            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: callbackUrl });
              }}
            >
              <SubmitButton className={styles.google} pendingLabel="Connecting…">
                <GoogleIcon /> Continue with Google
              </SubmitButton>
            </form>

            <div className={styles.divider}><span>or</span></div>

            <form
              className={styles.emailForm}
              action={async (formData) => {
                "use server";
                await signIn("resend", {
                  email: String(formData.get("email")),
                  redirectTo: callbackUrl,
                });
              }}
            >
              <input
                className={styles.input}
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                aria-label="Email address"
              />
              <SubmitButton className="btn btn-primary btn-lg" pendingLabel="Sending link…">
                Email me a link →
              </SubmitButton>
            </form>

            <RememberMe />

            <p className={styles.fine}>We&apos;ll email you a magic link — no password needed.</p>
          </div>
        )}
      </main>
    </div>
  );
}
