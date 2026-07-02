// capFiles bounds what a run may persist to the shared Neon DB — client-supplied content
// flows through it, so the caps are a security boundary, not a nicety.

import { describe, it, expect } from "vitest";
import { capFiles } from "@/lib/runs";

describe("capFiles", () => {
  it("passes normal engine output through untouched", () => {
    const files = [
      { path: "index.html", content: "<html></html>" },
      { path: "styles.css", content: "body{}" },
    ];
    expect(capFiles(files)).toEqual(files);
  });

  it("drops entries beyond the 24-file cap", () => {
    const files = Array.from({ length: 40 }, (_, i) => ({ path: `f${i}.txt`, content: "x" }));
    expect(capFiles(files)).toHaveLength(24);
  });

  it("truncates oversized single files", () => {
    const out = capFiles([{ path: "big.txt", content: "a".repeat(500_000) }]);
    expect(out[0].content.length).toBe(200_000);
  });

  it("stops adding files once the total budget is exhausted", () => {
    const files = Array.from({ length: 24 }, (_, i) => ({ path: `f${i}.txt`, content: "a".repeat(200_000) }));
    const out = capFiles(files);
    const total = out.reduce((s, f) => s + f.content.length, 0);
    expect(total).toBeLessThanOrEqual(1_500_000);
    expect(out.length).toBeLessThan(24);
  });

  it("skips malformed entries instead of crashing", () => {
    const bad = [{ path: 123, content: "x" }, { path: "ok.txt", content: "y" }] as never;
    expect(capFiles(bad)).toEqual([{ path: "ok.txt", content: "y" }]);
  });
});
