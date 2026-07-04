"use client";

// Output view. Two layouts share one canvas (live preview + file tree + prompt history + .zip):
//  • Saved project (opened from the dashboard) → a full app-shell: left sidebar with the user's
//    projects + account, a workspace toolbar (back, title, status, actions), and the canvas.
//  • Anonymous / sample run → a simple standalone page.
// When opened from a saved project, files/history come from the DB; otherwise it falls back to the
// sessionStorage spec and a sample.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { zipSync, strToU8 } from "fflate";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import BackLink from "@/components/BackLink";
import ProjectActions from "@/components/ProjectActions";
import ShipMenu from "@/components/ShipMenu";
import { buildPreview } from "@/lib/preview";
import type { GenFile } from "@/lib/steps";
import styles from "./result.module.css";

// The editor is client-only (CodeMirror needs the DOM), loaded on demand.
const CodeIDE = dynamic(() => import("@/components/CodeIDE"), {
  ssr: false,
  loading: () => <div className={styles.ideLoading}>Loading editor…</div>,
});

type Spec = { idea?: string; platform?: string; coder?: string; reviewer?: string };
export type HistoryRow = { step: string; role: "Coder" | "Reviewer"; tokens: number; cost: number };
type Tab = "editor" | "history";
type ProjectLink = { id: string; title: string; status?: string | null };
type CurrentMeta = { id: string; title: string; status?: string | null };
type SessionUser = { name?: string | null; email?: string | null; image?: string | null };
type RunVersion = { id: string; startedAt: number; status: string };

// Deterministic date label (no toLocaleString — server/client timezones may differ under SSR).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function versionLabel(v: RunVersion, index: number, total: number): string {
  const d = new Date(v.startedAt);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `v${total - index} · ${MONTHS[d.getMonth()]} ${d.getDate()}, ${hh}:${mm}${v.status === "COMPLETED" ? "" : ` (${v.status.toLowerCase()})`}`;
}

function sampleFiles(spec: Spec): GenFile[] {
  const title = spec.idea ?? "Your app";
  return [
    {
      path: "index.html",
      content: `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="styles.css"></head>\n<body><main class="app"><h1>${title}</h1><p>Built by Vibex.</p></main><script src="app.js"></script></body></html>\n`,
    },
    {
      path: "styles.css",
      content: `body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0f0e0b;color:#f2ede2}.app{text-align:center}h1{color:#d4a853}`,
    },
    { path: "app.js", content: `console.log(${JSON.stringify(title)});\n` },
  ];
}

const SAMPLE_HISTORY: HistoryRow[] = [
  { step: "index.html", role: "Coder", tokens: 3120, cost: 0 },
  { step: "styles.css", role: "Coder", tokens: 2480, cost: 0 },
  { step: "app.js", role: "Coder", tokens: 4210, cost: 0 },
  { step: "Review & finalize", role: "Reviewer", tokens: 870, cost: 0 },
];

