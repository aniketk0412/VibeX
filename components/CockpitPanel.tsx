"use client";

// Homepage hero — the live-run "Cockpit". The product IS the hero, so the body is the
// live execution stream. Usage/limits aren't splayed across the top; they live in a compact
// bottom status line that expands a drawer upward, the way Claude Code surfaces context.
// Static values for now — animation lands next.

import { useState } from "react";
import styles from "./CockpitPanel.module.css";

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

const DONE = ["Scaffolded project", "Modeled habits + streaks", "Generated UI components"];

export default function CockpitPanel() {
  const [usageOpen, setUsageOpen] = useState(false);

  return (
    <div className={styles.panel}>
      {/* terminal title bar */}
      <div className={styles.pbar}>
        <span className={styles.dots}><i /><i /><i /></span>
        <span className={styles.ptitle}>vibex · live run</span>
        <span className={styles.live}><span className={styles.bd} /> LIVE</span>
      </div>

      {/* body — the live execution stream is the hero */}
      <div className={styles.body}>
        <div className={styles.goalchip}>
          <span className={styles.lock}>🔒</span>
          <span><b>Goal locked</b> · habit tracker · web · Sonnet + Opus</span>
        </div>

        <div className={styles.stream}>
          {DONE.map((s) => (
            <div key={s} className={styles.line} data-state="done">
              <span className={styles.chk}><Check /></span>
              <span className={styles.ltext}>{s}</span>
            </div>
          ))}

          <div className={styles.active}>
            <div className={styles.line} data-state="active">
              <span className={styles.spin} />
              <span className={styles.ltext}>Building auth system</span>
              <span className={styles.step}>step 4 of ~12</span>
            </div>
            <div className={styles.progress}>
              <div className={styles.bar}><i /></div>
              <span className={styles.pct}>58%</span>
            </div>
          </div>
        </div>
      </div>

      {/* usage drawer — collapsed by default, expands upward from the status line */}
      <div className={styles.drawer} data-open={usageOpen}>
        <div className={styles.drawerInner}>
          <div className={styles.uhead}>Usage · this window</div>
          <div className={styles.urows}>
            <div className={styles.urow}><span>Tokens</span><b>48.2k</b></div>
            <div className={styles.urow}><span>Est. cost</span><b className={styles.acc}>$0.41</b></div>
            <div className={styles.urow}><span>Plan</span><b>Pro</b></div>
          </div>
          <div className={styles.limit}>
            <div className={styles.limitbar}><i /></div>
            <div className={styles.limitmeta}>
              <span>5-hour window · 34% used</span>
              <span>resets in 3h 12m</span>
            </div>
          </div>
        </div>
      </div>

      {/* status / interrupt bar — always visible at the bottom */}
      <div className={styles.statusbar}>
        <span className={styles.gear}>⚙</span>
        <span className={styles.slabel}>Building auth system</span>
        <span className={styles.steppill}>step 4 of ~12</span>

        <button
          type="button"
          className={styles.usageBtn}
          onClick={() => setUsageOpen((v) => !v)}
          aria-expanded={usageOpen}
          aria-label={usageOpen ? "Hide usage details" : "Show usage details"}
        >
          <span className={styles.reset}>↺ 3h 12m</span>
          <span className={styles.chev} data-open={usageOpen}><Chevron /></span>
        </button>

        <button className={styles.ibtn} type="button">❚❚ Interrupt</button>
      </div>
    </div>
  );
}
