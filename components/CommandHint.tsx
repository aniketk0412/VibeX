"use client";

// Small keycap pill that opens the command palette (and advertises the Cmd/Ctrl+K shortcut).

import { useEffect, useState } from "react";
import styles from "./CommandHint.module.css";

export default function CommandHint() {
  const [mac, setMac] = useState(true);

  useEffect(() => {
    setMac(/mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent));
  }, []);

  return (
    <button
      type="button"
      className={styles.hint}
      onClick={() => document.dispatchEvent(new CustomEvent("vibex:command-palette"))}
      aria-label="Open command palette"
      title="Command palette"
    >
      <span className={styles.k}>{mac ? "⌘" : "Ctrl"}</span>
      <span className={styles.k}>K</span>
    </button>
  );
}
