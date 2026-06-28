// Plans grid (Free · Starter · Pro · Scale) + the BYOK add-on. Pure presentation,
// driven by lib/plans.ts so limits stay in sync with the engine.

import Link from "next/link";
import { PLANS, BYOK, windowNote } from "@/lib/plans";
import styles from "./PricingTable.module.css";

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function PricingTable() {
  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        {PLANS.map((p) => (
          <div key={p.id} className={styles.card} data-highlight={p.highlight}>
            {p.highlight && <span className={styles.badge}>Most popular</span>}
            <div className={styles.name}>{p.name}</div>
            <div className={styles.priceRow}>
              <span className={styles.price}>${p.price}</span>
              {p.price > 0 && <span className={styles.per}>/mo</span>}
            </div>
            <div className={styles.tagline}>{p.tagline}</div>

            <div className={styles.projects}>{p.projects}</div>
            <div className={styles.window}>{windowNote(p.id)}</div>

            <Link
              href={p.cta.href}
              className={`btn ${p.highlight ? "btn-primary" : "btn-ghost"}`}
            >
              {p.cta.label}
            </Link>

            <ul className={styles.features}>
              {p.features.map((f) => (
                <li key={f}>
                  <span className={styles.tick}><Check /></span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={styles.byok}>
        <div className={styles.byokMain}>
          <div className={styles.byokHead}>
            <span className={styles.byokName}>{BYOK.name}</span>
            <span className={styles.byokPrice}>${BYOK.price}<span className={styles.per}>/mo</span></span>
          </div>
          <p className={styles.byokTagline}>{BYOK.tagline}</p>
        </div>
        <ul className={styles.byokFeatures}>
          {BYOK.features.map((f) => (
            <li key={f}><span className={styles.tick}><Check /></span>{f}</li>
          ))}
        </ul>
        <Link href={BYOK.cta.href} className="btn btn-ghost">{BYOK.cta.label}</Link>
      </div>
    </div>
  );
}
