import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.inner}`}>
        <span>© {new Date().getFullYear()} Vibex — vibe + execute</span>
        <span>From idea to code, automatically.</span>
      </div>
    </footer>
  );
}
