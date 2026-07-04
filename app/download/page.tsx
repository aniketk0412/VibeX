// /download — Vibex on every surface: browser, Windows desktop, terminal. Public page (not in
// the auth-gate matcher). The Windows button is driven by NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL so
// the page can ship before the installer is uploaded; absent env → honest "almost here" state.

import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { IconGlobe, IconTerminal } from "@/components/icons";
import styles from "./download.module.css";

export const metadata: Metadata = {
  title: "Download",
  description: "Use Vibex in the browser, as a Windows app, or from your terminal — one account, one build engine.",
  alternates: { canonical: "/download" },
};

// Set in Vercel once the installer is uploaded (e.g. a GitHub release asset URL).
const DESKTOP_URL = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL;
// Flip when `npm publish` has run from cli/ (package: vibex-app, command: vibex).
const CLI_PUBLISHED = false;

function IconMonitor() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export default function DownloadPage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <section className={styles.head}>
          <span className="eyebrow"><span className="dot" /> Get Vibex</span>
          <h1 className={styles.title}>One engine. Three ways in.</h1>
          <p className={styles.sub}>
            Browser, Windows app, or terminal — same account, same plans, and every build lands on
            your dashboard no matter where it started.
          </p>
        </section>

        <section className={styles.grid} aria-label="Ways to use Vibex">
          <div className={styles.card}>
            <span className={styles.cardIcon}><IconGlobe size={18} /></span>
            <h2 className={styles.cardName}>Web</h2>
            <p className={styles.cardBlurb}>
              Nothing to install. Describe the idea, watch the Coder + Reviewer build it, edit in
              the in-app VS Code editor, ship from the browser.
            </p>
            <span className={styles.meta}>Works everywhere · live now</span>
            <Link href="/new" className={`btn btn-primary ${styles.cardBtn}`}>Start building →</Link>
          </div>

          <div className={styles.card}>
            <span className={styles.cardIcon}><IconMonitor /></span>
            <h2 className={styles.cardName}>Windows</h2>
            <p className={styles.cardBlurb}>
              Vibex in its own window — plus what a browser tab can&apos;t do: save any build straight
              into a local folder, ready for git and your editor.
            </p>
            <span className={styles.meta}>v0.1.0 · ~78 MB · Windows 10/11 (x64)</span>
            {DESKTOP_URL ? (
              <>
                <a href={DESKTOP_URL} className={`btn btn-primary ${styles.cardBtn}`}>Download for Windows</a>
                <span className={styles.note}>Unsigned preview build — Windows SmartScreen may ask you to confirm.</span>
              </>
            ) : (
              <>
                <span className={`btn btn-ghost ${styles.cardBtn} ${styles.btnDisabled}`} aria-disabled>Almost here</span>
                <span className={styles.note}>The installer is built and in final checks — days, not weeks. macOS later.</span>
              </>
            )}
          </div>

          <div className={styles.card}>
            <span className={styles.cardIcon}><IconTerminal size={18} /></span>
            <h2 className={styles.cardName}>Terminal</h2>
            <p className={styles.cardBlurb}>
              The Claude-Code-style CLI: one command builds the app into the folder you&apos;re
              standing in. Token auth from Settings, usage on your plan.
            </p>
            <pre className={styles.code}>{`npm i -g vibex-app
vibex login
vibex build "a habit tracker"`}</pre>
            {CLI_PUBLISHED ? (
              <span className={styles.meta}>Node 18+ · npm · Windows, macOS, Linux</span>
            ) : (
              <span className={styles.note}>Landing on npm shortly — the web app is live today.</span>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
