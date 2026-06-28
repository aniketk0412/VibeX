"use client";

// Per-project actions: rename (modal), duplicate (respects the free-plan cap), and delete
// (confirm). Calls owner-scoped server actions directly. Reused on dashboard cards and the
// result-page toolbar — pass redirectAfterDelete when the current page IS the project (so we
// leave it once it's gone).

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameProject, deleteProject, duplicateProject } from "@/app/actions";
import { toast } from "@/lib/toast";
import styles from "./ProjectActions.module.css";

export default function ProjectActions({
  projectId,
  title,
  redirectAfterDelete,
}: {
  projectId: string;
  title: string;
  redirectAfterDelete?: string;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(title);
  const [pending, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setName(title), [title]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  const doRename = () =>
    start(async () => {
      await renameProject(projectId, name);
      setRenameOpen(false);
      toast.success("Project renamed");
      router.refresh();
    });

  const doDelete = () =>
    start(async () => {
      await deleteProject(projectId);
      setDeleteOpen(false);
      toast.success("Project deleted");
      if (redirectAfterDelete) router.push(redirectAfterDelete);
      else router.refresh();
    });

  const doDuplicate = () => {
    setMenu(false);
    start(async () => {
      const res = await duplicateProject(projectId);
      if (res.id) {
        toast.success("Project duplicated");
        router.push(`/result?project=${res.id}`);
      } else if (res.error === "free_limit") {
        toast.error("Free plan is limited to 1 project — upgrade to duplicate.");
      } else {
        toast.error("Couldn’t duplicate this project.");
      }
    });
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Project actions"
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((v) => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {menu && (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.item} onClick={() => { setMenu(false); setRenameOpen(true); }}>
            Rename
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={doDuplicate}>
            Duplicate
          </button>
          <button type="button" role="menuitem" className={`${styles.item} ${styles.danger}`} onClick={() => { setMenu(false); setDeleteOpen(true); }}>
            Delete
          </button>
        </div>
      )}

      {renameOpen && (
        <div className={styles.overlay} onMouseDown={() => !pending && setRenameOpen(false)}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Rename project" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className={styles.dTitle}>Rename project</h2>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) doRename(); }}
            />
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => setRenameOpen(false)} disabled={pending}>Cancel</button>
              <button type="button" className={styles.save} onClick={doRename} disabled={pending || !name.trim()} aria-busy={pending}>
                {pending ? <span className="spinner" aria-hidden /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className={styles.overlay} onMouseDown={() => !pending && setDeleteOpen(false)}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Delete project" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className={styles.dTitle}>Delete this project?</h2>
            <p className={styles.dMsg}>
              “{title}” and its generated files will be permanently removed. This can’t be undone.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => setDeleteOpen(false)} disabled={pending}>Cancel</button>
              <button type="button" className={styles.confirmDanger} onClick={doDelete} disabled={pending} aria-busy={pending}>
                {pending ? <span className="spinner" aria-hidden /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
