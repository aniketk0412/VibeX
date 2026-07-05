"use client";

// In-app IDE — Monaco (the actual VS Code editor) with a live preview beside it, plus a real file
// explorer: nested folder tree, new file / new folder, rename, delete, duplicate, per-extension
// icons, right-click context menu, and open-file tabs with their own undo stacks. Edit any file and
// the preview re-renders instantly; Save persists edits back to the project. Loaded client-only
// (dynamic ssr:false from the host views); Monaco itself arrives lazily via the loader.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Client-side ceiling mirrors the server's capFiles(MAX_FILES) so the tree never grows past what a
// Save can persist — the extra headroom leaves room to reorganize before trimming.
const MAX_FILES = 24;

function langFor(path: string): string {
  if (/\.html?$/i.test(path)) return "html";
  if (/\.css$/i.test(path)) return "css";
  if (/\.tsx?$/i.test(path)) return "typescript";
  if (/\.(js|jsx|mjs|cjs)$/i.test(path)) return "javascript";
  if (/\.md$/i.test(path)) return "markdown";
  if (/\.json$/i.test(path)) return "json";
  return "plaintext";
}

// A per-extension tint so the tree reads like VS Code's file explorer at a glance.
function iconColor(path: string): string {
  if (/\.html?$/i.test(path)) return "#e37933";
  if (/\.css$/i.test(path)) return "#42a5f5";
  if (/\.(js|jsx|mjs|cjs)$/i.test(path)) return "#e8d44d";
  if (/\.tsx?$/i.test(path)) return "#3178c6";
  if (/\.json$/i.test(path)) return "#cbcb41";
  if (/\.md$/i.test(path)) return "#519aba";
  return "var(--faint)";
}

function FileGlyph({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={iconColor(path)} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

// ── file tree model ──────────────────────────────────────────────────────────
type TreeNode =
  | { type: "file"; name: string; path: string }
  | { type: "folder"; name: string; path: string; children: TreeNode[] };
type Raw = { dir?: Record<string, Raw>; file?: string };

function buildTree(files: GenFile[], extraFolders: string[]): TreeNode[] {
  const root: Record<string, Raw> = {};
  const ensureDir = (parts: string[]): Record<string, Raw> => {
    let node = root;
    for (const p of parts) {
      if (!node[p]) node[p] = { dir: {} };
      if (!node[p].dir) node[p].dir = {};
      node = node[p].dir as Record<string, Raw>;
    }
    return node;
  };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    const name = parts.pop() ?? f.path;
    ensureDir(parts)[name] = { file: f.path };
  }
  for (const folder of extraFolders) ensureDir(folder.split("/").filter(Boolean));

  const toNodes = (obj: Record<string, Raw>, prefix: string): TreeNode[] => {
    const nodes: TreeNode[] = [];
    for (const [name, raw] of Object.entries(obj)) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (raw.dir) nodes.push({ type: "folder", name, path, children: toNodes(raw.dir, path) });
      else nodes.push({ type: "file", name, path: raw.file ?? path });
    }
    // Folders first, then files; alphabetical within each — matches VS Code's default sort.
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1));
    return nodes;
  };
  return toNodes(root, "");
}

function normalizePath(p: string): string {
  return p
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

// Injected into the preview so the running app's console + errors stream back to the Console panel.
const CONSOLE_BRIDGE = `<script>(function(){function s(l,a){try{parent.postMessage({__vibexlog:1,level:l,text:Array.prototype.map.call(a,function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ')},'*')}catch(e){}}['log','info','warn','error'].forEach(function(l){var o=console[l];console[l]=function(){s(l,arguments);if(o)o.apply(console,arguments)}});window.addEventListener('error',function(e){s('error',[e.message+' ('+(e.filename||'').split('/').pop()+':'+(e.lineno||'')+')'])});window.addEventListener('unhandledrejection',function(e){s('error',['Unhandled rejection: '+((e.reason&&e.reason.message)||e.reason)])});})();</script>`;

// The editor stays brand-ink in BOTH site themes (like the app's other code surfaces).
const defineInkTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("vibex-ink", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#12141B",
      "editor.lineHighlightBackground": "#1A1D26",
      "editorLineNumber.foreground": "#565B6E",
      "editorLineNumber.activeForeground": "#A0A5BA",
      "editorIndentGuide.background1": "#1E222C",
      "editorCursor.foreground": "#5E5CE6",
      "editor.selectionBackground": "#32345E",
      "minimap.background": "#12141B",
      "scrollbarSlider.background": "#272B3780",
      "scrollbarSlider.hoverBackground": "#3A3F58a0",
    },
  });
};

