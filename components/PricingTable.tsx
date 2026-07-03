// Plan comparison matrix (Free · Starter · Pro · Scale) + the BYOK band. Replaces the four
// identical plan cards: one table shows what each plan has AND lacks, side by side. Driven
// entirely by lib/plans.ts (PLANS + MATRIX) so limits stay in sync with the engine.

import Link from "next/link";
import { PLANS, BYOK, MATRIX, type MatrixValue } from "@/lib/plans";
import styles from "./PricingTable.module.css";

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// true → tick, false → quiet dash (the "disadvantage" is visible, not hidden), string → verbatim.
function Cell({ v }: { v: MatrixValue }) {
  if (v === true) return <span className={styles.tick} aria-label="Included"><Check /></span>;
  if (v === false) return <span className={styles.no} aria-label="Not included">—</span>;
  return <span className={styles.val}>{v}</span>;
}

export default function PricingTable() {
  return (
    <div className={styles.wrap}>
      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.corner} scope="col">
                <span className={styles.cornerLabel}>Compare plans</span>
              </th>
              {PLANS.map((p) => (
                <th key={p.id} scope="col" className={styles.planHead} data-highlight={p.highlight}>
                  {p.highlight && <span className={styles.badge}>Most popular</span>}
                  <span className={styles.planName}>{p.name}</span>
                  <span className={styles.priceRow}>
                    <span className={styles.price}>${p.price}</span>
                    {p.price > 0 && <span className={styles.per}>/mo</span>}
                  </span>
                  <span className={styles.tagline}>{p.tagline}</span>
                  <Link href={p.cta.href} className={`btn btn-sm ${p.highlight ? "btn-primary" : "btn-ghost"} ${styles.cta}`}>
                    {p.cta.label}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          {MATRIX.map((g) => (
            <tbody key={g.group}>
              <tr className={styles.groupRow}>
                <th scope="rowgroup" colSpan={PLANS.length + 1}>{g.group}</th>
              </tr>
              {g.rows.map((row) => (
                <tr key={row.label} className={styles.row}>
                  <th scope="row" className={styles.rowLabel}>
                    {row.label}
                    {row.note && <span className={styles.rowNote}>{row.note}</span>}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={PLANS[i].id} className={styles.cell} data-highlight={PLANS[i].highlight}>
                      <Cell v={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className={styles.byok}>
        <div className={styles.byokMain}>
          <div className={styles.byokHead}>
            <span className={styles.byokName}>{BYOK.name}</span>
            <span className={styles.byokPrice}>Free · {BYOK.priceNote}</span>
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
