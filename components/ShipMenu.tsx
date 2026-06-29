"use client";

// "Ship ▾" dropdown that groups every export/deploy action for a generated project, so the
// result toolbar stays clean. Deploy options only appear for previewable (static) output with a
// saved project id.

import { useEffect, useRef, useState } from "react";
import OpenInStackBlitz from "./OpenInStackBlitz";
import DeployToVercel from "./DeployToVercel";
import DeployToNetlify from "./DeployToNetlify";
import ExportToGitHub from "./ExportToGitHub";
import type { GenFile } from "@/lib/steps";
import styles from "./ShipMenu.module.css";

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
      <button type="button" className="btn btn-ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Ship ▾
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <OpenInStackBlitz files={files} title={title} className={styles.item} />
          {projectId && previewable && <DeployToVercel projectId={projectId} className={styles.item} />}
          {projectId && previewable && <DeployToNetlify projectId={projectId} className={styles.item} />}
          {projectId && <ExportToGitHub projectId={projectId} className={styles.item} />}
          {onDownload && (
            <button type="button" className={styles.item} onClick={onDownload}>
              ⬇ Download .zip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
