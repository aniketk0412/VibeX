"use client";

// Renders the global toast queue (see lib/toast). Mounted once in the root layout.

import { useEffect, useState } from "react";
import { subscribe, dismissToast, type Toast } from "@/lib/toast";
import styles from "./Toaster.module.css";

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribe(setToasts), []);

  if (!toasts.length) return null;

  return (
    <div className={styles.wrap} role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast} data-kind={t.kind}>
          <span className={styles.icon} aria-hidden>
            {t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "•"}
          </span>
          <span className={styles.msg}>{t.message}</span>
          <button type="button" className={styles.close} onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
