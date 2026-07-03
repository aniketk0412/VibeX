import Link from "next/link";
import { auth } from "@/auth";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import styles from "./SiteHeader.module.css";

// Auth-aware marketing header: signed-out visitors get Sign in / Start free; signed-in users
// get a Dashboard shortcut + their account menu instead.
export default async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className={styles.nav}>
      <div className={`wrap ${styles.inner}`}>
        <Link href="/" aria-label="Vibex home">
          <Logo size={30} className={styles.logo} />
        </Link>
        <div className={styles.right}>
          <nav className={styles.links}>
            <a href="/#how">How it works</a>
            <Link href="/pricing">Pricing</Link>
            <a href="/#faq">FAQ</a>
          </nav>
          <ThemeToggle />
          {user ? (
            <>
              <Link href="/dashboard" className="btn btn-primary">Dashboard →</Link>
              <UserMenu name={user.name} email={user.email} image={user.image} />
            </>
          ) : (
            <>
              <Link href="/signin" className="btn btn-ghost">Sign in</Link>
              <Link href="/new" className="btn btn-primary">Start free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
