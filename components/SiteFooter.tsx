import Link from "next/link";
import Logo from "./Logo";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      {/* The close: one confident invitation. Replaces the templated "Ready to…?" CTA banner —
          a designer lets the footer carry the close instead of bolting on a beg. */}
      <div className={`wrap ${styles.close}`}>
        <p className={styles.closeKicker}>One free project · no card</p>
        <Link href="/new" className={styles.closeLine}>
          Build something<span aria-hidden>→</span>
        </Link>
      </div>

      <div className={`wrap ${styles.inner}`}>
        <div className={styles.brand}>
          <Logo size={26} />
          <p className={styles.tagline}>From idea to code, automatically.</p>
        </div>

        <nav className={styles.cols} aria-label="Footer">
          <div className={styles.col}>
            <span className={styles.colHead}>Product</span>
            <a href="/#how">How it works</a>
            <Link href="/pricing">Pricing</Link>
            <a href="/#faq">FAQ</a>
          </div>
          <div className={styles.col}>
            <span className={styles.colHead}>Start</span>
            <Link href="/new">Build something</Link>
            <Link href="/signin">Sign in</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
          <div className={styles.col}>
            <span className={styles.colHead}>Account</span>
            <Link href="/settings">Settings</Link>
            <Link href="/pricing">Plans</Link>
          </div>
        </nav>
      </div>

      <div className={`wrap ${styles.bottom}`}>
        <span>© {year} Vibex — vibe + execute</span>
        <span className={styles.made}>Coder AI + Reviewer AI, until it&apos;s done.</span>
      </div>
    </footer>
  );
}
