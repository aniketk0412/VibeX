"use client";

// In-app code editor (CodeMirror) with a live preview beside it. Edit any generated file and the
// preview re-renders instantly; Save persists edits back to the project. Loaded client-only
// (dynamic ssr:false from the result view) since CodeMirror needs the DOM.

import { useMemo, useState } from "react";
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

export default function CodeIDE({ files: initial, projectId }: { files: GenFile[]; projectId?: string }) {
  const [files, setFiles] = useState<GenFile[]>(initial);
  const [active, setActive] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>("split");

  const safe = Math.min(active, Math.max(0, files.length - 1));
  const file = files[safe];
  const preview = useMemo(() => buildPreview(files), [files]);
  const extensions = useMemo(() => langFor(file?.path ?? ""), [file?.path]);

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
        {files.map((f, i) => (
          <button key={f.path} type="button" className={styles.file} data-active={safe === i} onClick={() => setActive(i)}>
            <span className={styles.fileIcon}>›</span>
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
              {preview ? (
                <iframe
                  className={styles.frame}
                  srcDoc={preview}
                  title="Live preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                />
              ) : (
                <div className={styles.noPreview}>No HTML entry to preview — this is an API/CLI project. Use the editor + the deploy/export options.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
