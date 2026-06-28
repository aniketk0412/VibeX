import Link from "next/link";
import Logo from "@/components/Logo";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <Link href="/" aria-label="Vibex home">
        <Logo size={30} />
      </Link>
      <div className={styles.code}>404</div>
      <h1 className={styles.title}>This page didn&apos;t make the build.</h1>
      <p className={styles.sub}>The link is broken or the page was moved. Let&apos;s get you back to building.</p>
      <div className={styles.actions}>
        <Link href="/" className="btn btn-ghost btn-lg">← Home</Link>
        <Link href="/new" className="btn btn-primary btn-lg">Build something →</Link>
      </div>
    </div>
  );
}