export default function ResultView({
  spec: specProp,
  files: filesProp,
  history: historyProp,
  projects,
  current,
  user,
  runs,
  currentRunId,
}: {
  spec?: Spec;
  files?: GenFile[];
  history?: HistoryRow[];
  projects?: ProjectLink[];
  current?: CurrentMeta;
  user?: SessionUser;
  runs?: RunVersion[];
  currentRunId?: string;
}) {
  const router = useRouter();
  const [spec, setSpec] = useState<Spec>(specProp ?? {});
  const [tab, setTab] = useState<Tab>("editor");
  const [collapsed, setCollapsed] = useState(false);
  const inShell = !!projects;

  // Restore the sidebar's collapsed state (set after mount to avoid a hydration mismatch).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("vibex-sidebar-collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebar = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("vibex-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  useEffect(() => {
    if (specProp) return;
    try {
      setSpec(JSON.parse(sessionStorage.getItem("vibex-spec") ?? "{}"));
    } catch {
      /* ignore */
    }
  }, [specProp]);

  // For a saved project we never fake sample files — an empty build shows a real empty state.
  const files = useMemo<GenFile[]>(() => {
    if (filesProp && filesProp.length) return filesProp;
    if (current) return [];
    return sampleFiles(spec);
  }, [filesProp, spec, current]);

  const preview = useMemo(() => buildPreview(files), [files]);
  const history = historyProp && historyProp.length ? historyProp : current ? [] : SAMPLE_HISTORY;
  const totalTokens = history.reduce((s, h) => s + h.tokens, 0);
  const totalCost = history.reduce((s, h) => s + h.cost, 0);
  const isEmpty = files.length === 0;

  const download = () => {
    const entries: Record<string, Uint8Array> = {};
    for (const f of files) entries[f.path] = strToU8(f.content);
    const zipped = zipSync(entries, { level: 6 });
    const blob = new Blob([zipped], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vibex-output.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const title = current?.title ?? spec.idea ?? "Your project";
  const status = current?.status ?? null;

  // ── empty / failed build state (saved project with no files) ───────────
  const failedBuild = status === "FAILED" || status === "INTERRUPTED";
  const models = [spec.coder, spec.reviewer].filter(Boolean).join(" + ");
  const emptyState = current && (
    <div className={styles.emptyCanvas}>
      <div className={styles.emptyIcon} data-tone={failedBuild ? "warn" : "ok"} aria-hidden>
        {failedBuild ? (
          "!"
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M13 2 4.5 13.5H11l-1 8.5L18.5 10.5H12l1-8.5z" />
          </svg>
        )}
      </div>
      <h2 className={styles.emptyTitle}>
        {status === "FAILED"
          ? "This build didn't finish"
          : status === "INTERRUPTED"
            ? "This build was interrupted"
            : "Ready to build"}
      </h2>
      <p className={styles.emptyText}>
        {failedBuild
          ? "The last run didn't produce any files. You can run it again from your locked goal below."
          : "Your goal is locked in. Start the build and Vibex will generate the code step by step."}
      </p>

      {(spec.idea || spec.platform || models) && (
        <div className={styles.specCard}>
          {spec.idea && (
            <div className={styles.specRow}>
              <span className={styles.specKey}>Goal</span>
              <span className={styles.specVal}>{spec.idea}</span>
            </div>
          )}
          {spec.platform && (
            <div className={styles.specRow}>
              <span className={styles.specKey}>Platform</span>
              <span className={styles.specVal}>{spec.platform}</span>
            </div>
          )}
          {models && (
            <div className={styles.specRow}>
              <span className={styles.specKey}>Models</span>
              <span className={styles.specVal}>{models}</span>
            </div>
          )}
        </div>
      )}

      <Link href={`/run?project=${current.id}`} className="btn btn-primary btn-lg">
        {failedBuild ? "Try again →" : "Start build →"}
      </Link>
    </div>
  );

  // ── shared canvas (tabs + body) ────────────────────────────────────────
  const tabs = !isEmpty && (
    <div className={styles.tabs} role="tablist">
      <button type="button" role="tab" className={styles.tab} aria-selected={tab === "editor"} data-active={tab === "editor"} onClick={() => setTab("editor")}>
        Editor
      </button>
      <button type="button" role="tab" className={styles.tab} aria-selected={tab === "history"} data-active={tab === "history"} onClick={() => setTab("history")}>
        Build log
        {history.length > 0 && <span className={styles.tabCount}>{history.length}</span>}
      </button>
    </div>
  );

  const body = isEmpty ? (
    inShell ? <div className={styles.canvasPad}>{emptyState}</div> : emptyState
  ) : tab === "history" ? (
    // Build log — what each agent did, in order, with what it cost. A real table (headers,
    // aligned numerics, role chips) instead of a vague list of rows.
    <div className={inShell ? styles.canvasPad : undefined}>
      <div className={styles.log}>
        <div className={`${styles.logRow} ${styles.logHead}`} aria-hidden>
          <span>#</span>
          <span>Action</span>
          <span>Agent</span>
          <span className={styles.logNum}>Tokens</span>
          <span className={styles.logNum}>Cost</span>
        </div>
        {history.map((h, i) => {
          // Simulated runs persist "(generated)" placeholders — show something human instead.
          const label = h.step === "(generated)" ? (h.role === "Reviewer" ? "Review & finalize" : "Generated file") : h.step;
          const isFile = h.role === "Coder" && /^[\w./-]+\.\w+$/.test(label);
          return (
            <div key={i} className={styles.logRow}>
              <span className={styles.logIdx}>{i + 1}</span>
              <span className={styles.logAction} title={label}>
                {isFile ? (
                  <>
                    <span className={styles.logVerb}>Wrote </span>
                    <code className={styles.logPath}>{label}</code>
                  </>
                ) : (
                  label
                )}
              </span>
              <span><span className={styles.agent} data-role={h.role}>{h.role}</span></span>
              <span className={`${styles.logNum} ${styles.logMeta}`}>{(h.tokens / 1000).toFixed(1)}k</span>
              <span className={`${styles.logNum} ${styles.logMeta}`}>${h.cost.toFixed(2)}</span>
            </div>
          );
        })}
        <div className={styles.logTotal}>
          <span>{history.length} steps</span>
          <span>{(totalTokens / 1000).toFixed(1)}k tokens · ~${totalCost.toFixed(2)}</span>
        </div>
      </div>
    </div>
  ) : (
    <div className={styles.ideHost}>
      {/* Save writes to the LATEST run — hide it when viewing an older version so an edit can't
          silently overwrite the newest build from a stale base. */}
      <CodeIDE files={files} projectId={!runs || !currentRunId || runs[0]?.id === currentRunId ? current?.id : undefined} />
    </div>
  );

  // ── app-shell layout (saved project) ───────────────────────────────────
  if (inShell) {
    return (
      <div className={styles.shell}>
        <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""}`}>
          <div className={styles.sideInner}>
            <div className={styles.sideTop}>
              <Link href="/" aria-label="Vibex home" className={styles.sideLogo}>
                <Logo size={26} />
              </Link>
              <button type="button" className={styles.collapseBtn} onClick={toggleSidebar} aria-label="Collapse sidebar" title="Collapse sidebar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            </div>
            <div className={styles.sideBack}>
              <BackLink href="/dashboard" label="Dashboard" />
            </div>
            <Link href="/new" className={`btn btn-primary ${styles.sideNew}`}>New project →</Link>

          <nav className={styles.sideNav}>
            <Link href="/settings" className={styles.sideLink}>Settings</Link>
          </nav>

          <div className={styles.sideHead}>Projects</div>
          <div className={styles.sideList}>
            {projects!.map((p) => (
              <Link
                key={p.id}
                href={`/result?project=${p.id}`}
                className={styles.sideProj}
                data-active={p.id === current?.id}
                title={p.title}
              >
                <span className={styles.sideProjTitle}>{p.title}</span>
                {p.status && <span className={styles.sideDot} data-s={p.status} aria-hidden />}
              </Link>
            ))}
          </div>

            <div className={styles.sideFoot}>
              <ThemeToggle />
              <UserMenu name={user?.name} email={user?.email} image={user?.image} />
            </div>
          </div>
        </aside>

        <div className={styles.workspace}>
          {/* Row 1 — toolbar: identity (title · status · version) left, actions right. */}
          <header className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              {collapsed && (
                <button type="button" className={styles.expandBtn} onClick={toggleSidebar} aria-label="Show sidebar" title="Show sidebar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
                </button>
              )}
              <h1 className={styles.toolbarTitle}>{title}</h1>
              {status && <span className={styles.statusBadge} data-s={status}>{status.toLowerCase()}</span>}
              {runs && runs.length > 1 && (
                <select
                  className={styles.runPicker}
                  value={currentRunId}
                  onChange={(e) => router.push(`/result?project=${current!.id}&run=${e.target.value}`)}
                  aria-label="Build version"
                  suppressHydrationWarning
                >
                  {runs.map((v, i) => (
                    <option key={v.id} value={v.id} suppressHydrationWarning>
                      {versionLabel(v, i, runs.length)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className={styles.toolbarActions}>
              {!isEmpty && (
                <ShipMenu files={files} title={title} projectId={current!.id} previewable={!!preview} onDownload={download} />
              )}
              {!isEmpty && <Link href={`/run?project=${current!.id}&iterate=1`} className="btn btn-ghost btn-sm">Iterate</Link>}
              <ProjectActions projectId={current!.id} title={title} redirectAfterDelete="/dashboard" />
            </div>
          </header>

          {/* Row 2 — metabar: view tabs left, the build's vitals right. */}
          {!isEmpty && (
            <div className={styles.metabar}>
              {tabs}
              <div className={styles.stats} aria-label="Build metrics">
                <span className={styles.stat}><b>{files.length}</b> files</span>
                <span className={styles.stat}><b>{(totalTokens / 1000).toFixed(1)}k</b> tokens</span>
                <span className={styles.stat}><b>~${totalCost.toFixed(2)}</b> est. cost</span>
                <span className={`${styles.stat} ${styles.statWide}`}><b>{spec.coder ?? "Claude"}</b> + <b>{spec.reviewer ?? "Claude"}</b></span>
              </div>
            </div>
          )}

          <div className={styles.canvas}>{body}</div>
        </div>
      </div>
    );
  }

  // ── standalone layout (anonymous / sample) ─────────────────────────────
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" aria-label="Vibex home">
          <Logo size={28} />
        </Link>
        <div className={styles.left}>
          <BackLink href="/" label="Home" />
          <ThemeToggle />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.head}>
          <div>
            <span className={styles.eyebrow}>
              <span className={styles.ok} aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </span>
              Build complete
            </span>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.sub}>
              {files.length} files · {(totalTokens / 1000).toFixed(1)}k tokens · ~${totalCost.toFixed(2)} ·
              {" "}{spec.coder ?? "Claude Sonnet"} + {spec.reviewer ?? "Claude Opus"}
            </p>
          </div>
          <div className={styles.headActions}>
            <button type="button" className="btn btn-ghost" onClick={download}>Download .zip</button>
            <Link href="/new" className="btn btn-primary">New project →</Link>
          </div>
        </div>

        {tabs}
        {body}
      </main>
    </div>
  );
}
