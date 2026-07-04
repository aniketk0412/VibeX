// Copies Monaco's production AMD build out of node_modules into public/, so the editor is
// served from OUR origin — no third-party CDN at runtime (works in CDN-blocked regions, and
// a future strict CSP won't need a jsdelivr exception). Runs as part of `npm run build`
// (Vercel included); run it once manually after a fresh install for local dev:
//   node scripts/copy-monaco.mjs
// public/monaco is gitignored — node_modules/monaco-editor is the source of truth.

import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, "node_modules", "monaco-editor", "min", "vs");
const dest = path.join(root, "public", "monaco", "vs");
const stamp = path.join(root, "public", "monaco", ".version");

if (!existsSync(src)) {
  console.error("monaco-editor not installed — run npm install first");
  process.exit(1);
}

const version = JSON.parse(readFileSync(path.join(root, "node_modules", "monaco-editor", "package.json"), "utf8")).version;

if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === version && existsSync(path.join(dest, "loader.js"))) {
  console.log(`monaco ${version} already staged in public/monaco — skipping copy`);
  process.exit(0);
}

rmSync(path.join(root, "public", "monaco"), { recursive: true, force: true });
mkdirSync(path.dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
writeFileSync(stamp, version + "\n", "utf8");
console.log(`monaco ${version} staged at public/monaco/vs`);
