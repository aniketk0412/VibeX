"use client";

// In-app IDE — a full VS Code-style shell around the real Monaco editor: menu bar, activity bar,
// explorer + search sidebar, breadcrumbs, open-file tabs, a bottom panel (Problems / Output /
// Terminal / Ports), and a status bar (Ln/Col, indentation, encoding, EOL, language). Real file
// management (new / rename / delete / duplicate, nested folders), a live preview, and Save that
// persists to the project. Loaded client-only (Monaco needs the DOM).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader, type BeforeMount, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
type MonacoNS = Parameters<OnMount>[1];

if (typeof window !== "undefined") {
  loader.config({ paths: { vs: "/monaco/vs" } });
}
import type { GenFile } from "@/lib/steps";
import { buildPreview } from "@/lib/preview";
import { saveProjectFiles } from "@/app/actions";
import { toast } from "@/lib/toast";
import styles from "./CodeIDE.module.css";

type View = "split" | "code" | "preview";
type SidebarView = "explorer" | "search" | "scm" | "run" | "extensions";
type PanelTab = "problems" | "output" | "terminal" | "ports";
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
function langName(path: string): string {
  return ({ html: "HTML", css: "CSS", javascript: "JavaScript", typescript: "TypeScript", markdown: "Markdown", json: "JSON", plaintext: "Plain Text" } as Record<string, string>)[langFor(path)] ?? "Plain Text";
}
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
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1));
    return nodes;
  };
  return toNodes(root, "");
}
function collectFolders(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) if (n.type === "folder") { out.push(n.path); out.push(...collectFolders(n.children)); }
  return out;
}
function normalizePath(p: string): string {
  return p.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
}

const CONSOLE_BRIDGE = `<script>(function(){function s(l,a){try{parent.postMessage({__vibexlog:1,level:l,text:Array.prototype.map.call(a,function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ')},'*')}catch(e){}}['log','info','warn','error'].forEach(function(l){var o=console[l];console[l]=function(){s(l,arguments);if(o)o.apply(console,arguments)}});window.addEventListener('error',function(e){s('error',[e.message+' ('+(e.filename||'').split('/').pop()+':'+(e.lineno||'')+')'])});window.addEventListener('unhandledrejection',function(e){s('error',['Unhandled rejection: '+((e.reason&&e.reason.message)||e.reason)])});})();</script>`;

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

