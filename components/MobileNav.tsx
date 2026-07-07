"use client";

// Marketing-header nav for small screens. The desktop nav links hide ≤860px; this hamburger gives
// them back in an accessible dropdown (Escape / outside-click / navigate all close it).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./MobileNav.module.css";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
  { href: "/#faq", label: "FAQ" },
];

export default function MobileNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Move focus into the menu on open; Escape closes and returns focus to the toggle.
    menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); toggleRef.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className={styles.wrap} ref={ref}>
      <button ref={toggleRef} type="button" className={styles.toggle} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
        </svg>
      </button>
      {open && (
        <div ref={menuRef} className={styles.menu} role="menu">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={styles.item} role="menuitem" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          <div className={styles.sep} />
          {signedIn ? (
            <>
              <Link href="/dashboard" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>Dashboard</Link>
              <Link href="/settings" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>Settings</Link>
            </>
          ) : (
            <>
              <Link href="/signin" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>Sign in</Link>
              <Link href="/new" className={`${styles.item} ${styles.primary}`} role="menuitem" onClick={() => setOpen(false)}>Start free →</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
