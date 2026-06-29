import styles from "./AnimatedBackground.module.css";

// Ambient animated backdrop — drifting blurred "aurora" orbs in the brand palette plus a faint
// panning grid. Pure CSS (no deps), GPU-composited, and frozen under prefers-reduced-motion.
// Sits behind page content (give the content position:relative; z-index:1).
export default function AnimatedBackground() {
  return (
    <div className={styles.bg} aria-hidden>
      <span className={`${styles.orb} ${styles.o1}`} />
      <span className={`${styles.orb} ${styles.o2}`} />
      <span className={`${styles.orb} ${styles.o3}`} />
      <span className={styles.grid} />
      <span className={styles.veil} />
    </div>
  );
}
