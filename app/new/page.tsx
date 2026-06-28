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

// Short chip label, richer fill — clicking drops a fully-formed idea into the box.
const EXAMPLES = [
  { label: "Habit tracker", value: "A habit tracker with streaks, daily reminders, and weekly progress charts" },
  { label: "Finance dashboard", value: "A personal finance dashboard that imports CSV bank statements and breaks down spending by category" },
  { label: "Markdown blog", value: "A markdown blog with tags, full-text search, and an RSS feed" },
  { label: "Trivia game", value: "A multiplayer trivia game with live scoring and shareable rooms" },
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

  const fillExample = (value: string) => {
    setIdea(value);
    const el = taRef.current;
    if (el) {
      el.focus();
      requestAnimationFrame(() => grow(el));
    }
  };

  const canSubmit = idea.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    try {
      sessionStorage.setItem("vibex-idea", idea.trim());
      if (refs.length) sessionStorage.setItem("vibex-idea-refs", JSON.stringify(refs.map((r) => r.name)));
    } catch {
      /* sessionStorage may be unavailable — proceed anyway */
    }
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" aria-label="Vibex home">
            <Logo size={28} />
          </Link>
          <BackLink href="/" label="Back" />
        </div>
        <ThemeToggle />
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

          <div className={styles.chips}>
            <span className={styles.chipsLabel}>Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className={styles.chip}
                onClick={() => fillExample(ex.value)}
              >
                {ex.label}
              </button>
            ))}
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
      </main>
    </div>
  );
}
