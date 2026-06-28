// Instant skeleton for the dashboard while the session, projects, and usage load.
import styles from "./dashboard.module.css";

export default function DashboardLoading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading dashboard">
      <header className={styles.top}>
        <div className="skeleton" style={{ width: 110, height: 30, borderRadius: 9 }} />
        <div className={styles.right}>
          <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 11 }} />
          <div className="skeleton" style={{ width: 132, height: 42, borderRadius: 11 }} />
          <div className="skeleton" style={{ width: 38, height: 38, borderRadius: "50%" }} />
        </div>
      </header>
      <main className={styles.main}>
        <div className="skeleton" style={{ width: "min(360px, 70%)", height: 38, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: "min(440px, 82%)", height: 18, marginTop: 12, borderRadius: 8 }} />
        <div className={styles.stats} style={{ marginTop: 24 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 84, flex: 1, minWidth: 150, borderRadius: 12 }} />
          ))}
        </div>
        <div className="skeleton" style={{ width: 150, height: 22, marginTop: 30, borderRadius: 8 }} />
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 92, borderRadius: 13 }} />
          ))}
        </div>
      </main>
    </div>
  );
}