// ── small inline icons (activity bar / status bar / panel), rendered inside an <svg> ──
const I: Record<string, React.ReactNode> = {
  explorer: (<path d="M13 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8l-5-5z M13 3v5h5" />),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
  scm: (<><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" /></>),
  run: (<path d="M5 3v18l15-9z" />),
  ext: (<path d="M20 8h-3V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2z" />),
  gear: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 6 9.4a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11 4.6V4.5a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
  bell: (<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />),
  err: (<><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></>),
  warn: (<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>),
};

type Prompt = { kind: "new-file" | "new-folder" | "rename"; base: string; original?: string } | null;
type Menu = { x: number; y: number; path: string; isFolder: boolean } | null;
type MenuItem = "sep" | { label: string; accel?: string; run: () => void; check?: boolean };

export default function CodeIDE({ files: initial, projectId }: { files: GenFile[]; projectId?: string }) {
  const [files, setFiles] = useState<GenFile[]>(initial);
  const [folders, setFolders] = useState<string[]>([]);
  const [openPaths, setOpenPaths] = useState<string[]>(initial.length ? [initial[0].path] : []);
  const [activePath, setActivePath] = useState<string>(initial[0]?.path ?? "");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>("split");

  // VS Code shell state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("problems");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [pos, setPos] = useState({ line: 1, col: 1 });
  const [markers, setMarkers] = useState<MonacoEditor.IMarker[]>([]);
  const [wordWrap, setWordWrap] = useState(false);
  const [minimap, setMinimap] = useState(true);
  const [autoSave, setAutoSave] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [output, setOutput] = useState<string[]>(["Vibex IDE — Monaco language services ready."]);

  const [prompt, setPrompt] = useState<Prompt>(null);
  const [promptValue, setPromptValue] = useState("");
  const [menu, setMenu] = useState<Menu>(null);

  const [logs, setLogs] = useState<{ level: string; text: string }[]>([]);

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<MonacoNS | null>(null);
  const originalRef = useRef<Record<string, string>>(Object.fromEntries(initial.map((f) => [f.path, f.content])));

  const file = files.find((f) => f.path === activePath) ?? files[0];
  const tree = useMemo(() => buildTree(files, folders), [files, folders]);
  const preview = useMemo(() => buildPreview(files), [files]);
  const previewDoc = useMemo(() => (preview ? preview + CONSOLE_BRIDGE : null), [preview]);
  const errorCount = markers.filter((m) => m.severity === 8).length;
  const warnCount = markers.filter((m) => m.severity === 4).length;

  const log = useCallback((line: string) => setOutput((o) => [...o.slice(-199), line]), []);

  // preview console → Terminal panel
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { __vibexlog?: number; level?: string; text?: string };
      if (d && d.__vibexlog) {
        setLogs((l) => [...l.slice(-199), { level: d.level ?? "log", text: d.text ?? "" }]);
        if (d.level === "error") { setPanelOpen(true); setPanelTab("terminal"); }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // close context menu / menubar on outside click / Escape
  useEffect(() => {
    if (!menu && !openMenu) return;
    const close = () => { setMenu(null); setOpenMenu(null); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", onKey); };
  }, [menu, openMenu]);

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
    if (files.some((f) => f.path === path)) return toast.error("A file with that name already exists");
    if (files.length >= MAX_FILES) return toast.error(`A project can hold up to ${MAX_FILES} files`);
    setFiles((fs) => [...fs, { path, content: "" }]);
    openFile(path);
    setDirty(true);
    log(`Created ${path}`);
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
      if (files.some((f) => f.path === next || f.path.startsWith(`${next}/`))) return toast.error("A folder with that name already exists");
      setFiles((fs) => fs.map((f) => (f.path.startsWith(from) ? { ...f, path: next + "/" + f.path.slice(from.length) } : f)));
      setFolders((fl) => fl.map((f) => (f === oldPath ? next : f.startsWith(from) ? next + "/" + f.slice(from.length) : f)));
      setOpenPaths((p) => p.map((x) => (x.startsWith(from) ? next + "/" + x.slice(from.length) : x)));
      setActivePath((a) => (a.startsWith(from) ? next + "/" + a.slice(from.length) : a));
    } else {
      if (files.some((f) => f.path === next)) return toast.error("A file with that name already exists");
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
      log(`Deleted ${path}`);
    }
    setDirty(true);
  };
  const duplicateFile = (path: string) => {
    const src = files.find((f) => f.path === path);
    if (!src) return;
    if (files.length >= MAX_FILES) return toast.error(`A project can hold up to ${MAX_FILES} files`);
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
  const revertActive = () => {
    if (!file) return;
    const orig = originalRef.current[file.path];
    if (orig == null) return toast.error("No saved version to revert to");
    setFiles((fs) => fs.map((f) => (f.path === file.path ? { ...f, content: orig } : f)));
    toast.success(`Reverted ${file.path}`);
  };

  const startPrompt = (p: NonNullable<Prompt>) => {
    setMenu(null); setOpenMenu(null);
    setSidebarView("explorer"); setSidebarOpen(true);
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
    setPrompt(null); setPromptValue("");
  };
  const onContextMenu = (e: React.MouseEvent, path: string, isFolder: boolean) => {
    e.preventDefault(); e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, path, isFolder });
  };

  // ── save ─────────────────────────────────────────────────────────────────────
  const filesRef = useRef(files); filesRef.current = files;
  const savingRef = useRef(false);
  const save = useCallback(async () => {
    if (!projectId || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    const res = await saveProjectFiles(projectId, filesRef.current);
    savingRef.current = false; setSaving(false);
    if (res?.ok) {
      setDirty(false);
      originalRef.current = Object.fromEntries(filesRef.current.map((f) => [f.path, f.content]));
      toast.success("Changes saved");
      log("Saved all files.");
    } else toast.error("Couldn’t save changes");
  }, [projectId, log]);
  const saveRef = useRef(save); saveRef.current = save;

  // auto-save (File → Auto Save)
  useEffect(() => {
    if (!autoSave || !dirty || !projectId) return;
    const t = setTimeout(() => void saveRef.current(), 800);
    return () => clearTimeout(t);
  }, [autoSave, dirty, projectId, files]);

  const onChange = (val?: string) => {
    const target = file?.path;
    if (!target) return;
    setFiles((fs) => fs.map((f) => (f.path === target ? { ...f, content: val ?? "" } : f)));
    setDirty(true);
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveRef.current());
    editor.onDidChangeCursorPosition((e) => setPos({ line: e.position.lineNumber, col: e.position.column }));
    const sync = () => setMarkers(monaco.editor.getModelMarkers({}));
    monaco.editor.onDidChangeMarkers(sync);
    sync();
  };

  // Monaco action helpers for the menu bar
  const act = (id: string) => { editorRef.current?.focus(); editorRef.current?.getAction(id)?.run(); };
  const trig = (id: string) => { editorRef.current?.focus(); editorRef.current?.trigger("menu", id, null); };
  const toggleWrap = () => { const n = !wordWrap; setWordWrap(n); editorRef.current?.updateOptions({ wordWrap: n ? "on" : "off" }); };
  const toggleMinimap = () => { const n = !minimap; setMinimap(n); editorRef.current?.updateOptions({ minimap: { enabled: n } }); };
  const gotoResult = (path: string, line: number) => {
    openFile(path);
    setTimeout(() => { editorRef.current?.revealLineInCenter(line); editorRef.current?.setPosition({ lineNumber: line, column: 1 }); editorRef.current?.focus(); }, 60);
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as { path: string; line: number; text: string }[];
    const out: { path: string; line: number; text: string }[] = [];
    for (const f of files) f.content.split("\n").forEach((ln, i) => {
      if (ln.toLowerCase().includes(q)) out.push({ path: f.path, line: i + 1, text: ln.trim().slice(0, 140) });
    });
    return out.slice(0, 300);
  }, [searchQuery, files]);

  // ── menu bar definition ───────────────────────────────────────────────────────
  const MENUS: { label: string; items: MenuItem[] }[] = [
    { label: "File", items: [
      { label: "New File…", accel: "Ctrl+Alt+N", run: () => startPrompt({ kind: "new-file", base: "" }) },
      { label: "New Folder…", run: () => startPrompt({ kind: "new-folder", base: "" }) },
      "sep",
      { label: "Save", accel: "Ctrl+S", run: () => void save() },
      { label: "Save All", accel: "Ctrl+K S", run: () => void save() },
      { label: "Auto Save", check: autoSave, run: () => setAutoSave((a) => !a) },
      "sep",
      { label: "Revert File", run: revertActive },
      { label: "Close Editor", accel: "Ctrl+F4", run: () => activePath && closeTab(activePath) },
      { label: "Close All Editors", run: () => { setOpenPaths([]); setActivePath(""); } },
    ] },
    { label: "Edit", items: [
      { label: "Undo", accel: "Ctrl+Z", run: () => trig("undo") },
      { label: "Redo", accel: "Ctrl+Y", run: () => trig("redo") },
      "sep",
      { label: "Cut", accel: "Ctrl+X", run: () => act("editor.action.clipboardCutAction") },
      { label: "Copy", accel: "Ctrl+C", run: () => act("editor.action.clipboardCopyAction") },
      { label: "Paste", accel: "Ctrl+V", run: () => act("editor.action.clipboardPasteAction") },
      "sep",
      { label: "Find", accel: "Ctrl+F", run: () => act("actions.find") },
      { label: "Replace", accel: "Ctrl+H", run: () => act("editor.action.startFindReplaceAction") },
      { label: "Toggle Line Comment", accel: "Ctrl+/", run: () => act("editor.action.commentLine") },
      { label: "Format Document", accel: "Shift+Alt+F", run: () => act("editor.action.formatDocument") },
    ] },
    { label: "Selection", items: [
      { label: "Select All", accel: "Ctrl+A", run: () => act("editor.action.selectAll") },
      { label: "Copy Line Down", accel: "Shift+Alt+Down", run: () => act("editor.action.copyLinesDownAction") },
      { label: "Move Line Up", accel: "Alt+Up", run: () => act("editor.action.moveLinesUpAction") },
      { label: "Move Line Down", accel: "Alt+Down", run: () => act("editor.action.moveLinesDownAction") },
      { label: "Add Cursor Below", accel: "Ctrl+Alt+Down", run: () => act("editor.action.insertCursorBelow") },
    ] },
    { label: "View", items: [
      { label: "Command Palette…", accel: "Ctrl+Shift+P", run: () => act("editor.action.quickCommand") },
      "sep",
      { label: "Explorer", run: () => { setSidebarView("explorer"); setSidebarOpen(true); } },
      { label: "Search", run: () => { setSidebarView("search"); setSidebarOpen(true); } },
      { label: "Problems", run: () => { setPanelOpen(true); setPanelTab("problems"); } },
      "sep",
      { label: "Toggle Primary Side Bar", accel: "Ctrl+B", run: () => setSidebarOpen((o) => !o) },
      { label: "Toggle Panel", accel: "Ctrl+J", run: () => setPanelOpen((o) => !o) },
      { label: "Toggle Word Wrap", accel: "Alt+Z", check: wordWrap, run: toggleWrap },
      { label: "Show Minimap", check: minimap, run: toggleMinimap },
    ] },
    { label: "Go", items: [
      { label: "Go to File…", accel: "Ctrl+P", run: () => { setSidebarView("search"); setSidebarOpen(true); } },
      { label: "Go to Line/Column…", accel: "Ctrl+G", run: () => act("editor.action.gotoLine") },
      { label: "Go to Symbol…", accel: "Ctrl+Shift+O", run: () => act("editor.action.quickOutline") },
    ] },
    { label: "Run", items: [
      { label: "Open Preview", run: () => setView("preview") },
      { label: "Split Editor & Preview", run: () => setView("split") },
      { label: "Editor Only", run: () => setView("code") },
    ] },
    { label: "Terminal", items: [
      { label: "Show Console", run: () => { setPanelOpen(true); setPanelTab("terminal"); } },
      { label: "Show Problems", run: () => { setPanelOpen(true); setPanelTab("problems"); } },
      { label: "Clear Console", run: () => setLogs([]) },
    ] },
    { label: "Help", items: [
      { label: "About Vibex IDE", run: () => toast.success("Vibex IDE — the real Monaco (VS Code) editor, in your browser.") },
    ] },
  ];

  // ── recursive tree render ─────────────────────────────────────────────────────
  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const pad = 8 + depth * 13;
      if (node.type === "folder") {
        const isCollapsed = collapsed.includes(node.path);
        return (
          <div key={`d:${node.path}`}>
            <div className={styles.row} data-kind="folder" style={{ paddingLeft: pad }} onClick={() => toggleFolder(node.path)} onContextMenu={(e) => onContextMenu(e, node.path, true)} role="button" tabIndex={0}>
              <span className={styles.rowChevron} data-open={!isCollapsed} aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></span>
              <span className={styles.rowFolderIcon} aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z" /></svg></span>
              <span className={styles.rowName}>{node.name}</span>
              <span className={styles.rowActions}>
                <button type="button" title="New File" aria-label="New file in folder" onClick={(e) => { e.stopPropagation(); startPrompt({ kind: "new-file", base: node.path }); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M12 11v6M9 14h6" /></svg></button>
                <button type="button" title="Rename" aria-label="Rename folder" onClick={(e) => { e.stopPropagation(); startPrompt({ kind: "rename", base: "", original: node.path }); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg></button>
                <button type="button" title="Delete" aria-label="Delete folder" onClick={(e) => { e.stopPropagation(); deleteEntry(node.path, true); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg></button>
              </span>
            </div>
            {prompt && prompt.kind !== "rename" && prompt.base === node.path && !isCollapsed && (
              <PromptRow depth={depth + 1} kind={prompt.kind} value={promptValue} onChange={setPromptValue} onCommit={commitPrompt} onCancel={() => setPrompt(null)} />
            )}
            {!isCollapsed && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      if (prompt?.kind === "rename" && prompt.original === node.path)
        return <PromptRow key={`r:${node.path}`} depth={depth} kind="rename" value={promptValue} onChange={setPromptValue} onCommit={commitPrompt} onCancel={() => setPrompt(null)} />;
      return (
        <div key={`f:${node.path}`} className={styles.row} data-kind="file" data-active={file?.path === node.path} style={{ paddingLeft: pad }} onClick={() => openFile(node.path)} onContextMenu={(e) => onContextMenu(e, node.path, false)} role="button" tabIndex={0}>
          <span className={styles.rowFileIcon} aria-hidden><FileGlyph path={node.path} /></span>
          <span className={styles.rowName}>{node.name}</span>
          <span className={styles.rowActions}>
            <button type="button" title="Rename" aria-label="Rename file" onClick={(e) => { e.stopPropagation(); startPrompt({ kind: "rename", base: "", original: node.path }); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg></button>
            <button type="button" title="Delete" aria-label="Delete file" onClick={(e) => { e.stopPropagation(); deleteEntry(node.path, false); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg></button>
          </span>
        </div>
      );
    });

  const crumbs = activePath ? activePath.split("/") : [];
  const ActIcon = ({ id, view: v, label }: { id: keyof typeof I; view: SidebarView; label: string }) => (
    <button type="button" className={styles.actBtn} data-active={sidebarOpen && sidebarView === v} aria-label={label} title={label}
      onClick={() => { if (sidebarOpen && sidebarView === v) setSidebarOpen(false); else { setSidebarView(v); setSidebarOpen(true); } }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{I[id]}</svg>
    </button>
  );

  return (
    <div className={styles.vscode}>
      {/* ── menu bar ─────────────────────────────────────────── */}
      <div className={styles.menubar} onClick={(e) => e.stopPropagation()}>
        <span className={styles.menubarLogo} aria-hidden><svg viewBox="0 0 24 24" fill="#5E5CE6"><path d="m12 2 9 5v10l-9 5-9-5V7z" opacity=".9" /></svg></span>
        <div className={styles.menus}>
          {MENUS.map((m) => (
            <div key={m.label} className={styles.menuWrap}>
              <button type="button" className={styles.menuTop} data-open={openMenu === m.label}
                onClick={() => setOpenMenu((o) => (o === m.label ? null : m.label))}
                onMouseEnter={() => openMenu && setOpenMenu(m.label)}>
                {m.label}
              </button>
              {openMenu === m.label && (
                <div className={styles.menuDrop}>
                  {m.items.map((it, i) =>
                    it === "sep" ? <div key={i} className={styles.menuSep} /> : (
                      <button key={i} type="button" className={styles.menuItem} onClick={() => { it.run(); setOpenMenu(null); }}>
                        <span className={styles.menuCheck} aria-hidden>{it.check ? "✓" : ""}</span>
                        <span className={styles.menuLabel}>{it.label}</span>
                        {it.accel && <span className={styles.menuAccel}>{it.accel}</span>}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className={styles.menubarCentre}><span className={styles.searchPill} onClick={() => act("editor.action.quickCommand")}>{projectId ? "Vibex — project" : "Vibex"}</span></div>
        <div className={styles.menubarRight}>
          <button type="button" className={styles.layoutBtn} title="Toggle Primary Side Bar" aria-label="Toggle sidebar" data-active={sidebarOpen} onClick={() => setSidebarOpen((o) => !o)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M9 4v16" /></svg></button>
          <button type="button" className={styles.layoutBtn} title="Toggle Panel" aria-label="Toggle panel" data-active={panelOpen} onClick={() => setPanelOpen((o) => !o)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 15h18" /></svg></button>
        </div>
      </div>

      {/* ── body: activity bar + sidebar + editor ─────────────── */}
      <div className={styles.body}>
        <div className={styles.activitybar}>
          <div className={styles.actTop}>
            <ActIcon id="explorer" view="explorer" label="Explorer (Ctrl+Shift+E)" />
            <ActIcon id="search" view="search" label="Search (Ctrl+Shift+F)" />
            <ActIcon id="scm" view="scm" label="Source Control (Ctrl+Shift+G)" />
            <ActIcon id="run" view="run" label="Run and Debug (Ctrl+Shift+D)" />
            <ActIcon id="ext" view="extensions" label="Extensions (Ctrl+Shift+X)" />
          </div>
          <div className={styles.actBottom}>
            <button type="button" className={styles.actBtn} aria-label="Accounts" title="Accounts"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg></button>
            <button type="button" className={styles.actBtn} aria-label="Settings" title="Manage" onClick={() => act("editor.action.quickCommand")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{I.gear}</svg></button>
          </div>
        </div>

        {sidebarOpen && (
          <aside className={styles.sidebar} onContextMenu={(e) => { if (sidebarView === "explorer") { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, path: "", isFolder: true }); } }}>
            {sidebarView === "explorer" && (
              <>
                <div className={styles.sideHead}>
                  <span>Explorer</span>
                  <span className={styles.sideHeadActions}>
                    <button type="button" title="New File" aria-label="New file" onClick={() => startPrompt({ kind: "new-file", base: "" })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M12 11v6M9 14h6" /></svg></button>
                    <button type="button" title="New Folder" aria-label="New folder" onClick={() => startPrompt({ kind: "new-folder", base: "" })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z" /><path d="M12 11v6M9 14h6" /></svg></button>
                    <button type="button" title="Collapse all" aria-label="Collapse all folders" onClick={() => setCollapsed(collectFolders(tree))}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h6V3M20 15h-6v6M14 10l7-7M3 21l7-7" /></svg></button>
                  </span>
                </div>
                <div className={styles.sideProject}>{projectId ? "VIBEX PROJECT" : "UNTITLED"}</div>
                <div className={styles.treeBody}>
                  {prompt && prompt.kind !== "rename" && prompt.base === "" && (
                    <PromptRow depth={0} kind={prompt.kind} value={promptValue} onChange={setPromptValue} onCommit={commitPrompt} onCancel={() => setPrompt(null)} />
                  )}
                  {tree.length === 0 && !prompt ? <div className={styles.treeEmpty}>No files. Use <b>+</b> to create one.</div> : renderNodes(tree, 0)}
                </div>
              </>
            )}
            {sidebarView === "search" && (
              <>
                <div className={styles.sideHead}><span>Search</span></div>
                <div className={styles.searchBox}>
                  <input className={styles.searchInput} placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <div className={styles.searchResults}>
                  {searchQuery.trim() === "" ? <div className={styles.treeEmpty}>Type to search across all files.</div>
                    : searchResults.length === 0 ? <div className={styles.treeEmpty}>No results.</div>
                    : (<>
                        <div className={styles.searchCount}>{searchResults.length} result{searchResults.length > 1 ? "s" : ""}</div>
                        {searchResults.map((r, i) => (
                          <button key={i} type="button" className={styles.searchRow} onClick={() => gotoResult(r.path, r.line)}>
                            <span className={styles.searchPath}>{r.path}:{r.line}</span>
                            <span className={styles.searchLine}>{r.text}</span>
                          </button>
                        ))}
                      </>)}
                </div>
              </>
            )}
            {sidebarView === "scm" && (
              <>
                <div className={styles.sideHead}><span>Source Control</span></div>
                <div className={styles.sidePanelBody}>
                  <div className={styles.scmHead}>CHANGES {dirty ? "1" : "0"}</div>
                  {dirty ? <div className={styles.scmRow}><span className={styles.scmM}>M</span>{activePath || "working tree"}</div>
                    : <div className={styles.treeEmpty}>No changes since last save.</div>}
                </div>
              </>
            )}
            {sidebarView === "run" && (
              <>
                <div className={styles.sideHead}><span>Run and Debug</span></div>
                <div className={styles.sidePanelBody}>
                  <button type="button" className={styles.runBtn} onClick={() => setView("preview")}><svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M5 3v18l15-9z" /></svg> Open Live Preview</button>
                  <p className={styles.hint}>Generated apps run in a sandboxed preview — no debugger needed.</p>
                </div>
              </>
            )}
            {sidebarView === "extensions" && (
              <>
                <div className={styles.sideHead}><span>Extensions</span></div>
                <div className={styles.sidePanelBody}>
                  {[["Monaco (VS Code core)", "Editor, IntelliSense, minimap"], ["Emmet", "HTML/CSS abbreviations"], ["HTML / CSS / JS", "Built-in language services"], ["JSON", "Schema-aware editing"]].map(([n, d]) => (
                    <div key={n} className={styles.extRow}><div className={styles.extIcon} aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{I.ext}</svg></div><div><div className={styles.extName}>{n}</div><div className={styles.extDesc}>{d}</div></div></div>
                  ))}
                </div>
              </>
            )}
          </aside>
        )}

        {/* ── editor main ───────────────────────────────────── */}
        <div className={styles.editorMain}>
          <div className={styles.tabsbar}>
            <div className={styles.etabs}>
              {openPaths.map((p) => (
                <span key={p} className={styles.etab} data-active={p === (file?.path ?? "")}>
                  <span className={styles.etabIcon} aria-hidden><FileGlyph path={p} /></span>
                  <button type="button" className={styles.etabName} onClick={() => setActivePath(p)}>{p.split("/").pop()}</button>
                  <button type="button" className={styles.etabClose} onClick={() => closeTab(p)} aria-label={`Close ${p}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                </span>
              ))}
            </div>
            <div className={styles.tabsActions}>
              {(["split", "code", "preview"] as View[]).map((v) => (
                <button key={v} type="button" className={styles.viewTab} data-active={view === v} onClick={() => setView(v)} title={v === "split" ? "Split editor & preview" : v === "code" ? "Editor only" : "Preview only"}>{v[0].toUpperCase() + v.slice(1)}</button>
              ))}
              {projectId && <button type="button" className={styles.save} onClick={() => void save()} disabled={!dirty || saving}>{saving ? "Saving…" : dirty ? "Save" : "Saved"}</button>}
            </div>
          </div>

          {crumbs.length > 0 && (
            <div className={styles.breadcrumbs}>
              {crumbs.map((c, i) => (
                <span key={i} className={styles.crumb}>
                  {i > 0 && <span className={styles.crumbSep} aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg></span>}
                  {i === crumbs.length - 1 && <span className={styles.crumbIcon} aria-hidden><FileGlyph path={activePath} /></span>}
                  {c}
                </span>
              ))}
            </div>
          )}

          <div className={styles.centre}>
            <div className={styles.panes}>
              {view !== "preview" && (
                <div className={styles.editor}>
                  {file ? (
                    <Editor height="100%" path={file.path} language={langFor(file.path)} value={file.content} onChange={onChange} theme="vibex-ink" beforeMount={defineInkTheme} onMount={onMount}
                      loading={<div className={styles.editorLoading}>Loading VS Code editor…</div>}
                      options={{ fontSize: 13, fontFamily: "ui-monospace, 'Cascadia Code', Consolas, 'JetBrains Mono', monospace", minimap: { enabled: minimap }, scrollBeyondLastLine: false, tabSize: 2, wordWrap: wordWrap ? "on" : "off", automaticLayout: true, padding: { top: 10 }, smoothScrolling: true, renderLineHighlight: "all", fixedOverflowWidgets: true }} />
                  ) : <div className={styles.editorLoading}>No file open — pick one from the Explorer or create a new file.</div>}
                </div>
              )}
              {view !== "code" && (
                <div className={styles.previewPane}>
                  {previewDoc ? (
                    <iframe className={styles.frame} srcDoc={previewDoc} title="Live preview"
                      // No `allow-same-origin`: with allow-scripts it would let the (LLM-written) app
                      // escape the sandbox onto our origin. Opaque origin = no parent access.
                      sandbox="allow-scripts allow-forms allow-modals allow-popups" />
                  ) : <div className={styles.noPreview}>No HTML entry to preview — this is an API/CLI project.</div>}
                </div>
              )}
            </div>

            {panelOpen && (
              <div className={styles.panel}>
                <div className={styles.panelBar}>
                  <div className={styles.panelTabs}>
                    {([["problems", `Problems${markers.length ? ` (${markers.length})` : ""}`], ["output", "Output"], ["terminal", "Terminal"], ["ports", "Ports"]] as [PanelTab, string][]).map(([t, label]) => (
                      <button key={t} type="button" className={styles.panelTab} data-active={panelTab === t} onClick={() => setPanelTab(t)}>{label}</button>
                    ))}
                  </div>
                  <div className={styles.panelActions}>
                    {panelTab === "terminal" && logs.length > 0 && <button type="button" className={styles.panelAction} onClick={() => setLogs([])}>Clear</button>}
                    <button type="button" className={styles.panelAction} aria-label="Close panel" onClick={() => setPanelOpen(false)}><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                  </div>
                </div>
                <div className={styles.panelBody}>
                  {panelTab === "problems" && (markers.length === 0 ? <div className={styles.panelEmpty}>No problems have been detected in the workspace.</div> : (
                    markers.map((m, i) => (
                      <button key={i} type="button" className={styles.problemRow} onClick={() => gotoResult(String(m.resource.path).replace(/^\//, ""), m.startLineNumber)}>
                        <span className={styles.problemIcon} data-sev={m.severity === 8 ? "err" : "warn"} aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{m.severity === 8 ? I.err : I.warn}</svg></span>
                        <span className={styles.problemMsg}>{m.message}</span>
                        <span className={styles.problemLoc}>{String(m.resource.path).split("/").pop()}:{m.startLineNumber}</span>
                      </button>
                    ))
                  ))}
                  {panelTab === "output" && <pre className={styles.outputPre}>{output.join("\n")}</pre>}
                  {panelTab === "terminal" && (
                    <div className={styles.terminal}>
                      <div className={styles.termLine}><span className={styles.termPrompt}>vibex@preview</span> console — your app&apos;s output appears here</div>
                      {logs.map((l, i) => <div key={i} className={styles.termLine} data-level={l.level}><span className={styles.termArrow} aria-hidden>›</span>{l.text}</div>)}
                      {logs.length === 0 && <div className={styles.termLine} data-level="dim">No output yet. console.log() and runtime errors from the preview stream here.</div>}
                    </div>
                  )}
                  {panelTab === "ports" && <div className={styles.panelEmpty}>No forwarded ports. The preview runs in-browser (sandboxed) — nothing to forward.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── status bar ────────────────────────────────────────── */}
      <div className={styles.statusbar}>
        <div className={styles.statusLeft}>
          <button type="button" className={styles.statusItem} title="Source control" onClick={() => { setSidebarView("scm"); setSidebarOpen(true); }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7">{I.scm}</svg> main{dirty ? "*" : ""}
          </button>
          <button type="button" className={styles.statusItem} title="Problems" onClick={() => { setPanelOpen(true); setPanelTab("problems"); }}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.9">{I.err}</svg> {errorCount}
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.9" style={{ marginLeft: 6 }}>{I.warn}</svg> {warnCount}
          </button>
        </div>
        <div className={styles.statusRight}>
          <button type="button" className={styles.statusItem} title="Go to Line/Column" onClick={() => act("editor.action.gotoLine")}>Ln {pos.line}, Col {pos.col}</button>
          <span className={styles.statusItem}>Spaces: 2</span>
          <span className={styles.statusItem}>UTF-8</span>
          <span className={styles.statusItem}>LF</span>
          <button type="button" className={styles.statusItem} title="Select Language Mode" onClick={() => act("editor.action.quickCommand")}>{file ? langName(file.path) : "Plain Text"}</button>
          <span className={styles.statusItem} aria-label="Notifications"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7">{I.bell}</svg></span>
        </div>
      </div>

      {/* ── explorer context menu ─────────────────────────────── */}
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

function PromptRow({ depth, kind, value, onChange, onCommit, onCancel }: {
  depth: number; kind: "new-file" | "new-folder" | "rename"; value: string; onChange: (v: string) => void; onCommit: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <div className={styles.promptRow} style={{ paddingLeft: 8 + depth * 13 }}>
      <span className={styles.rowFileIcon} aria-hidden>
        {kind === "new-folder"
          ? <svg viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z" /></svg>
          : <FileGlyph path={value || "file.txt"} />}
      </span>
      <input ref={ref} className={styles.promptInput} value={value} placeholder={kind === "new-folder" ? "folder name" : "file name (e.g. app.js or lib/util.js)"}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onCommit(); } else if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
        onBlur={onCommit} />
    </div>
  );
}
