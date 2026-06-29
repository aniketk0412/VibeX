"use client";

// Dashboard project grid with client-side search + sort. Each card links to the project and
// carries a ProjectActions (rename / duplicate / delete) menu. Server passes plain serializable
// rows (updatedAt as a timestamp).

import { useMemo, useState } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/format";
import ProjectActions from "./ProjectActions";
import EmptyState from "./EmptyState";
import styles from "./ProjectGrid.module.css";

type Row = { id: string; title: string; status: string | null; updatedAt: number };
type Sort = "recent" | "name" | "status";

export default function ProjectGrid({ projects }: { projects: Row[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? projects.filter((p) => p.title.toLowerCase().includes(needle)) : projects.slice();
    if (sort === "name") list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "status") list.sort((a, b) => (a.status ?? "").localeCompare(b.status ?? "") || b.updatedAt - a.updatedAt);
    else list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }, [projects, q, sort]);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search projects…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search projects"
          />
        </div>
        <label className={styles.sort}>
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort projects">
            <option value="recent">Recently updated</option>
            <option value="name">Name A–Z</option>
            <option value="status">Status</option>
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        q ? (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            }
            title="No matches"
            body={<>Nothing matches “{q}”. Try a different name or clear the search.</>}
            actions={
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQ("")}>
                Clear search
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <path d="M12 11v5M9.5 13.5h5" />
              </svg>
            }
            title="No projects yet"
            body="Start your first build and it’ll show up here."
            actions={
              <Link href="/new" className="btn btn-primary btn-sm">
                New project →
              </Link>
            }
          />
        )
      ) : (
        <div className={styles.grid}>
          {shown.map((p) => (
            <div key={p.id} className={styles.proj}>
              <Link href={`/result?project=${p.id}`} className={styles.projLink}>
                <div className={styles.projTitle}>{p.title}</div>
                <div className={styles.projMeta}>
                  {p.status && <span className={styles.badge} data-s={p.status}>{p.status.toLowerCase()}</span>}
                  <span>Updated {timeAgo(new Date(p.updatedAt))}</span>
                </div>
              </Link>
              <div className={styles.projActions}>
                <ProjectActions projectId={p.id} title={p.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
