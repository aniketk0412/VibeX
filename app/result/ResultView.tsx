"use client";

// Output view. Two layouts share one canvas (live preview + file tree + prompt history + .zip):
//  • Saved project (opened from the dashboard) → a full app-shell: left sidebar with the user's
//    projects + account, a workspace toolbar (back, title, status, actions), and the canvas.
//  • Anonymous / sample run → a simple standalone page.
// When opened from a saved project, files/history come from the DB; otherwise it falls back to the
// sessionStorage spec and a sample.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { zipSync, strToU8 } from "fflate";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import BackLink from "@/components/BackLink";
import ProjectActions from "@/components/ProjectActions";
import CopyButton from "@/components/CopyButton";
import type { GenFile } from "@/lib/steps";
import styles from "./result.module.css";

type Spec = { idea?: string; platform?: string; coder?: string; reviewer?: string };
export type HistoryRow = { step: string; role: "Coder" | "Reviewer"; tokens: number; cost: number };
type Tab = "preview" | "code" | "history";
type ProjectLink = { id: string; title: string; status?: string | null };
type CurrentMeta = { id: string; title: string; status?: string | null };
type SessionUser = { name?: string | null; email?: string | null; image?: string | null };

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Inline CSS/JS into the HTML so the static app runs standalone inside an iframe (no server).
// Returns null when there's no HTML entry (API / CLI projects aren't previewable).
function buildPreview(files: GenFile[]): string | null {
  const html = files.find((f) => /\.html$/i.test(f.path));
  if (!html) return null;
  let doc = html.content;
  for (const f of files.filter((x) => /\.css$/i.test(x.path))) {
    const name = f.path.split("/").pop() ?? f.path;
    const re = new RegExp(`<link[^>]*href=["'][^"']*${escapeRe(name)}["'][^>]*>`, "gi");
    doc = doc.replace(re, `<style>\n${f.content}\n</style>`);
  }
  for (const f of files.filter((x) => /\.js$/i.test(x.path))) {
    const name = f.path.split("/").pop() ?? f.path;
    const re = new RegExp(`<script[^>]*src=["'][^"']*${escapeRe(name)}["'][^>]*>\\s*</script>`, "gi");
    doc = doc.replace(re, `<script>\n${f.content}\n</script>`);
  }
  return doc;
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
      content: `body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#14110f;color:#f4eee6}.app{text-align:center}h1{color:#ff5a1f}`,
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
}: {
  spec?: Spec;
  files?: GenFile[];
  history?: HistoryRow[];
  projects?: ProjectLink[];
  current?: CurrentMeta;
  user?: SessionUser;
}) {
  const [spec, setSpec] = useState<Spec>(specProp ?? {});
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<Tab>("preview");
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
  const safeActive = Math.min(active, Math.max(0, files.length - 1));
  const isEmpty = files.length === 0;

  // If this project isn't previewable (no HTML), don't sit on an empty Preview tab.
  useEffect(() => {
    if (!preview && tab === "preview") setTab("code");
  }, [preview, tab]);

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

  const openPreview = () => {
    if (!preview) return;
    const url = URL.createObjectURL(new Blob([preview], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
      {preview && (
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === "preview"} data-active={tab === "preview"} onClick={() => setTab("preview")}>
          Preview
        </button>
      )}
      <button type="button" role="tab" className={styles.tab} aria-selected={tab === "code"} data-active={tab === "code"} onClick={() => setTab("code")}>
        Code
      </button>
      <button type="button" role="tab" className={styles.tab} aria-selected={tab === "history"} data-active={tab === "history"} onClick={() => setTab("history")}>
        Prompt history
      </button>
    </div>
  );

  const body = isEmpty ? (
    emptyState
  ) : tab === "preview" && preview ? (
    <div className={styles.previewWrap}>
      <div className={styles.previewBar}>
        <span className={styles.previewDots} aria-hidden><i /><i /><i /></span>
        <span className={styles.previewLabel}>live preview · index.html</span>
        <button type="button" className={styles.previewOpen} onClick={openPreview}>Open ↗</button>
      </div>
      <iframe
        className={styles.preview}
        srcDoc={preview}
        title="Live preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
      />
    </div>
  ) : tab === "history" ? (
    <div className={styles.history}>
      {history.map((h, i) => (
        <div key={i} className={styles.hrow}>
          <span className={styles.hnum}>{i + 1}</span>
          <span className={styles.hstep}>{h.step}</span>
          <span className={styles.hrole} data-role={h.role}>{h.role}</span>
          <span className={styles.hmeta}>{(h.tokens / 1000).toFixed(1)}k · ${h.cost.toFixed(2)}</span>
        </div>
      ))}
      <div className={styles.htotal}>
        <span>Total</span>
        <span>{(totalTokens / 1000).toFixed(1)}k tokens · ~${totalCost.toFixed(2)}</span>
      </div>
    </div>
  ) : (
    <div className={styles.codeWrap}>
      <aside className={styles.tree}>
        {files.map((f, i) => (
          <button key={f.path} type="button" className={styles.treeItem} data-active={safeActive === i} onClick={() => setActive(i)}>
            <span className={styles.fileIcon}>›</span>
            {f.path}
          </button>
        ))}
      </aside>
      <div className={styles.viewer}>
        <div className={styles.viewerBar}>
          <span className={styles.viewerPath}>{files[safeActive]?.path}</span>
          {files[safeActive] && <CopyButton text={files[safeActive].content} />}
        </div>
        <pre className={styles.code}>{files[safeActive]?.content}</pre>
      </div>
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
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <div className={styles.toolbarTitleWrap}>
                {collapsed && (
                  <button type="button" className={styles.expandBtn} onClick={toggleSidebar} aria-label="Show sidebar" title="Show sidebar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
                  </button>
                )}
                <h1 className={styles.toolbarTitle}>{title}</h1>
                {status && <span className={styles.statusBadge} data-s={status}>{status.toLowerCase()}</span>}
              </div>
            </div>
            <div className={styles.toolbarActions}>
              {!isEmpty && <button type="button" className="btn btn-ghost" onClick={download}>↓ Download .zip</button>}
              {!isEmpty && <Link href={`/run?project=${current!.id}`} className="btn btn-ghost">Iterate</Link>}
              <ProjectActions projectId={current!.id} title={title} redirectAfterDelete="/dashboard" />
            </div>
          </div>
          {!isEmpty && (
            <p className={styles.workspaceSub}>
              {files.length} files · {(totalTokens / 1000).toFixed(1)}k tokens · ~${totalCost.toFixed(2)} · {spec.coder ?? "Claude"} + {spec.reviewer ?? "Claude"}
            </p>
          )}
          {tabs}
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
            <span className={styles.eyebrow}><span className={styles.ok}>✓</span> Build complete</span>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.sub}>
              {files.length} files · {(totalTokens / 1000).toFixed(1)}k tokens · ~${totalCost.toFixed(2)} ·
              {" "}{spec.coder ?? "Claude Sonnet"} + {spec.reviewer ?? "Claude Opus"}
            </p>
          </div>
          <div className={styles.headActions}>
            <button type="button" className="btn btn-ghost" onClick={download}>↓ Download .zip</button>
            <Link href="/new" className="btn btn-primary">New project →</Link>
          </div>
        </div>

        {tabs}
        {body}
      </main>
    </div>
  );
}
