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

// Curated starting points. Each carries a rich, specific idea so the interview is well-primed;
// the user tweaks the rest there. category drives the small tag; icon is a glyph in a tile.
type Template = { id: string; name: string; blurb: string; idea: string; category: string; icon: string };

const TEMPLATES: Template[] = [
  {
    id: "saas-landing",
    name: "SaaS landing page",
    blurb: "Hero, feature grid, pricing, FAQ, waitlist.",
    category: "Site",
    icon: "🚀",
    idea: "A SaaS landing page for a developer tool: a hero with headline and call-to-action, a feature grid, a pricing table, an FAQ section, and an email waitlist form.",
  },
  {
    id: "dashboard",
    name: "Admin dashboard",
    blurb: "Sidebar, stat cards, table, chart.",
    category: "App",
    icon: "📊",
    idea: "An admin dashboard with a left sidebar, summary stat cards, a sortable data table, and a simple line chart of activity over time.",
  },
  {
    id: "notes",
    name: "Notes app",
    blurb: "Markdown, tags, search, autosave.",
    category: "App",
    icon: "🗒️",
    idea: "A notes app with markdown support, tags, instant search, and autosave to local storage, with a two-pane editor/preview layout.",
  },
  {
    id: "blog",
    name: "Personal blog",
    blurb: "Posts, tags, search, RSS.",
    category: "Site",
    icon: "✍️",
    idea: "A markdown blog with tagged posts, full-text search, an RSS feed, and a clean, readable article layout.",
  },
  {
    id: "portfolio",
    name: "Portfolio",
    blurb: "Hero, projects, skills, contact.",
    category: "Site",
    icon: "🎨",
    idea: "A developer portfolio: a hero intro, a project gallery with case-study cards, a skills section, and a contact form.",
  },
  {
    id: "link-in-bio",
    name: "Link-in-bio",
    blurb: "Avatar, socials, link buttons.",
    category: "Site",
    icon: "🔗",
    idea: "A link-in-bio page with an avatar, a short bio, social icons, and a vertical list of styled link buttons with click counts.",
  },
  {
    id: "rest-api",
    name: "REST API",
    blurb: "CRUD endpoints + docs.",
    category: "Backend",
    icon: "🔌",
    idea: "A REST API for a task manager with CRUD endpoints, in-memory storage, input validation, and a README documenting every route.",
  },
  {
    id: "cli-tool",
    name: "CLI tool",
    blurb: "Bulk file rename, dry-run.",
    category: "Tool",
    icon: "⌨️",
    idea: "A command-line tool that bulk-renames files using glob patterns and a regex, with a --dry-run flag and a summary of changes.",
  },
];

export default function NewIdeaPage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [refs, setRefs] = useState<AttachedImage[]>([]);
  const [mod, setMod] = useState("⌘");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Label the submit shortcut correctly per-platform (Ctrl off Mac).
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
  };

  const canSubmit = idea.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    seedAndGo(idea);
    try {
      if (refs.length) sessionStorage.setItem("vibex-idea-refs", JSON.stringify(refs.map((r) => r.name)));
    } catch {
      /* ignore */
    }
    router.push("/interview");
  };

  const pickTemplate = (t: Template) => {
    seedAndGo(t.idea);
    router.push("/interview");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

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
            Describe your idea in a sentence or two. Vibex interviews you to fill in the gaps,
            locks a goal, then writes and runs every prompt until it&apos;s built.
          </p>

          <div className={styles.field}>
            <textarea
              ref={taRef}
              className={styles.textarea}
              value={idea}
              onChange={onChange}
              onKeyDown={onKeyDown}
              placeholder="e.g. a habit tracker with streaks and daily reminders…"
              rows={3}
              autoFocus
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
            <AttachButton
              className={styles.attachBtn}
              onPick={(imgs) => setRefs((r) => [...r, ...imgs])}
            />
            <span className={styles.attachLabel}>Attach a reference image (optional)</span>
          </div>

          <div className={styles.actions}>
            <span className={styles.hint}>
              <kbd>{mod}</kbd>
              <kbd>↵</kbd>
              <span>to start</span>
            </span>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={!canSubmit}
              onClick={submit}
            >
              Start interview →
            </button>
          </div>
        </section>

        <section className={styles.gallery}>
          <div className={styles.galleryHead}>
            <h2 className={styles.galleryTitle}>Or start from a template</h2>
            <p className={styles.gallerySub}>A proven starting point — you tweak everything in the interview.</p>
          </div>
          <div className={styles.grid}>
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className={styles.tpl} onClick={() => pickTemplate(t)}>
                <span className={styles.tplIcon} aria-hidden>{t.icon}</span>
                <span className={styles.tplText}>
                  <span className={styles.tplName}>{t.name}</span>
                  <span className={styles.tplBlurb}>{t.blurb}</span>
                </span>
                <span className={styles.tplCat}>{t.category}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
