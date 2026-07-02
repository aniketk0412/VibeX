// Privacy policy. Written to match what the product actually does (auth providers, BYOK key
// encryption, model providers, infra) — keep it in sync when those change, and have it reviewed
// by a lawyer before any serious launch.

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Vibex collects, why, and what never leaves the server.",
  alternates: { canonical: "/privacy" },
};

const CONTACT = "dev.prayag.jan2009@gmail.com";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <span className={styles.kicker}>Legal</span>
        <h1 className={styles.title}>Privacy policy</h1>
        <p className={styles.updated}>Last updated: July 2, 2026</p>

        <div className={styles.body}>
          <p>
            Vibex turns an idea you describe into working code. To do that we store as little as we
            can, encrypt what&apos;s sensitive, and never sell any of it. This page says exactly what we
            collect and where it goes.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li><b>Account basics</b> — your name, email address, and avatar from Google sign-in, or just your email for magic-link sign-in.</li>
            <li><b>Your projects</b> — the idea you describe, your interview answers, the generated code, and the prompt history of each build.</li>
            <li><b>Usage metrics</b> — token counts and estimated cost per build, used to enforce plan limits and show you your own usage.</li>
            <li><b>API keys you bring</b> — stored encrypted (AES-256-GCM) at rest. They are decrypted only on the server, only to run your builds, and are never sent to the browser or written to logs.</li>
          </ul>

          <h2>Where your data goes</h2>
          <ul>
            <li><b>Model providers</b> — your project description and build prompts are sent to the AI provider that generates your code (Anthropic, OpenAI, Google, or OpenRouter, depending on your model choice and keys). Their own data policies apply to that processing.</li>
            <li><b>Infrastructure</b> — the app runs on Vercel and stores data in a Neon Postgres database. Magic-link emails are sent via Resend.</li>
            <li><b>Analytics</b> — we use Vercel Analytics for anonymous page views and a handful of product events (e.g. &quot;build completed&quot;). No advertising trackers, no data brokers.</li>
            <li><b>Payments</b> — when paid plans launch, checkout and card handling happen entirely on LemonSqueezy; we never see your card details.</li>
          </ul>

          <h2>What we never do</h2>
          <ul>
            <li>We never sell or share your data for advertising.</li>
            <li>We never use your projects or generated code to train models.</li>
            <li>We never expose your API keys to the browser, logs, or third parties.</li>
          </ul>

          <h2>Your controls</h2>
          <ul>
            <li>Delete any project from the dashboard — its runs and prompt history cascade with it.</li>
            <li>Remove any stored API key from Settings at any time.</li>
            <li>For full account deletion or a copy of your data, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we&apos;ll handle it within 30 days.</li>
          </ul>

          <h2>Cookies</h2>
          <p>
            We set only the cookies sign-in needs (session) plus your theme preference. Unchecking
            &quot;keep me signed in&quot; downgrades the session cookie so it clears when you close the
            browser. There are no third-party advertising cookies.
          </p>

          <h2>Changes</h2>
          <p>
            If this policy changes materially we&apos;ll note it here with a new date. Questions:{" "}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
