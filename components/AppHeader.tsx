import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import BackLink from "./BackLink";
import styles from "./AppHeader.module.css";

type SessionUser = { name?: string | null; email?: string | null; image?: string | null };

// Shared chrome for the content screens (dashboard / settings / new / interview): logo on the
// far left, then a consistent right cluster (back · custom actions · theme · account). `maxWidth`
// aligns the header with each page's content width.
export default function AppHeader({
  back,
  user,
  actions,
  maxWidth = 960,
  className,
}: {
  back?: { href: string; label: string };
  user?: SessionUser | null;
  actions?: React.ReactNode;
  maxWidth?: number;
  className?: string;
}) {
  return (
    <header className={className ? `${styles.header} ${className}` : styles.header}>
      <div className={styles.inner} style={{ "--hw": `${maxWidth}px` } as React.CSSProperties}>
        <Link href="/" aria-label="Vibex home" className={styles.brand}>
          <Logo size={28} />
        </Link>
        <div className={styles.right}>
          {back && <BackLink href={back.href} label={back.label} />}
          {actions}
          <ThemeToggle />
          {user && <UserMenu name={user.name} email={user.email} image={user.image} />}
        </div>
      </div>
    </header>
  );
}
