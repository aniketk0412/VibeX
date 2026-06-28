import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PricingTable from "@/components/PricingTable";
import styles from "./pricing.module.css";

export const metadata: Metadata = {
  title: "Pricing — Vibex",
  description: "Start free. Time-based rolling limits, never credit top-ups. Starter $12, Pro $29, Scale $79, or bring your own key.",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <section className={styles.head}>
          <span className="eyebrow"><span className="dot" /> Plans</span>
          <h1 className={styles.title}>Pricing that follows your usage</h1>
          <p className={styles.sub}>
            One free project to try the whole loop. After that, pick a plan or bring your own key —
            limits are <b>time-based rolling windows</b>, so you pause and resume instead of topping up.
          </p>
        </section>
        <div className={styles.tableWrap}>
          <PricingTable />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
