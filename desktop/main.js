// Vibex desktop — an Electron shell around the hosted app, plus the native powers a browser
// tab can't have (folder picker + direct file writes via the preload bridge). Same pattern as
// Slack/Notion/Claude desktop: the web app is the product; the shell adds the OS.

const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require("electron");
const { writeFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");

// Prod by default; point at a local dev server with VIBEX_APP_URL=http://localhost:3005
const APP_URL = process.env.VIBEX_APP_URL || "https://vibe-x-liart.vercel.app";
const APP_ORIGIN = new URL(APP_URL).origin;

let win = null;

// One Vibex window per machine — a second launch focuses the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: "#0B0C10", // brand ink — no white flash while the app loads
    icon: path.join(__dirname, "build", "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs contextBridge + ipcRenderer only
    },
  });

  Menu.setApplicationMenu(null);

  win.loadURL(APP_URL).catch(() => {
    win?.loadFile(path.join(__dirname, "offline.html"));
  });
  win.webContents.on("did-fail-load", (_e, code) => {
    if (code !== -3 /* aborted (in-app navigation) */) {
      win?.loadFile(path.join(__dirname, "offline.html"));
    }
  });

  // Keep the window on our origin; everything else (deploys, GitHub, StackBlitz) opens in the
  // system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    const origin = new URL(url).origin;
    if (origin !== APP_ORIGIN && !url.startsWith("file:")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  win.on("closed", () => {
    win = null;
  });
}

// ── native bridge: save a generated project to a local folder ─────────────
// The renderer is REMOTE web content, so treat every payload as untrusted: only accept calls
// from our origin, sanitize every path against traversal, and cap sizes.
function safeJoin(root, rel) {
  if (typeof rel !== "string" || !rel || path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) return null;
  const norm = path.normalize(rel);
  if (norm.startsWith("..") || norm.includes(`..${path.sep}`)) return null;
  return path.join(root, norm);
}

ipcMain.handle("vibex:save-project", async (event, payload) => {
  try {
    if (new URL(event.senderFrame.url).origin !== APP_ORIGIN) return { error: "forbidden" };
  } catch {
    return { error: "forbidden" };
  }
  const files = Array.isArray(payload?.files) ? payload.files.slice(0, 64) : [];
  if (!files.length) return { error: "no_files" };

  const picked = await dialog.showOpenDialog(win, {
    title: "Choose a folder for this project",
    properties: ["openDirectory", "createDirectory"],
  });
  if (picked.canceled || !picked.filePaths[0]) return { canceled: true };

  const suggested = String(payload?.name || "vibex-app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 40) || "vibex-app";
  const root = path.join(picked.filePaths[0], suggested);

  let written = 0;
  for (const f of files) {
    const target = safeJoin(root, f?.path);
    const content = typeof f?.content === "string" ? f.content : null;
    if (!target || content === null || content.length > 2_000_000) continue;
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
    written++;
  }
  if (written > 0) shell.openPath(root);
  return { ok: true, written, dir: root };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
