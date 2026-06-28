import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CockpitPanel from "@/components/CockpitPanel";
import PricingTable from "@/components/PricingTable";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="wrap">
        <section className={styles.hero}>
          <div>
            <span className="eyebrow"><span className="dot" /> Automated vibe coding</span>
            <h1 className={styles.headline}>
              <span className={styles.lead}>You have the idea.</span>
              <span className={styles.pain}>You hate writing 20 prompts manually.</span>
              <span className={styles.punch}>We do it for you.</span>
            </h1>
            <p className={styles.sub}>
              Describe it once. Vibex interviews you, locks the goal, then generates and runs every prompt until it&apos;s done.
            </p>
            <p className={styles.tag}>// from idea to code, automatically</p>
            <div className={styles.ctaRow}>
              <Link href="/new" className="btn btn-primary btn-lg">Build something →</Link>
              <button className="btn btn-ghost btn-lg" type="button">Watch a run</button>
            </div>
            <p className={styles.note}><b>1 free project</b> — no prompt-writing, no babysitting. Interrupt anytime.</p>
          </div>

          {/* Cockpit live-run panel — the product is the hero (animation lands next) */}
          <CockpitPanel />
        </section>

        <div className={styles.trust} id="how">
          <b>Claude · GPT-4o · Gemini</b><span className={styles.sep} />
          <b>Bring your own key, or use a Vibex plan</b><span className={styles.sep} />
          <b>Coder AI + Reviewer AI</b><span className={styles.sep} />
          <b>Live usage &amp; cost, always visible</b>
        </div>

        <section className={styles.pricing} id="pricing">
          <div className={styles.pricingHead}>
            <span className="eyebrow"><span className="dot" /> Plans</span>
            <h2 className={styles.h2}>Simple, usage-based plans</h2>
            <p className={styles.h2sub}>
              Start free. Limits are <b>time-based rolling windows</b> — never credit top-ups — so a run
              auto-pauses and resumes, and you never lose progress.
            </p>
          </div>
          <PricingTable />
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
