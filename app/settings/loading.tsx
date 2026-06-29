// Instant skeleton for Settings while the session, keys, and plan load.
import { AppHeaderSkeleton } from "@/components/AppHeader";
import styles from "./settings.module.css";

export default function SettingsLoading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading settings">
      <AppHeaderSkeleton maxWidth={720} user />
      <main className={styles.main}>
        <div className="skeleton" style={{ width: 160, height: 36, borderRadius: 10 }} />
        <div className="skeleton" style={{ height: 90, marginTop: 24, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 220, marginTop: 24, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 110, marginTop: 24, borderRadius: 16 }} />
      </main>
    </div>
  );
}
