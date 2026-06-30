import styles from "./BeforeAfter.module.css";

// Auto-animating proof of the design critic: a generic "templated" mock crossfades into the
// distinctive "Vibex redesign". Pure CSS (no JS), decorative (aria-hidden), reduced-motion safe.
// Colors are intentionally literal — the mocks illustrate generic-vs-Vibex, not the site theme.
export default function BeforeAfter() {
  return (
    <div className={styles.wrap} aria-hidden>
      {/* After — the Vibex redesign (base layer) */}
      <div className={styles.after}>
        <div className={styles.vNav}>
          <span className={styles.vDot} />
          <span className={styles.vNavBar} />
        </div>
        <div className={styles.vHero}>
          <div className={styles.vLeft}>
            <span className={styles.vH1} />
            <span className={styles.vLine} />
            <span className={styles.vLineShort} />
            <span className={styles.vBtn} />
          </div>
          <div className={styles.vCard}>
            <span className={styles.vCardBar} />
            <span className={styles.vCardBar2} />
          </div>
        </div>
        <div className={styles.vRow}>
          <span className={styles.vMini} />
          <span className={styles.vMini} />
          <span className={styles.vMini} />
        </div>
      </div>

      {/* Before — the generic template (fades away) */}
      <div className={styles.before}>
        <span className={styles.tBar} />
        <span className={styles.tBar2} />
        <div className={styles.tRow}>
          <span className={styles.tBox} />
          <span className={styles.tBox} />
          <span className={styles.tBox} />
        </div>
        <span className={styles.tBtn} />
      </div>

      <span className={styles.tagBefore}>Templated</span>
      <span className={styles.tagAfter}>Vibex redesign</span>
    </div>
  );
}
