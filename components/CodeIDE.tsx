"use client";

// In-app IDE — Monaco (the actual VS Code editor) with a live preview beside it. Real editor
// affordances: per-file models with their own undo stacks, open-file tabs, Ctrl+P quick-open,
// find/replace, multi-cursor, minimap, HTML/CSS/JS IntelliSense. Edit any generated file and
// the preview re-renders instantly; Save persists edits back to the project. Loaded client-only
// (dynamic ssr:false from the host views); Monaco itself arrives lazily via the loader CDN, so
// the app bundle stays lean.

import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader, type BeforeMount, type OnMount } from "@monaco-editor/react";

// Self-hosted Monaco: the AMD build is staged into /public by scripts/copy-monaco.mjs (part of
// `npm run build`; `npm run monaco` locally after a fresh install). Same-origin only — no
// third-party CDN at runtime.
if (typeof window !== "undefined") {
  loader.config({ paths: { vs: "/monaco/vs" } });
}
import type { GenFile } from "@/lib/steps";
import { buildPreview } from "@/lib/preview";
import { saveProjectFiles } from "@/app/actions";
import { toast } from "@/lib/toast";
import styles from "./CodeIDE.module.css";

type View = "split" | "code" | "preview";

function langFor(path: string): string {
  if (/\.html?$/i.test(path)) return "html";
  if (/\.css$/i.test(path)) return "css";
  if (/\.tsx?$/i.test(path)) return "typescript";
  if (/\.(js|jsx|mjs|cjs)$/i.test(path)) return "javascript";
  if (/\.md$/i.test(path)) return "markdown";
  if (/\.json$/i.test(path)) return "json";
  return "plaintext";
}

// The editor stays brand-ink in BOTH site themes (like the app's other code surfaces).
const defineInkTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("vibex-ink", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#14120e",
      "editor.lineHighlightBackground": "#1d1913",
      "editorLineNumber.foreground": "#59503e",
      "editorLineNumber.activeForeground": "#a89877",
      "editorIndentGuide.background1": "#211d16",
      "editorCursor.foreground": "#d4a853",
      "editor.selectionBackground": "#3a3018",
      "minimap.background": "#14120e",
      "scrollbarSlider.background": "#2a251b80",
      "scrollbarSlider.hoverBackground": "#3a3324a0",
    },
  });
};

// Injected into the preview so the running app's console + errors stream back to the Console panel.
const CONSOLE_BRIDGE = `<script>(function(){function s(l,a){try{parent.postMessage({__vibexlog:1,level:l,text:Array.prototype.map.call(a,function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ')},'*')}catch(e){}}['log','info','warn','error'].forEach(function(l){var o=console[l];console[l]=function(){s(l,arguments);if(o)o.apply(console,arguments)}});window.addEventListener('error',function(e){s('error',[e.message+' ('+(e.filename||'').split('/').pop()+':'+(e.lineno||'')+')'])});window.addEventListener('unhandledrejection',function(e){s('error',['Unhandled rejection: '+((e.reason&&e.reason.message)||e.reason)])});})();</script>`;

