// vibex build — create (or reuse) a project, stream the Coder+Reviewer build, and write the
// generated files into a local folder. The stream is the same SSE feed the web workspace uses.

import { mkdirSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { createProject, streamRun } from "./api.js";
import { loadConfig } from "./config.js";
import { banner, info, stepLine, coderLine, reviewerLine, done, fileList, fail, warn, link } from "./ui.js";
import type { GenFile } from "./types.js";

function slugify(idea: string): string {
  return (
    idea
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .slice(0, 40) || "vibex-app"
  );
}

// Generated paths are model output — never let one escape the target folder.
function safeJoin(root: string, rel: string): string | null {
  if (path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) return null;
  const norm = path.normalize(rel);
  if (norm.startsWith("..") || norm.includes(`..${path.sep}`)) return null;
  return path.join(root, norm);
}

function writeFiles(dir: string, files: GenFile[]): string[] {
  const written: string[] = [];
  for (const f of files) {
    const target = safeJoin(dir, f.path);
    if (!target) {
      warn(`skipped unsafe path: ${f.path}`);
      continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, f.content, "utf8");
    written.push(f.path);
  }
  return written;
}

export async function runBuild(
  idea: string,
  opts: { dir?: string; platform?: string; project?: string; steer?: string; force?: boolean },
) {
  const cfg = loadConfig();
  if (!cfg.token) {
    fail("Not signed in — run `vibex login` first (token: Settings → CLI access on the web app).");
    process.exit(1);
  }
  if (!idea.trim() && !opts.project) {
    fail('Tell it what to build: vibex build "a habit tracker with streaks"');
    process.exit(1);
  }

  const dir = path.resolve(opts.dir ?? `./${slugify(idea || opts.project || "vibex-app")}`);
  if (existsSync(dir) && readdirSync(dir).length > 0 && !opts.force) {
    fail(`${dir} isn't empty — pick another --dir or pass --force to write into it.`);
    process.exit(1);
  }

  // 1) Project row (owned, so the run persists and shows on the web dashboard).
  let projectId = opts.project;
  let title = idea.trim();
  if (!projectId) {
    const p = await createProject(cfg.baseUrl!, cfg.token, { idea: idea.trim(), platform: opts.platform ?? "web" });
    projectId = p.id;
    title = p.title || title;
  }

  banner(`Building ${pc.yellow(`"${title || projectId}"`)}`);
  info(`server: ${cfg.baseUrl} · project: ${projectId}`);

  // 2) Stream the build.
  let stepsTotal = 0;
  let files: GenFile[] = [];
  let tokens = 0;
  let cost = 0;
  let live = true;
  let paused: string | null = null;
  let errored: string | null = null;

  for await (const ev of streamRun(cfg.baseUrl!, cfg.token, projectId, { steer: opts.steer })) {
    switch (ev.type) {
      case "planned":
        stepsTotal = ev.steps.length;
        live = ev.live;
        info(`planned ${ev.steps.length} steps${ev.live ? "" : " (simulated — no model key on the server)"}`);
        break;
      case "step_start":
        stepLine(ev.index + 1, stepsTotal || ev.index + 1, ev.title);
        break;
      case "coder":
        if (ev.path) coderLine(ev.path, ev.tokens, ev.stub);
        break;
      case "reviewer":
        reviewerLine(ev.verdict, ev.note);
        break;
      case "usage":
        tokens = ev.tokens;
        cost = ev.cost;
        break;
      case "paused":
        paused = `${ev.reason} — progress is saved; resume with: vibex build --project ${projectId}`;
        break;
      case "complete":
        files = ev.files ?? [];
        tokens = ev.tokens;
        cost = ev.cost;
        break;
      case "error":
        errored = ev.message;
        break;
      default:
        break;
    }
  }

  if (errored) {
    fail(`The engine hit an error: ${errored}`);
    info(`retry from the last completed step: vibex build --project ${projectId}`);
    process.exit(1);
  }
  if (paused) {
    warn(paused);
    process.exit(2);
  }
  if (!files.length) {
    fail("The build finished without producing files — check the project on the web dashboard.");
    link("dashboard:", `${cfg.baseUrl}/result?project=${projectId}`);
    process.exit(1);
  }

  // 3) Land the files.
  mkdirSync(dir, { recursive: true });
  const written = writeFiles(dir, files);

  done(`Build complete ${pc.dim(`— ${(tokens / 1000).toFixed(1)}k tokens · ~$${cost.toFixed(2)}${live ? "" : " · simulated"}`)}`);
  fileList(written, dir);
  for (const p of written) console.log(`     ${pc.dim("+")} ${p}`);
  link("web view:", `${cfg.baseUrl}/result?project=${projectId}`);
  if (written.includes("index.html")) info(`open ${path.join(dir, "index.html")} in a browser to run it`);
}
