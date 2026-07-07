"use client";

// "Ship ▾" dropdown that groups every export/deploy action for a generated project, so the
// result toolbar stays clean. Deploy options only appear for previewable (static) output with a
// saved project id.

import { useEffect, useRef, useState } from "react";
import OpenInStackBlitz from "./OpenInStackBlitz";
import DeployToVercel from "./DeployToVercel";
import DeployToNetlify from "./DeployToNetlify";
import ExportToGitHub from "./ExportToGitHub";
import { toast } from "@/lib/toast";
import type { GenFile } from "@/lib/steps";
import styles from "./ShipMenu.module.css";

// Native bridge exposed by the Vibex desktop app (Electron preload). Absent in browsers —
// the "Save to folder" item only renders when the site runs inside the desktop shell.
declare global {
  interface Window {
    vibexDesktop?: {
      version: string;
      saveProject: (payload: { name?: string; files: GenFile[] }) => Promise<{
        ok?: boolean;
        written?: number;
        dir?: string;
        canceled?: boolean;
        error?: string;
      }>;
    };
  }
}

export default function ShipMenu({
  files,
  title,
  projectId,
  previewable,
  onDownload,
}: {
  files: GenFile[];
  title?: string;
  projectId?: string;
  previewable?: boolean;
  onDownload?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Move focus into the menu on open; Escape closes and returns focus to the trigger.
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
      <button ref={btnRef} type="button" className="btn btn-primary btn-sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Ship
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div ref={menuRef} className={styles.menu} role="menu">
          <OpenInStackBlitz files={files} title={title} className={styles.item} />
          {projectId && previewable && <DeployToVercel projectId={projectId} className={styles.item} />}
          {projectId && previewable && <DeployToNetlify projectId={projectId} className={styles.item} />}
          {projectId && <ExportToGitHub projectId={projectId} className={styles.item} />}
          {onDownload && (
            <button type="button" className={styles.item} onClick={onDownload}>
              Download .zip
            </button>
          )}
          {typeof window !== "undefined" && window.vibexDesktop && (
            <button
              type="button"
              className={styles.item}
              onClick={async () => {
                setOpen(false);
                const r = await window.vibexDesktop!.saveProject({ name: title, files });
                if (r.ok) toast.success(`${r.written} files saved to ${r.dir}`);
                else if (!r.canceled) toast.error("Couldn't save the project");
              }}
            >
              Save to folder…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
