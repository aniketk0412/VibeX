"use client";

// Homepage hero — the live-run "Cockpit". The product IS the hero, so the body is the live
// execution stream, and it actually animates: steps complete, the bar fills, usage ticks, then
// it loops. Usage/limits live in a compact bottom status line that expands a drawer upward.

import { useEffect, useState } from "react";
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

const STEPS = [
  "Scaffolded project",
  "Modeled habits + streaks",
  "Generated UI components",
  "Built the auth system",
  "Wired daily reminders",
  "Wrote tests",
  "Reviewer pass",
];
const TOTAL = STEPS.length;

export default function CockpitPanel() {
  const [usageOpen, setUsageOpen] = useState(false);
  const [done, setDone] = useState(0); // completed steps (TOTAL = build complete, then loops)

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDone(4);
      return;
    }
    const id = setInterval(() => setDone((d) => (d >= TOTAL ? 0 : d + 1)), 1500);
    return () => clearInterval(id);
  }, []);

  const complete = done >= TOTAL;
  const current = complete ? "Build complete" : STEPS[Math.min(done, TOTAL - 1)];
  const pct = Math.round((done / TOTAL) * 100);
  const tokens = (done * 8.4).toFixed(1);
  const cost = (done * 0.07).toFixed(2);
  const stepNo = Math.min(done + 1, TOTAL);
  const recentDone = STEPS.slice(0, done).slice(-2);

  return (
    <div className={styles.panel}>
      {/* terminal title bar */}
      <div className={styles.pbar}>
        <span className={styles.dots}><i /><i /><i /></span>
        <span className={styles.ptitle}>vibex · live run</span>
        <span className={styles.live} data-done={complete}><span className={styles.bd} /> {complete ? "DONE" : "LIVE"}</span>
      </div>

      {/* body — the live execution stream is the hero */}
      <div className={styles.body}>
        <div className={styles.goalchip}>
          <span className={styles.lock}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <span><b>Goal locked</b> · habit tracker · web · Sonnet + Opus</span>
        </div>

        <div className={styles.stream}>
          {recentDone.map((s, i) => (
            <div key={`${done}-${i}-${s}`} className={styles.line} data-state="done">
              <span className={styles.chk}><Check /></span>
              <span className={styles.ltext}>{s}</span>
            </div>
          ))}

          {!complete ? (
            <div className={styles.active}>
              <div className={styles.line} data-state="active">
                <span className={styles.spin} />
                <span className={styles.ltext}>{current}</span>
                <span className={styles.step}>step {stepNo} of ~{TOTAL}</span>
              </div>
              <div className={styles.progress}>
                <div className={styles.bar}><i style={{ width: `${pct}%` }} /></div>
                <span className={styles.pct}>{pct}%</span>
              </div>
            </div>
          ) : (
            <div className={styles.line} data-state="done">
              <span className={styles.chk}><Check /></span>
              <span className={styles.ltext}>Build complete — preview &amp; download ready</span>
            </div>
          )}
        </div>
      </div>

      {/* usage drawer — collapsed by default, expands upward from the status line */}
      <div className={styles.drawer} data-open={usageOpen}>
        <div className={styles.drawerInner}>
          <div className={styles.uhead}>Usage · this window</div>
          <div className={styles.urows}>
            <div className={styles.urow}><span>Tokens</span><b>{tokens}k</b></div>
            <div className={styles.urow}><span>Est. cost</span><b className={styles.acc}>${cost}</b></div>
            <div className={styles.urow}><span>Plan</span><b>Pro</b></div>
          </div>
          <div className={styles.limit}>
            <div className={styles.limitbar}><i style={{ width: `${Math.min(100, 12 + pct * 0.5)}%` }} /></div>
            <div className={styles.limitmeta}>
              <span>5-hour window</span>
              <span>resets in 3h 12m</span>
            </div>
          </div>
        </div>
      </div>

      {/* status / interrupt bar — always visible at the bottom */}
      <div className={styles.statusbar}>
        <span className={styles.gear}>{complete ? <Check /> : <span className={styles.spin} />}</span>
        <span className={styles.slabel}>{current}</span>
        <span className={styles.steppill}>step {stepNo} of ~{TOTAL}</span>

        <button
          type="button"
          className={styles.usageBtn}
          onClick={() => setUsageOpen((v) => !v)}
          aria-expanded={usageOpen}
          aria-label={usageOpen ? "Hide usage details" : "Show usage details"}
        >
          <span className={styles.reset}>{tokens}k · ${cost}</span>
          <span className={styles.chev} data-open={usageOpen}><Chevron /></span>
        </button>

        <button className={styles.ibtn} type="button">❚❚ Interrupt</button>
      </div>
    </div>
  );
}
