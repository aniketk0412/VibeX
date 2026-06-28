// Instant skeleton for the project / result workspace while files + history load.
import styles from "./result.module.css";

export default function ResultLoading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading project">
      <header className={styles.top}>
        <div className="skeleton" style={{ width: 110, height: 30, borderRadius: 9 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 11 }} />
          <div className="skeleton" style={{ width: 38, height: 38, borderRadius: "50%" }} />
        </div>
      </header>
      <main className={styles.main}>
        <div className="skeleton" style={{ width: 140, height: 16, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: "min(420px, 70%)", height: 40, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: "min(520px, 80%)", height: 16, borderRadius: 6 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ width: 80, height: 30, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 70, height: 30, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 110, height: 30, borderRadius: 8 }} />
        </div>
        <div className="skeleton" style={{ height: 460, borderRadius: 14 }} />
      </main>
    </div>
  );
}
