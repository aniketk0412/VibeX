"use client";

// Generic confirm modal. Renders its own trigger button; on confirm it runs the supplied
// (already-bound) server action inside a transition, shows a pending state, and closes on success.
// Used for destructive actions — deleting a project, removing an API key.

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "@/lib/toast";
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
  successMessage,
}: {
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmAction: () => Promise<unknown>;
  onConfirmed?: () => void;
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  // Focus management (a11y). Keyed on `open` only so a pending change mid-action doesn't yank focus:
  //  • move focus into the dialog on open (Cancel first — the safe default for a destructive action)
  //  • trap Tab inside the dialog so it can't wander to the page behind the modal
  //  • return focus to the trigger on close
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = () => (dialog ? Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled])")) : []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length < 2) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    dialog?.addEventListener("keydown", onKey);
    return () => { dialog?.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open]);

  const confirm = () =>
    start(async () => {
      await confirmAction();
      setOpen(false);
      if (successMessage) toast.success(successMessage);
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
          <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
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
