// Terminal rendering — small, deliberate, no spinner theater. Events stream steadily, so each
// one prints a line; color carries the role coding (coder = orange-ish, reviewer = green),
// mirroring the web app's conversation feed.

import pc from "picocolors";

export const sym = {
  mark: pc.yellow("◆"),
  ok: pc.green("✔"),
  warn: pc.yellow("▲"),
  fail: pc.red("✖"),
  pen: pc.yellow("✎"),
  dot: pc.dim("·"),
};

export function banner(text: string) {
  console.log(`\n${sym.mark} ${pc.bold(text)}`);
}

export function info(text: string) {
  console.log(`  ${pc.dim(text)}`);
}

export function stepLine(n: number, of: number, title: string) {
  console.log(`\n${pc.dim(`${String(n).padStart(2)}/${of}`)} ${pc.bold(title)}`);
}

export function coderLine(path: string, tokens: number, stub?: boolean) {
  if (stub) {
    console.log(`     ${sym.warn} ${pc.yellow(`placeholder for ${path}`)} ${pc.dim("(model unavailable)")}`);
  } else {
    console.log(`     ${sym.pen} wrote ${pc.bold(path)} ${pc.dim(`(${(tokens / 1000).toFixed(1)}k tok)`)}`);
  }
}

export function reviewerLine(verdict: "pass" | "revise", note: string) {
  const chip = verdict === "pass" ? pc.green("PASS") : pc.yellow("REVISE");
  console.log(`     ${chip} ${note}`);
}

export function done(text: string) {
  console.log(`\n${sym.ok} ${pc.bold(text)}`);
}

export function fileList(paths: string[], dir: string) {
  console.log(`  ${pc.dim("→")} ${paths.length} file${paths.length === 1 ? "" : "s"} written to ${pc.bold(dir)}`);
}

export function fail(text: string) {
  console.error(`\n${sym.fail} ${pc.red(text)}`);
}

export function warn(text: string) {
  console.log(`${sym.warn} ${pc.yellow(text)}`);
}

export function link(label: string, url: string) {
  console.log(`  ${pc.dim(label)} ${pc.underline(pc.cyan(url))}`);
}
