// Renders the brand mark SVG to build/icon-512.png using Electron's offscreen renderer.
// Run: npx electron scripts/render-icon.js   (then scripts/make-icon.js converts to .ico)

const { app, BrowserWindow } = require("electron");
const { writeFileSync, mkdirSync, readFileSync } = require("node:fs");
const path = require("node:path");

app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.disableHardwareAcceleration();

const svg = readFileSync(path.join(__dirname, "..", "..", "public", "vibex-mark.svg"), "utf8")
  .replace('width="100" height="100"', 'width="512" height="512"');
const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}</style></head><body>${svg}</body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 512,
    height: 512,
    useContentSize: true,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true },
  });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 400)); // settle paint
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const out = path.join(__dirname, "..", "build");
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "icon-512.png"), image.toPNG());
  console.log("icon-512.png rendered:", image.getSize());
  app.quit();
});
