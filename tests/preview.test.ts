// buildPreview feeds both the user-visible preview and the design critic's screenshot —
// a rendering miss makes the critic "fix" artifacts instead of design, so pin the fallbacks.

import { describe, it, expect } from "vitest";
import { buildPreview } from "@/lib/preview";

const css = { path: "styles.css", content: "body{color:red}" };
const js = { path: "app.js", content: "console.log(1)" };

describe("buildPreview", () => {
  it("returns null when there is no HTML entry (API/CLI projects)", () => {
    expect(buildPreview([css, js])).toBeNull();
  });

  it("inlines referenced css/js in place of their tags", () => {
    const html = {
      path: "index.html",
      content: `<html><head><link rel="stylesheet" href="styles.css"></head><body><script src="app.js"></script></body></html>`,
    };
    const doc = buildPreview([html, css, js])!;
    expect(doc).toContain("body{color:red}");
    expect(doc).toContain("console.log(1)");
    expect(doc).not.toContain('href="styles.css"');
    expect(doc).not.toContain('src="app.js"');
  });

  it("injects assets anyway when the HTML references them in an unmatchable way", () => {
    const html = {
      path: "index.html",
      content: `<html><head><link rel="stylesheet" href="https://cdn.example.com/other.css"></head><body></body></html>`,
    };
    const doc = buildPreview([html, css, js])!;
    // unmatched css lands before </head>, unmatched js before </body>
    expect(doc.indexOf("body{color:red}")).toBeLessThan(doc.indexOf("</head>"));
    expect(doc.indexOf("console.log(1)")).toBeLessThan(doc.indexOf("</body>"));
  });

  it("does not double-inject when the reference matched", () => {
    const html = {
      path: "index.html",
      content: `<html><head><link href="styles.css" rel="stylesheet"></head><body></body></html>`,
    };
    const doc = buildPreview([html, css])!;
    expect(doc.split("body{color:red}").length - 1).toBe(1);
  });
});
