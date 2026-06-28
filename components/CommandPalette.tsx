"use client";

// Global command palette. Open with Cmd/Ctrl+K (or a "vibex:command-palette" CustomEvent),
// filter, arrow-key navigate, Enter to run, Escape to close. Mounted once in the root layout.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/app/actions";
import styles from "./CommandPalette.module.css";

type Command = {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
};

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setIndex(0);
  }, []);

  const toggleTheme = useCallback(() => {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("vibex-theme", next);
    } catch {
      /* ignore */
    }
  }, []);

  const commands = useMemo<Command[]>(
    () => [
      { id: "new", label: "New project", hint: "Build", keywords: "create build start", run: () => router.push("/new") },
      { id: "dashboard", label: "Go to Dashboard", hint: "Nav", keywords: "projects home", run: () => router.push("/dashboard") },
      { id: "settings", label: "Open Settings", hint: "Nav", keywords: "account keys api plan", run: () => router.push("/settings") },
      { id: "pricing", label: "View Pricing", hint: "Nav", keywords: "plans billing upgrade", run: () => router.push("/pricing") },
      { id: "home", label: "Go to Home", hint: "Nav", keywords: "landing", run: () => router.push("/") },
      { id: "theme", label: "Toggle light / dark theme", hint: "Theme", keywords: "dark light mode appearance", run: toggleTheme },
      { id: "signout", label: "Sign out", hint: "Account", keywords: "logout leave", run: () => void signOutAction() },
    ],
    [router, toggleTheme],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => (c.label + " " + (c.keywords ?? "")).toLowerCase().includes(q));
  }, [commands, query]);

  // Open with Cmd/Ctrl+K, or a custom event other UI can dispatch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("vibex:command-palette", onOpen as EventListener);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("vibex:command-palette", onOpen as EventListener);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  const run = (c: Command) => {
    close();
    c.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = results[index];
      if (c) run(c);
    }
  };

  return (
    <div className={styles.overlay} onMouseDown={close}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Type a command or search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Command search"
        />
        <div className={styles.list} role="listbox">
          {results.length === 0 ? (
            <div className={styles.empty}>No matching commands</div>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={i === index}
                className={styles.item}
                data-active={i === index}
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(c)}
              >
                <span className={styles.itemLabel}>{c.label}</span>
                {c.hint && <span className={styles.itemHint}>{c.hint}</span>}
              </button>
            ))
          )}
        </div>
        <div className={styles.footer}>
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
