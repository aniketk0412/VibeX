// Renders public/og.png (1200x630 social card) in the current brand — graphite ground,
// indigo mark, porcelain type. Run: npx electron scripts/render-og.js  (from desktop/)

const { app, BrowserWindow } = require("electron");
const { writeFileSync } = require("node:fs");
const path = require("node:path");

app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.disableHardwareAcceleration();

const html = `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden; position: relative;
    background: #0B0C10;
    font-family: "Segoe UI", system-ui, sans-serif;
    color: #EEEFF3;
  }
  .glow1 { position: absolute; width: 700px; height: 700px; top: -320px; left: -180px; border-radius: 50%;
    background: radial-gradient(circle, rgba(94,92,230,0.5), transparent 65%); }
  .glow2 { position: absolute; width: 640px; height: 640px; bottom: -340px; right: -160px; border-radius: 50%;
    background: radial-gradient(circle, rgba(56,189,248,0.28), transparent 65%); }
  .watermark { position: absolute; right: -70px; top: 60px; opacity: 0.08; }
  .card { position: relative; height: 100%; padding: 84px 90px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 34px; }
  .mark { width: 132px; height: 132px; border-radius: 30px; background: #5E5CE6;
    display: grid; place-items: center; box-shadow: 0 30px 80px -20px rgba(94,92,230,0.55); }
  .word { font-size: 118px; font-weight: 700; letter-spacing: -0.035em; }
  .word b { color: #7B79F1; font-weight: 700; }
  .tag { margin-top: 44px; font-size: 44px; font-weight: 350; color: #A5A9B8; letter-spacing: -0.01em; }
  .tag b { color: #EEEFF3; font-weight: 600; }
  .foot { margin-top: auto; display: flex; align-items: center; gap: 14px;
    font-family: Consolas, ui-monospace, monospace; font-size: 24px; color: #6B7084; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #32D583; }
</style></head><body>
  <div class="glow1"></div><div class="glow2"></div>
  <svg class="watermark" width="560" height="560" viewBox="0 0 100 100" fill="none">
    <g stroke="#5E5CE6" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
      <path d="M30 33 L47 50 L30 67"/><path d="M48 33 L65 50 L48 67"/>
    </g>
  </svg>
  <div class="card">
    <div class="brand">
      <div class="mark">
        <svg width="76" height="76" viewBox="0 0 100 100" fill="none">
          <g stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
            <path d="M30 33 L47 50 L30 67"/><path d="M48 33 L65 50 L48 67"/>
          </g>
        </svg>
      </div>
      <div class="word">Vibe<b>x</b></div>
    </div>
    <div class="tag">You have the idea. <b>A Coder + Reviewer AI pair builds it</b> — until it actually runs.</div>
    <div class="foot"><span class="dot"></span> vibex · from idea to code, automatically</div>
  </div>
</body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 630,
    useContentSize: true,
    frame: false,
    webPreferences: { offscreen: true },
  });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 500));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1200, height: 630 });
  const out = path.join(__dirname, "..", "..", "public", "og.png");
  writeFileSync(out, image.toPNG());
  console.log("og.png rendered:", image.getSize(), "->", out);
  app.quit();
});
