"use client";

// In-app code editor (CodeMirror) with a live preview beside it. Edit any generated file and the
// preview re-renders instantly; Save persists edits back to the project. Loaded client-only
// (dynamic ssr:false from the result view) since CodeMirror needs the DOM.

import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Extension } from "@codemirror/state";
import type { GenFile } from "@/lib/steps";
import { buildPreview } from "@/lib/preview";
import { saveProjectFiles } from "@/app/actions";
import { toast } from "@/lib/toast";
import styles from "./CodeIDE.module.css";

type View = "split" | "code" | "preview";

function langFor(path: string): Extension[] {
  if (/\.html?$/i.test(path)) return [html()];
  if (/\.css$/i.test(path)) return [css()];
  if (/\.(jsx|tsx)$/i.test(path)) return [javascript({ jsx: true, typescript: /\.tsx$/i.test(path) })];
  if (/\.(js|mjs|cjs|ts)$/i.test(path)) return [javascript({ typescript: /\.ts$/i.test(path) })];
  if (/\.md$/i.test(path)) return [markdown()];
  return [];
}

// Injected into the preview so the running app's console + errors stream back to the Console panel.
const CONSOLE_BRIDGE = `<script>(function(){function s(l,a){try{parent.postMessage({__vibexlog:1,level:l,text:Array.prototype.map.call(a,function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ')},'*')}catch(e){}}['log','info','warn','error'].forEach(function(l){var o=console[l];console[l]=function(){s(l,arguments);if(o)o.apply(console,arguments)}});window.addEventListener('error',function(e){s('error',[e.message+' ('+(e.filename||'').split('/').pop()+':'+(e.lineno||'')+')'])});window.addEventListener('unhandledrejection',function(e){s('error',['Unhandled rejection: '+((e.reason&&e.reason.message)||e.reason)])});})();</script>`;

export default function CodeIDE({ files: initial, projectId }: { files: GenFile[]; projectId?: string }) {
  const [files, setFiles] = useState<GenFile[]>(initial);
  const [active, setActive] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>("split");

  const [logs, setLogs] = useState<{ level: string; text: string }[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);

  const safe = Math.min(active, Math.max(0, files.length - 1));
  const file = files[safe];
  const preview = useMemo(() => buildPreview(files), [files]);
  // Inject a console bridge so the preview's console.log + errors stream into our Console panel.
  const previewDoc = useMemo(() => (preview ? preview + CONSOLE_BRIDGE : null), [preview]);
  const extensions = useMemo(() => langFor(file?.path ?? ""), [file?.path]);
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

  const onChange = (val: string) => {
    setFiles((fs) => fs.map((f, i) => (i === safe ? { ...f, content: val } : f)));
    setDirty(true);
  };

  const save = async () => {
    if (!projectId || saving) return;
    setSaving(true);
    const res = await saveProjectFiles(projectId, files);
    setSaving(false);
    if (res?.ok) {
      setDirty(false);
      toast.success("Changes saved");
    } else {
      toast.error("Couldn’t save changes");
    }
  };

  return (
    <div className={styles.ide} data-view={view}>
      <aside className={styles.tree}>
        <div className={styles.treeHead}>Files</div>
        {files.map((f, i) => (
          <button key={f.path} type="button" className={styles.file} data-active={safe === i} onClick={() => setActive(i)}>
            <span className={styles.fileIcon} aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
            </span>
            <span className={styles.fileName}>{f.path}</span>
          </button>
        ))}
      </aside>

      <div className={styles.main}>
        <div className={styles.bar}>
          <span className={styles.barPath}>{file?.path}{dirty ? " •" : ""}</span>
          <div className={styles.barRight}>
            <div className={styles.viewTabs} role="tablist">
              {(["split", "code", "preview"] as View[]).map((v) => (
                <button key={v} type="button" className={styles.viewTab} data-active={view === v} onClick={() => setView(v)}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            {projectId && (
              <button type="button" className={styles.save} onClick={save} disabled={!dirty || saving}>
                {saving ? "Saving…" : dirty ? "Save" : "Saved"}
              </button>
            )}
          </div>
        </div>

        <div className={styles.panes}>
          {view !== "preview" && (
            <div className={styles.editor}>
              <CodeMirror
                value={file?.content ?? ""}
                height="100%"
                theme={oneDark}
                extensions={extensions}
                onChange={onChange}
                basicSetup={{ lineNumbers: true, highlightActiveLine: true, tabSize: 2 }}
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
