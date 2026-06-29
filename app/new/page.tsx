"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import StepIndicator from "@/components/StepIndicator";
import BackLink from "@/components/BackLink";
import { AttachButton, Thumbs, type AttachedImage } from "@/components/ImageAttach";
import styles from "./new.module.css";

// Guided picker: a real capability (Web / API / CLI) → a subtype, each carrying a rich, specific
// idea that primes the interview. Only the platforms the engine actually ships — no overclaiming.
type Sub = { label: string; idea: string };
type BuildType = { id: string; label: string; icon: string; prompt: string; subs: Sub[] };

const TYPES: BuildType[] = [
  {
    id: "web",
    label: "Web app",
    icon: "🌐",
    prompt: "Which kind of site?",
    subs: [
      { label: "Landing page", idea: "A SaaS landing page for a developer tool: a hero with headline and CTA, a feature grid, a pricing table, an FAQ, and an email waitlist form." },
      { label: "Dashboard", idea: "An admin dashboard with a left sidebar, summary stat cards, a sortable data table, and a line chart of activity over time." },
      { label: "Blog", idea: "A markdown blog with tagged posts, full-text search, an RSS feed, and a clean reading layout." },
      { label: "Portfolio", idea: "A developer portfolio: a hero intro, a project gallery with case-study cards, a skills section, and a contact form." },
      { label: "Notes app", idea: "A notes app with markdown support, tags, instant search, and autosave to local storage, with a two-pane editor/preview." },
      { label: "Store", idea: "A small product store with a product grid, product detail view, a cart, and an order summary at checkout." },
      { label: "Link-in-bio", idea: "A link-in-bio page with an avatar, a short bio, social icons, and a vertical list of styled link buttons." },
    ],
  },
  {
    id: "api",
    label: "API",
    icon: "🔌",
    prompt: "Which kind of service?",
    subs: [
      { label: "REST API", idea: "A REST API for a task manager with CRUD endpoints, input validation, in-memory storage, and a README documenting every route." },
      { label: "Webhook handler", idea: "A webhook handler service that verifies signatures, routes events by type, and logs each delivery, with a health-check endpoint." },
      { label: "Auth service", idea: "A minimal authentication API with signup and login endpoints, hashed passwords, and JWT session tokens." },
    ],
  },
  {
    id: "cli",
    label: "CLI",
    icon: "⌨️",
    prompt: "Which kind of tool?",
    subs: [
      { label: "File tool", idea: "A command-line tool that bulk-renames files using glob patterns and a regex, with a --dry-run flag and a summary of changes." },
      { label: "Dev script", idea: "A command-line dev helper that scaffolds files from templates, with flags for the target directory and overwrite behavior." },
      { label: "Data converter", idea: "A command-line tool that converts between CSV and JSON, streaming large files, with flags for delimiter and pretty-printing." },
    ],
  },
];

export default function NewIdeaPage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [refs, setRefs] = useState<AttachedImage[]>([]);
  const [mod, setMod] = useState("⌘");
  const [typeId, setTypeId] = useState("web");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const isMac = /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
    if (!isMac) setMod("Ctrl");
  }, []);

  const grow = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIdea(e.target.value);
    grow(e.target);
  };

  const seedAndGo = (text: string) => {
    try {
      sessionStorage.setItem("vibex-idea", text.trim());
    } catch {
      /* sessionStorage may be unavailable — proceed anyway */
    }
    router.push("/interview");
  };

  const canSubmit = idea.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    try {
      if (refs.length) sessionStorage.setItem("vibex-idea-refs", JSON.stringify(refs.map((r) => r.name)));
    } catch {
      /* ignore */
    }
    seedAndGo(idea);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const activeType = TYPES.find((t) => t.id === typeId) ?? TYPES[0];

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" aria-label="Vibex home">
          <Logo size={28} />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BackLink href="/" label="Back" />
          <ThemeToggle />
        </div>
      </header>

      <main className={styles.main}>
        <StepIndicator active="Idea" />

        <section className={styles.card}>
          <h1 className={styles.heading}>What do you want to build?</h1>
          <p className={styles.subtext}>
            Pick a starting point, or describe your own. Either way, Vibex interviews you to fill in
            the gaps, locks a goal, then writes and runs every prompt until it&apos;s built.
          </p>

          {/* type picker */}
          <div className={styles.typeTabs} role="tablist" aria-label="Project type">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === typeId}
                className={styles.typeTab}
                data-active={t.id === typeId}
                onClick={() => setTypeId(t.id)}
              >
                <span className={styles.typeIcon} aria-hidden>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          <div className={styles.subRow}>
            <span className={styles.subLabel}>{activeType.prompt}</span>
            <div className={styles.subs}>
              {activeType.subs.map((s) => (
                <button key={s.label} type="button" className={styles.sub} onClick={() => seedAndGo(s.idea)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.or}><span>or describe your own</span></div>

          <div className={styles.field}>
            <textarea
              ref={taRef}
              className={styles.textarea}
              value={idea}
              onChange={onChange}
              onKeyDown={onKeyDown}
              placeholder="e.g. a habit tracker with streaks and daily reminders…"
              rows={3}
              spellCheck
              aria-label="Describe what you want to build"
            />
            {refs.length > 0 && (
              <div className={styles.refStrip}>
                <Thumbs images={refs} onRemove={(id) => setRefs((r) => r.filter((x) => x.id !== id))} />
              </div>
            )}
          </div>

          <div className={styles.attachRow}>
            <AttachButton className={styles.attachBtn} onPick={(imgs) => setRefs((r) => [...r, ...imgs])} />
            <span className={styles.attachLabel}>Attach a reference image (optional)</span>
          </div>

          <div className={styles.actions}>
            <span className={styles.hint}>
              <kbd>{mod}</kbd>
              <kbd>↵</kbd>
              <span>to start</span>
            </span>
            <button type="button" className="btn btn-primary btn-lg" disabled={!canSubmit} onClick={submit}>
              Start interview →
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