export default function CodeIDE({ files: initial, projectId }: { files: GenFile[]; projectId?: string }) {
  const [files, setFiles] = useState<GenFile[]>(initial);
  const [openPaths, setOpenPaths] = useState<string[]>(initial.length ? [initial[0].path] : []);
  const [activePath, setActivePath] = useState<string>(initial[0]?.path ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>("split");

  const [logs, setLogs] = useState<{ level: string; text: string }[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);

  const file = files.find((f) => f.path === activePath) ?? files[0];
  const preview = useMemo(() => buildPreview(files), [files]);
  // Inject a console bridge so the preview's console.log + errors stream into our Console panel.
  const previewDoc = useMemo(() => (preview ? preview + CONSOLE_BRIDGE : null), [preview]);
  const errorCount = logs.filter((l) => l.level === "error").length;

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { __vibexlog?: number; level?: string; text?: string };
      if (d && d.__vibexlog) {
        setLogs((l) => [...l.slice(-149), { level: d.level ?? "log", text: d.text ?? "" }]);
        if (d.level === "error") setConsoleOpen(true);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const openFile = (path: string) => {
    setOpenPaths((p) => (p.includes(path) ? p : [...p, path]));
    setActivePath(path);
  };

  const closeTab = (path: string) => {
    setOpenPaths((p) => {
      const next = p.filter((x) => x !== path);
      if (path === activePath) setActivePath(next[next.length - 1] ?? "");
      return next;
    });
  };

  const onChange = (val?: string) => {
    const target = file?.path;
    if (!target) return;
    setFiles((fs) => fs.map((f) => (f.path === target ? { ...f, content: val ?? "" } : f)));
    setDirty(true);
  };

  const save = async () => {
    if (!projectId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const res = await saveProjectFiles(projectId, filesRef.current);
    savingRef.current = false;
    setSaving(false);
    if (res?.ok) {
      setDirty(false);
      toast.success("Changes saved");
    } else {
      toast.error("Couldn’t save changes");
    }
  };
  // Refs so Monaco's Ctrl+S command (bound once at mount) always saves the CURRENT files.
  const filesRef = useRef(files);
  filesRef.current = files;
  const savingRef = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveRef.current());
  };

  return (
    <div className={styles.ide} data-view={view}>
      <aside className={styles.tree}>
        <div className={styles.treeHead}>Files</div>
        {files.map((f) => (
          <button key={f.path} type="button" className={styles.file} data-active={file?.path === f.path} onClick={() => openFile(f.path)}>
            <span className={styles.fileIcon} aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
            </span>
            <span className={styles.fileName}>{f.path}</span>
          </button>
        ))}
      </aside>

      <div className={styles.main}>
        <div className={styles.bar}>
          <div className={styles.etabs}>
            {openPaths.map((p) => (
              <span key={p} className={styles.etab} data-active={p === (file?.path ?? "")}>
                <button type="button" className={styles.etabName} onClick={() => setActivePath(p)}>
                  {p}
                </button>
                {openPaths.length > 1 && (
                  <button type="button" className={styles.etabClose} onClick={() => closeTab(p)} aria-label={`Close ${p}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                )}
              </span>
            ))}
            {dirty && <span className={styles.dirtyDot} title="Unsaved changes" aria-hidden />}
          </div>
          <div className={styles.barRight}>
            <div className={styles.viewTabs} role="tablist">
              {(["split", "code", "preview"] as View[]).map((v) => (
                <button key={v} type="button" className={styles.viewTab} data-active={view === v} onClick={() => setView(v)}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            {projectId && (
              <button type="button" className={styles.save} onClick={() => void save()} disabled={!dirty || saving}>
                {saving ? "Saving…" : dirty ? "Save" : "Saved"}
              </button>
            )}
          </div>
        </div>

        <div className={styles.panes}>
          {view !== "preview" && (
            <div className={styles.editor}>
              <Editor
                height="100%"
                path={file?.path}
                language={langFor(file?.path ?? "")}
                value={file?.content ?? ""}
                onChange={onChange}
                theme="vibex-ink"
                beforeMount={defineInkTheme}
                onMount={onMount}
                loading={<div className={styles.editorLoading}>Loading VS Code editor…</div>}
                options={{
                  fontSize: 13,
                  fontFamily: "ui-monospace, 'Cascadia Code', Consolas, 'JetBrains Mono', monospace",
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                  automaticLayout: true,
                  padding: { top: 10 },
                  smoothScrolling: true,
                  renderLineHighlight: "all",
                  fixedOverflowWidgets: true,
                }}
              />
            </div>
          )}
          {view !== "code" && (
            <div className={styles.previewPane}>
              {previewDoc ? (
                <iframe
                  className={styles.frame}
                  srcDoc={previewDoc}
                  title="Live preview"
                  // No `allow-same-origin`: with allow-scripts that pair lets the (LLM-written)
                  // app break out of the sandbox onto our origin — parent DOM, storage, and
                  // credentialed API calls as the signed-in user. The console bridge only needs
                  // postMessage, which works fine from an opaque origin.
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                />
              ) : (
                <div className={styles.noPreview}>No HTML entry to preview — this is an API/CLI project. Use the editor + the deploy/export options.</div>
              )}
            </div>
          )}
        </div>

        <div className={styles.console} data-open={consoleOpen}>
          <div className={styles.consoleHead}>
            <button type="button" className={styles.consoleToggle} onClick={() => setConsoleOpen((o) => !o)} aria-expanded={consoleOpen}>
              <span className={styles.consoleChevron} data-open={consoleOpen} aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </span>
              Console
              {logs.length > 0 && <span className={styles.consoleCount}>{logs.length}</span>}
              {errorCount > 0 && <span className={styles.consoleErr}>{errorCount} error{errorCount > 1 ? "s" : ""}</span>}
            </button>
            {logs.length > 0 && (
              <button type="button" className={styles.consoleClear} onClick={() => setLogs([])}>Clear</button>
            )}
          </div>
          {consoleOpen && (
            <div className={styles.consoleBody}>
              {logs.length === 0 ? (
                <div className={styles.consoleEmpty}>No output yet — your app&apos;s console.log and runtime errors appear here.</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className={styles.consoleLine} data-level={l.level}>
                    <span className={styles.consoleArrow} aria-hidden>›</span>
                    {l.text}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
