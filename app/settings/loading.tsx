// Instant skeleton for Settings while the session, keys, and plan load.
import styles from "./settings.module.css";

export default function SettingsLoading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading settings">
      <header className={styles.top}>
        <div className={styles.left}>
          <div className="skeleton" style={{ width: 110, height: 30, borderRadius: 9 }} />
          <div className="skeleton" style={{ width: 96, height: 30, borderRadius: 9 }} />
        </div>
        <div className={styles.right}>
          <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 11 }} />
          <div className="skeleton" style={{ width: 38, height: 38, borderRadius: "50%" }} />
        </div>
      </header>
      <main className={styles.main}>
        <div className="skeleton" style={{ width: 160, height: 36, borderRadius: 10 }} />
        <div className="skeleton" style={{ height: 90, marginTop: 24, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 220, marginTop: 24, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 110, marginTop: 24, borderRadius: 16 }} />
      </main>
    </div>
  );
}
