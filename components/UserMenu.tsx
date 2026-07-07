"use client";

// Avatar button that opens a small account dropdown: identity (name + email), a link to
// Settings, and Sign out. Used in the header of every authenticated screen so the user is
// always one click from their account and from leaving.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/app/actions";
import styles from "./UserMenu.module.css";

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function UserMenu({
  name,
  email,
  image,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // Open upward when the avatar is near the bottom of the viewport (e.g. sidebar footer),
      // so the menu doesn't spill off the bottom of the screen.
      setDropUp(window.innerHeight - rect.bottom < 260);
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    // Move focus into the menu on open; Escape closes and returns focus to the avatar button.
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className={styles.avatar}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className={styles.img} referrerPolicy="no-referrer" />
        ) : (
          <span className={styles.initials}>{initials(name, email)}</span>
        )}
      </button>

      {open && (
        <div ref={menuRef} className={`${styles.menu} ${dropUp ? styles.menuUp : ""}`} role="menu">
          <div className={styles.identity}>
            <span className={styles.name}>{name || "Signed in"}</span>
            {email && <span className={styles.email}>{email}</span>}
          </div>
          <div className={styles.sep} />
          <Link href="/dashboard" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Dashboard
          </Link>
          <Link href="/settings" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Settings
          </Link>
          <div className={styles.sep} />
          <form action={signOutAction}>
            <button type="submit" className={`${styles.item} ${styles.signout}`} role="menuitem">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
