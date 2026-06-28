"use client";

// Output view — a LIVE PREVIEW of the generated app (the static files inlined and run in a
// sandboxed iframe), the real file tree + viewer, the prompt history, and a real .zip download.
// When opened from a saved project, `files`/`history` come from the DB; otherwise it falls back
// to the sessionStorage spec and a sample.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { zipSync, strToU8 } from "fflate";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import type { GenFile } from "@/lib/steps";
import styles from "./result.module.css";

type Spec = { idea?: string; platform?: string; coder?: string; reviewer?: string };
export type HistoryRow = { step: string; role: "Coder" | "Reviewer"; tokens: number; cost: number };
type Tab = "preview" | "code" | "history";

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
}: {
  spec?: Spec;
  files?: GenFile[];
  history?: HistoryRow[];
}) {
  const [spec, setSpec] = useState<Spec>(specProp ?? {});
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<Tab>("preview");

  useEffect(() => {
    if (specProp) return;
    try {
      setSpec(JSON.parse(sessionStorage.getItem("vibex-spec") ?? "{}"));
    } catch {
      /* ignore */
    }
  }, [specProp]);

  const files = useMemo(() => (filesProp && filesProp.length ? filesProp : sampleFiles(spec)), [filesProp, spec]);
  const preview = useMemo(() => buildPreview(files), [files]);
  const history = historyProp && historyProp.length ? historyProp : SAMPLE_HISTORY;
  const totalTokens = history.reduce((s, h) => s + h.tokens, 0);
  const totalCost = history.reduce((s, h) => s + h.cost, 0);
  const safeActive = Math.min(active, files.length - 1);

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

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" aria-label="Vibex home">
          <Logo size={28} />
        </Link>
        <ThemeToggle />
      </header>

      <main className={styles.main}>
        <div className={styles.head}>
          <div>
            <span className={styles.eyebrow}><span className={styles.ok}>✓</span> Build complete</span>
            <h1 className={styles.title}>{spec.idea ?? "Your project"}</h1>
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

        <div className={styles.tabs}>
          {preview && (
            <button type="button" className={styles.tab} data-active={tab === "preview"} onClick={() => setTab("preview")}>
              Preview
            </button>
          )}
          <button type="button" className={styles.tab} data-active={tab === "code"} onClick={() => setTab("code")}>
            Code
          </button>
          <button type="button" className={styles.tab} data-active={tab === "history"} onClick={() => setTab("history")}>
            Prompt history
          </button>
        </div>

        {tab === "preview" && preview ? (
          <div className={styles.previewWrap}>
            <div className={styles.previewBar}>
              <span className={styles.previewDots}><i /><i /><i /></span>
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
                <button
                  key={f.path}
                  type="button"
                  className={styles.treeItem}
                  data-active={safeActive === i}
                  onClick={() => setActive(i)}
                >
                  <span className={styles.fileIcon}>›</span>
                  {f.path}
                </button>
              ))}
            </aside>
            <div className={styles.viewer}>
              <div className={styles.viewerBar}>{files[safeActive]?.path}</div>
              <pre className={styles.code}>{files[safeActive]?.content}</pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
