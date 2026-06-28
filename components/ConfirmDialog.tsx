"use client";

// Generic confirm modal. Renders its own trigger button; on confirm it runs the supplied
// (already-bound) server action inside a transition, shows a pending state, and closes on success.
// Used for destructive actions — deleting a project, removing an API key.

import { useEffect, useState, useTransition } from "react";
import styles from "./ConfirmDialog.module.css";

export default function ConfirmDialog({
  triggerLabel,
  triggerClassName,
  triggerAriaLabel,
  title,
  message,
  confirmLabel = "Confirm",
  confirmAction,
  onConfirmed,
}: {
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmAction: () => Promise<unknown>;
  onConfirmed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  const confirm = () =>
    start(async () => {
      await confirmAction();
      setOpen(false);
      onConfirmed?.();
    });

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-label={triggerAriaLabel}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>

      {open && (
        <div className={styles.overlay} onMouseDown={() => !pending && setOpen(false)}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.message}>{message}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className={styles.confirm} onClick={confirm} disabled={pending} aria-busy={pending}>
                {pending ? <span className="spinner" aria-hidden /> : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
