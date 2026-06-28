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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
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
        type="button"
        className={styles.avatar}
        onClick={() => setOpen((v) => !v)}
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
        <div className={styles.menu} role="menu">
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
