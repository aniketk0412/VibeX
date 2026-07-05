// /download — Vibex on every surface: browser, Windows desktop, terminal. Public page (not in
// the auth-gate matcher). Featured desktop panel first (it's the page's namesake), then web +
// terminal. The Windows button is driven by NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL so the page can
// ship before the installer is hosted; absent env → honest "almost here" state, no dead links.

import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { IconGlobe, IconZap, IconLock } from "@/components/icons";
import styles from "./download.module.css";

export const metadata: Metadata = {
  title: "Download",
  description: "Use Vibex in the browser, as a Windows app, or from your terminal — one account, one build engine.",
  alternates: { canonical: "/download" },
};

// Public release asset (github.com/aniketk0412/vibex-releases). The /latest/download/ form
// stays stable across re-releases with the same filename; env overrides if hosting moves.
const DESKTOP_URL =
  process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ??
  "https://github.com/aniketk0412/vibex-releases/releases/latest/download/Vibex-Setup-0.1.0.exe";
// Flip when `npm publish` has run from cli/ (package: vibex-app, command: vibex).
const CLI_PUBLISHED = false;

export default function DownloadPage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <section className={styles.head}>
          <span className="eyebrow"><span className="dot" /> Get Vibex</span>
          <h1 className={styles.title}>One engine.<br />Three ways in.</h1>
          <p className={styles.sub}>
            Browser, Windows app, or terminal — same account, same plans. Every build lands on your
            dashboard no matter where it started.
          </p>
        </section>

        {/* ── featured: the desktop app ─────────────────────────────── */}
        <section className={styles.feature} aria-label="Vibex for Windows">
          <div className={styles.featureText}>
            <span className={styles.kicker}>Desktop</span>
            <h2 className={styles.featureName}>Vibex for Windows</h2>
            <p className={styles.featureBlurb}>
              The whole workspace in its own window — plus the thing a browser tab can&apos;t do:
              <b> save any build straight into a local folder</b>, ready for git and your editor.
            </p>
            <div className={styles.metaRow}>
              <span className={styles.metaChip}>v0.1.0</span>
              <span className={styles.metaChip}>~78 MB</span>
              <span className={styles.metaChip}>Windows 10 / 11 · x64</span>
              <span className={styles.metaChip}>macOS soon</span>
            </div>
            {DESKTOP_URL ? (
              <div className={styles.ctaRow}>
                <a href={DESKTOP_URL} className="btn btn-primary btn-lg">Download for Windows</a>
                <span className={styles.note}>Unsigned preview build — SmartScreen may ask you to confirm.</span>
              </div>
            ) : (
              <div className={styles.ctaRow}>
                <span className={`btn btn-secondary btn-lg ${styles.btnDisabled}`} aria-disabled>Almost here</span>
                <span className={styles.note}>Built and in final checks. Meanwhile, the web app is the same engine.</span>
              </div>
            )}
          </div>

          {/* CSS-drawn app window — concrete, not a stock screenshot */}
          <div className={styles.shot} aria-hidden>
            <div className={styles.shotBar}>
              <span className={styles.shotDots}><i /><i /><i /></span>
              <span className={styles.shotTitle}>Vibex</span>
            </div>
            <div className={styles.shotBody}>
              <div className={styles.shotChat}>
                <span className={styles.shotLine} style={{ width: "72%" }} />
                <span className={styles.shotLine} style={{ width: "88%" }} />
                <span className={styles.shotLineGold} style={{ width: "56%" }} />
                <span className={styles.shotLine} style={{ width: "80%" }} />
                <span className={styles.shotInput} />
              </div>
              <div className={styles.shotCanvas}>
                <span className={styles.shotChip} />
                <span className={styles.shotBlock} />
                <span className={styles.shotBtn}>Save to folder</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── web + terminal ────────────────────────────────────────── */}
        <section className={styles.pair}>
          <div className={styles.card}>
            <span className={styles.cardIcon}><IconGlobe size={17} /></span>
            <h2 className={styles.cardName}>Web</h2>
            <p className={styles.cardBlurb}>
              Nothing to install. Describe the idea, watch the Coder + Reviewer build it, edit in
              the in-app VS Code editor, ship from the browser.
            </p>
            <Link href="/new" className={`btn btn-primary ${styles.cardBtn}`}>Start building →</Link>
          </div>

          <div className={styles.term}>
            <div className={styles.termBar}>
              <span className={styles.termDots}><i /><i /><i /></span>
              <span className={styles.termTitle}>terminal</span>
              {!CLI_PUBLISHED && <span className={styles.termSoon}>npm · rolling out</span>}
            </div>
            <pre className={styles.termBody}>
              <span className={styles.p}>$ </span><span className={styles.c}>npm i -g vibex-app</span>{"\n"}
              <span className={styles.p}>$ </span><span className={styles.c}>vibex login</span>{"\n"}
              <span className={styles.p}>$ </span><span className={styles.c}>vibex build</span> <span className={styles.a}>&quot;a habit tracker&quot;</span>{"\n"}
              <span className={styles.o}>✔ Build complete — 4 files → ./habit-tracker</span>
            </pre>
            <p className={styles.termFoot}>
              The Claude-Code-style CLI: builds land in the folder you&apos;re standing in.
              Token auth from Settings · Node 18+ · Windows, macOS, Linux.
            </p>
          </div>
        </section>

        {/* ── the constants, whichever door they pick ───────────────── */}
        <section className={styles.strip} aria-label="Included everywhere">
          <span className={styles.stripItem}><IconZap size={14} /> Coder + Reviewer on every build</span>
          <span className={styles.stripItem}><IconGlobe size={14} /> One account, one dashboard</span>
          <span className={styles.stripItem}><IconLock size={14} /> Your code stays yours</span>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
