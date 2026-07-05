// Real, in-browser git for the IDE's Source Control panel. isomorphic-git (a full git
// implementation in pure JS) runs against @isomorphic-git/lightning-fs (a filesystem backed by
// IndexedDB). Everything is client-side and free — real commits, history, and diffs, no server.
//
// Scope: a fresh repo is seeded per editor mount (`wipe: true`) with the current files as the
// "Initial import" commit, so the baseline is always the loaded project. Edits then show up as
// changes; committing builds real history for the session. Publishing to a remote is handled
// separately by the existing GitHub export (which uses the user's token).

import FS from "@isomorphic-git/lightning-fs";
import git from "isomorphic-git";
import type { GenFile } from "@/lib/steps";

const AUTHOR = { name: "Vibex", email: "editor@vibex.app" };

export type GitChange = { path: string; status: "M" | "A" | "D" };
export type GitCommit = { oid: string; message: string; author: string; timestamp: number };

export class GitRepo {
  private fs: FS;
  private dir = "/repo";
  constructor(name: string) {
    // wipe: a clean baseline every mount — no cross-session confusion.
    this.fs = new FS(`vibex-git-${name}`, { wipe: true });
  }
  private base() {
    return { fs: this.fs, dir: this.dir };
  }

  async init(files: GenFile[]) {
    try { await this.fs.promises.mkdir(this.dir); } catch { /* exists */ }
    await git.init({ ...this.base(), defaultBranch: "main" });
    await this.writeAll(files);
    await this.stageAll();
    await git.commit({ ...this.base(), message: "Initial import", author: AUTHOR });
  }

  private async mkdirp(dir: string) {
    const parts = dir.split("/").filter(Boolean);
    let cur = "";
    for (const p of parts) { cur += `/${p}`; try { await this.fs.promises.mkdir(cur); } catch { /* exists */ } }
  }

  // Mirror the editor's files into the working tree, deleting any that were removed.
  async writeAll(files: GenFile[]) {
    for (const f of files) {
      const full = `${this.dir}/${f.path}`;
      await this.mkdirp(full.slice(0, full.lastIndexOf("/")));
      await this.fs.promises.writeFile(full, f.content);
    }
    const present = new Set(files.map((f) => f.path));
    for (const p of await this.listFiles()) {
      if (!present.has(p)) { try { await this.fs.promises.unlink(`${this.dir}/${p}`); } catch { /* gone */ } }
    }
  }

  private async listFiles(rel = ""): Promise<string[]> {
    const out: string[] = [];
    let entries: string[] = [];
    try { entries = await this.fs.promises.readdir(`${this.dir}${rel}`); } catch { return out; }
    for (const e of entries) {
      if (e === ".git") continue;
      const childRel = `${rel}/${e}`;
      const st = await this.fs.promises.stat(`${this.dir}${childRel}`);
      if (st.isDirectory()) out.push(...(await this.listFiles(childRel)));
      else out.push(childRel.replace(/^\//, ""));
    }
    return out;
  }

  private async stageAll() {
    const matrix = await git.statusMatrix(this.base());
    for (const [filepath, head, workdir] of matrix) {
      if (workdir === 0 && head === 1) await git.remove({ ...this.base(), filepath });
      else if (!(head === 1 && workdir === 1)) await git.add({ ...this.base(), filepath });
    }
  }

  // Files whose working-tree state differs from HEAD (the SCM "Changes" list).
  async changes(): Promise<GitChange[]> {
    const matrix = await git.statusMatrix(this.base());
    const out: GitChange[] = [];
    for (const [filepath, head, workdir] of matrix) {
      if (head === 1 && workdir === 1) continue; // unmodified
      out.push({ path: filepath, status: head === 0 ? "A" : workdir === 0 ? "D" : "M" });
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  // Stage everything and commit — the "commit all changes" flow.
  async commitAll(message: string): Promise<boolean> {
    const changed = await this.changes();
    if (!changed.length) return false;
    await this.stageAll();
    await git.commit({ ...this.base(), message, author: AUTHOR });
    return true;
  }

  async log(depth = 40): Promise<GitCommit[]> {
    try {
      const commits = await git.log({ ...this.base(), depth });
      return commits.map((c) => ({
        oid: c.oid,
        message: c.commit.message.trim(),
        author: c.commit.author.name,
        timestamp: c.commit.author.timestamp * 1000,
      }));
    } catch {
      return [];
    }
  }

  // The committed (HEAD) content of a file — the "original" side of a diff.
  async headContent(path: string): Promise<string> {
    try {
      const oid = await git.resolveRef({ ...this.base(), ref: "HEAD" });
      const { blob } = await git.readBlob({ ...this.base(), oid, filepath: path });
      return new TextDecoder().decode(blob);
    } catch {
      return "";
    }
  }

  async currentBranch(): Promise<string> {
    try { return (await git.currentBranch({ ...this.base(), fullname: false })) || "main"; } catch { return "main"; }
  }
  async branches(): Promise<string[]> {
    try { return await git.listBranches(this.base()); } catch { return ["main"]; }
  }
  async createBranch(name: string) {
    await git.branch({ ...this.base(), ref: name, checkout: true });
  }
}
