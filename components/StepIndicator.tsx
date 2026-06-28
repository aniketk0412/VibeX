// The progress rail shown on every post-idea screen: Idea · Scope · Stack · Models · Goal.
// Pure presentation — pass the active step; earlier steps render as done, later as upcoming.

import styles from "./StepIndicator.module.css";

export const FLOW_STEPS = ["Idea", "Scope", "Design", "Stack", "Models", "Goal"] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function StepIndicator({
  active,
  steps = FLOW_STEPS,
}: {
  active: FlowStep;
  steps?: readonly FlowStep[];
}) {
  const activeIndex = steps.indexOf(active);

  return (
    <nav className={styles.steps} aria-label="Progress">
      <ol className={styles.list}>
        {steps.map((step, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming";
          return (
            <li
              key={step}
              className={styles.item}
              data-state={state}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span className={styles.badge}>{state === "done" ? <Check /> : i + 1}</span>
              <span className={styles.label}>{step}</span>
              {i < steps.length - 1 && <span className={styles.bar} aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