type Prompt = { kind: "new-file" | "new-folder" | "rename"; base: string; original?: string } | null;
type Menu = { x: number; y: number; path: string; isFolder: boolean } | null;

export default function CodeIDE({ files: initial, projectId }: { files: GenFile[]; projectId?: string }) {
  const [files, setFiles] = useState<GenFile[]>(initial);
  const [folders, setFolders] = useState<string[]>([]); // explicitly-created (possibly-empty) folders
  const [openPaths, setOpenPaths] = useState<string[]>(initial.length ? [initial[0].path] : []);
  const [activePath, setActivePath] = useState<string>(initial[0]?.path ?? "");
  const [collapsed, setCollapsed] = useState<string[]>([]); // collapsed folder paths
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>("split");

  const [prompt, setPrompt] = useState<Prompt>(null); // inline new/rename input
  const [promptValue, setPromptValue] = useState("");
  const [menu, setMenu] = useState<Menu>(null);

  const [logs, setLogs] = useState<{ level: string; text: string }[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);

  const file = files.find((f) => f.path === activePath) ?? files[0];
  const tree = useMemo(() => buildTree(files, folders), [files, folders]);
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

  // Dismiss the context menu on any outside click / Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

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

  const toggleFolder = (path: string) =>
    setCollapsed((c) => (c.includes(path) ? c.filter((x) => x !== path) : [...c, path]));

  // ── file operations ─────────────────────────────────────────────────────────
  const createFile = (rawPath: string) => {
    const path = normalizePath(rawPath);
    if (!path) return;
    if (files.some((f) => f.path === path)) {
      toast.error("A file with that name already exists");
      return;
    }
    if (files.length >= MAX_FILES) {
      toast.error(`A project can hold up to ${MAX_FILES} files`);
      return;
    }
    setFiles((fs) => [...fs, { path, content: "" }]);
    openFile(path);
    setDirty(true);
  };

  const createFolder = (rawPath: string) => {
    const path = normalizePath(rawPath);
    if (!path) return;
    setFolders((f) => (f.includes(path) ? f : [...f, path]));
    setCollapsed((c) => c.filter((x) => x !== path));
  };

  const renameEntry = (oldPath: string, rawNew: string, isFolder: boolean) => {
    const next = normalizePath(rawNew);
    if (!next || next === oldPath) return;
    if (isFolder) {
      const from = `${oldPath}/`;
      if (files.some((f) => f.path === next || f.path.startsWith(`${next}/`))) {
        toast.error("A folder with that name already exists");
        return;
      }
      setFiles((fs) => fs.map((f) => (f.path.startsWith(from) ? { ...f, content: f.content, path: next + "/" + f.path.slice(from.length) } : f)));
      setFolders((fl) => fl.map((f) => (f === oldPath ? next : f.startsWith(from) ? next + "/" + f.slice(from.length) : f)));
      setOpenPaths((p) => p.map((x) => (x.startsWith(from) ? next + "/" + x.slice(from.length) : x)));
      setActivePath((a) => (a.startsWith(from) ? next + "/" + a.slice(from.length) : a));
    } else {
      if (files.some((f) => f.path === next)) {
        toast.error("A file with that name already exists");
        return;
      }
      setFiles((fs) => fs.map((f) => (f.path === oldPath ? { ...f, path: next } : f)));
      setOpenPaths((p) => p.map((x) => (x === oldPath ? next : x)));
      setActivePath((a) => (a === oldPath ? next : a));
    }
    setDirty(true);
  };

  const deleteEntry = (path: string, isFolder: boolean) => {
    if (isFolder) {
      const from = `${path}/`;
      const hit = files.filter((f) => f.path.startsWith(from));
      if (hit.length && !confirm(`Delete folder "${path}" and its ${hit.length} file${hit.length > 1 ? "s" : ""}?`)) return;
      setFiles((fs) => fs.filter((f) => !f.path.startsWith(from)));
      setFolders((fl) => fl.filter((f) => f !== path && !f.startsWith(from)));
      setOpenPaths((p) => p.filter((x) => !x.startsWith(from)));
      setActivePath((a) => (a.startsWith(from) ? "" : a));
    } else {
      setFiles((fs) => fs.filter((f) => f.path !== path));
      setOpenPaths((p) => {
        const nx = p.filter((x) => x !== path);
        if (path === activePath) setActivePath(nx[nx.length - 1] ?? "");
        return nx;
      });
    }
    setDirty(true);
  };

  const duplicateFile = (path: string) => {
    const src = files.find((f) => f.path === path);
    if (!src) return;
    if (files.length >= MAX_FILES) {
      toast.error(`A project can hold up to ${MAX_FILES} files`);
      return;
    }
    const dot = path.lastIndexOf(".");
    const base = dot > 0 ? path.slice(0, dot) : path;
    const ext = dot > 0 ? path.slice(dot) : "";
    let candidate = `${base} copy${ext}`;
    let n = 2;
    while (files.some((f) => f.path === candidate)) candidate = `${base} copy ${n++}${ext}`;
    setFiles((fs) => [...fs, { path: candidate, content: src.content }]);
    openFile(candidate);
    setDirty(true);
  };

  // Start an inline prompt (new file/folder under `base`, or rename `original`).
  const startPrompt = (p: NonNullable<Prompt>) => {
    setMenu(null);
    setPrompt(p);
    setPromptValue(p.kind === "rename" ? p.original ?? "" : p.base ? `${p.base}/` : "");
  };
  const commitPrompt = () => {
    if (!prompt) return;
    const val = promptValue;
    if (prompt.kind === "new-file") createFile(val);
    else if (prompt.kind === "new-folder") createFolder(val);
    else if (prompt.kind === "rename" && prompt.original) {
      const isFolder = folders.includes(prompt.original) || files.some((f) => f.path.startsWith(`${prompt.original}/`));
      renameEntry(prompt.original, val, isFolder);
    }
    setPrompt(null);
    setPromptValue("");
  };

  const onContextMenu = (e: React.MouseEvent, path: string, isFolder: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, path, isFolder });
  };

  // ── save ─────────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
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
  }, [projectId]);
  // Refs so Monaco's Ctrl+S command (bound once at mount) always saves the CURRENT files.
  const filesRef = useRef(files);
  filesRef.current = files;
  const savingRef = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  const onChange = (val?: string) => {
    const target = file?.path;
    if (!target) return;
    setFiles((fs) => fs.map((f) => (f.path === target ? { ...f, content: val ?? "" } : f)));
    setDirty(true);
  };

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveRef.current());
  };

  // ── recursive tree render ─────────────────────────────────────────────────────
  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const pad = 8 + depth * 13;
      if (node.type === "folder") {
        const isCollapsed = collapsed.includes(node.path);
        return (
          <div key={`d:${node.path}`}>
            <div
              className={styles.row}
              data-kind="folder"
              style={{ paddingLeft: pad }}
              onClick={() => toggleFolder(node.path)}
              onContextMenu={(e) => onContextMenu(e, node.path, true)}
              role="button"
              tabIndex={0}
            >
              <span className={styles.rowChevron} data-open={!isCollapsed} aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </span>
              <span className={styles.rowFolderIcon} aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z" /></svg>
              </span>
              <span className={styles.rowName}>{node.name}</span>
              <span className={styles.rowActions}>
                <button type="button" title="New File" aria-label="New file in folder" onClick={(e) => { e.stopPropagation(); startPrompt({ kind: "new-file", base: node.path }); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M12 11v6M9 14h6" /></svg>
                </button>
                <button type="button" title="Rename" aria-label="Rename folder" onClick={(e) => { e.stopPropagation(); startPrompt({ kind: "rename", base: "", original: node.path }); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                </button>
                <button type="button" title="Delete" aria-label="Delete folder" onClick={(e) => { e.stopPropagation(); deleteEntry(node.path, true); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                </button>
              </span>
            </div>
            {prompt && prompt.kind !== "rename" && prompt.base === node.path && !isCollapsed && (
              <PromptRow depth={depth + 1} kind={prompt.kind} value={promptValue} onChange={setPromptValue} onCommit={commitPrompt} onCancel={() => setPrompt(null)} />
            )}
            {!isCollapsed && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      const isRenaming = prompt?.kind === "rename" && prompt.original === node.path;
      if (isRenaming) {
        return <PromptRow key={`r:${node.path}`} depth={depth} kind="rename" value={promptValue} onChange={setPromptValue} onCommit={commitPrompt} onCancel={() => setPrompt(null)} />;
      }
      return (
        <div
          key={`f:${node.path}`}
          className={styles.row}
          data-kind="file"
          data-active={file?.path === node.path}
          style={{ paddingLeft: pad }}
          onClick={() => openFile(node.path)}
          onContextMenu={(e) => onContextMenu(e, node.path, false)}
          role="button"
          tabIndex={0}
        >
          <span className={styles.rowFileIcon} aria-hidden><FileGlyph path={node.path} /></span>
          <span className={styles.rowName}>{node.name}</span>
          <span className={styles.rowActions}>
            <button type="button" title="Rename" aria-label="Rename file" onClick={(e) => { e.stopPropagation(); startPrompt({ kind: "rename", base: "", original: node.path }); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
            </button>
            <button type="button" title="Delete" aria-label="Delete file" onClick={(e) => { e.stopPropagation(); deleteEntry(node.path, false); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
            </button>
          </span>
        </div>
      );
    });

  return (
    <div className={styles.ide} data-view={view}>
      <aside className={styles.tree} onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, path: "", isFolder: true }); }}>
        <div className={styles.treeHead}>
          <span>Explorer</span>
          <span className={styles.treeHeadActions}>
            <button type="button" title="New File" aria-label="New file" onClick={() => startPrompt({ kind: "new-file", base: "" })}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M12 11v6M9 14h6" /></svg>
            </button>
            <button type="button" title="New Folder" aria-label="New folder" onClick={() => startPrompt({ kind: "new-folder", base: "" })}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z" /><path d="M12 11v6M9 14h6" /></svg>
            </button>
            <button type="button" title="Collapse all" aria-label="Collapse all folders" onClick={() => setCollapsed(collectFolders(tree))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h6V3M20 15h-6v6M14 10l7-7M3 21l7-7" /></svg>
            </button>
          </span>
        </div>
        <div className={styles.treeBody}>
          {prompt && prompt.kind !== "rename" && prompt.base === "" && (
            <PromptRow depth={0} kind={prompt.kind} value={promptValue} onChange={setPromptValue} onCommit={commitPrompt} onCancel={() => setPrompt(null)} />
          )}
          {tree.length === 0 && !prompt ? (
            <div className={styles.treeEmpty}>No files. Use <b>+</b> to create one.</div>
          ) : (
            renderNodes(tree, 0)
          )}
        </div>
      </aside>

      <div className={styles.main}>
        <div className={styles.bar}>
          <div className={styles.etabs}>
            {openPaths.map((p) => (
              <span key={p} className={styles.etab} data-active={p === (file?.path ?? "")}>
                <span className={styles.etabIcon} aria-hidden><FileGlyph path={p} /></span>
                <button type="button" className={styles.etabName} onClick={() => setActivePath(p)}>
                  {p.split("/").pop()}
                </button>
                <button type="button" className={styles.etabClose} onClick={() => closeTab(p)} aria-label={`Close ${p}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
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
              {file ? (
                <Editor
                  height="100%"
                  path={file.path}
                  language={langFor(file.path)}
                  value={file.content}
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
              ) : (
                <div className={styles.editorLoading}>No file open — pick one from the Explorer or create a new file.</div>
              )}
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

      {menu && (
        <div className={styles.menu} style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          {menu.path === "" ? (
            <>
              <button type="button" onClick={() => startPrompt({ kind: "new-file", base: "" })}>New File</button>
              <button type="button" onClick={() => startPrompt({ kind: "new-folder", base: "" })}>New Folder</button>
            </>
          ) : menu.isFolder ? (
            <>
              <button type="button" onClick={() => startPrompt({ kind: "new-file", base: menu.path })}>New File</button>
              <button type="button" onClick={() => startPrompt({ kind: "new-folder", base: menu.path })}>New Folder</button>
              <button type="button" onClick={() => startPrompt({ kind: "rename", base: "", original: menu.path })}>Rename</button>
              <button type="button" className={styles.menuDanger} onClick={() => { deleteEntry(menu.path, true); setMenu(null); }}>Delete</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => startPrompt({ kind: "rename", base: "", original: menu.path })}>Rename</button>
              <button type="button" onClick={() => { duplicateFile(menu.path); setMenu(null); }}>Duplicate</button>
              <button type="button" className={styles.menuDanger} onClick={() => { deleteEntry(menu.path, false); setMenu(null); }}>Delete</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Collect every folder path in the tree (for "collapse all").
function collectFolders(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) if (n.type === "folder") { out.push(n.path); out.push(...collectFolders(n.children)); }
  return out;
}

// Inline input row used for New File / New Folder / Rename — Enter commits, Escape/blur cancels.
function PromptRow({
  depth,
  kind,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  depth: number;
  kind: "new-file" | "new-folder" | "rename";
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <div className={styles.promptRow} style={{ paddingLeft: 8 + depth * 13 }}>
      <span className={styles.rowFileIcon} aria-hidden>
        {kind === "new-folder" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z" /></svg>
        ) : (
          <FileGlyph path={value || "file.txt"} />
        )}
      </span>
      <input
        ref={ref}
        className={styles.promptInput}
        value={value}
        placeholder={kind === "new-folder" ? "folder name" : "file name (e.g. app.js or lib/util.js)"}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onCommit(); }
          else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        onBlur={onCommit}
      />
    </div>
  );
}
