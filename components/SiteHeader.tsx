import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import styles from "./SiteHeader.module.css";

export default function SiteHeader() {
  return (
    <header className={styles.nav}>
      <div className={`wrap ${styles.inner}`}>
        <Link href="/" aria-label="Vibex home">
          <Logo size={30} />
        </Link>
        <div className={styles.right}>
          <nav className={styles.links}>
            <a href="/#how">How it works</a>
            <Link href="/pricing">Pricing</Link>
            <a href="/#docs">Docs</a>
          </nav>
          <ThemeToggle />
          <Link href="/signin" className="btn btn-ghost">Sign in</Link>
          <Link href="/new" className="btn btn-primary">Start free</Link>
        </div>
      </div>
    </header>
  );
}
