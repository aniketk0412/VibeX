// Terms of service. Plain-language, matching actual product behavior (ownership of generated
// code, BYOK responsibility, fair-use limits). Have a lawyer review before a serious launch.

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The plain-language rules for using Vibex.",
  alternates: { canonical: "/terms" },
};

const CONTACT = "dev.prayag.jan2009@gmail.com";

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <span className={styles.kicker}>Legal</span>
        <h1 className={styles.title}>Terms of service</h1>
        <p className={styles.updated}>Last updated: July 2, 2026</p>

        <div className={styles.body}>
          <p>
            These are the plain-language rules for using Vibex. By creating an account or running a
            build you agree to them.
          </p>

          <h2>What Vibex is</h2>
          <p>
            Vibex generates application code from your description using AI models, reviews it, and
            helps you preview, download, export, and deploy it. AI output can be wrong, insecure, or
            incomplete — <b>review generated code before you rely on it in production</b>.
          </p>

          <h2>Your code is yours</h2>
          <p>
            You own the code Vibex generates for your projects. We claim no rights over it. You are
            responsible for making sure your idea and its use don&apos;t infringe someone else&apos;s rights.
          </p>

          <h2>Fair use</h2>
          <ul>
            <li>Plan limits are time-based rolling windows; builds pause and resume rather than charging top-ups.</li>
            <li>Don&apos;t abuse the service: no attempts to bypass rate limits or plan limits, no generating malware or content that&apos;s illegal where you live, no reselling access.</li>
            <li>We may throttle or suspend accounts that put the service or other users at risk.</li>
          </ul>

          <h2>Bring-your-own-key</h2>
          <p>
            If you add your own provider API keys, builds run on your keys and are billed to you by
            that provider under their terms. We store your keys encrypted, use them only for your
            builds, and you can remove them at any time. Keep your provider account in good
            standing — provider rate limits and policies apply.
          </p>

          <h2>Paid plans</h2>
          <p>
            Paid plans are billed through LemonSqueezy when checkout is live. Cancelling downgrades
            you to the free plan at the end of the billing period. Prices and plan limits may change
            with notice on the pricing page.
          </p>

          <h2>No warranty</h2>
          <p>
            Vibex is provided as-is. To the maximum extent the law allows, we&apos;re not liable for
            losses caused by generated code, provider outages, or data loss — keep copies of code
            you care about (download or export is one click).
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
