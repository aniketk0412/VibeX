import type { GenFile } from "@/lib/steps";

// Inline CSS/JS into the HTML so a generated static app can render standalone in an iframe.
// Returns null when there's no HTML entry (API / CLI projects aren't previewable).

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildPreview(files: GenFile[]): string | null {
  const html = files.find((f) => /\.html$/i.test(f.path));
  if (!html) return null;
  let doc = html.content;
  for (const f of files.filter((x) => /\.css$/i.test(x.path))) {
    const name = f.path.split("/").pop() ?? f.path;
    doc = doc.replace(new RegExp(`<link[^>]*href=["'][^"']*${escapeRe(name)}["'][^>]*>`, "gi"), `<style>\n${f.content}\n</style>`);
  }
  for (const f of files.filter((x) => /\.js$/i.test(x.path))) {
    const name = f.path.split("/").pop() ?? f.path;
    doc = doc.replace(new RegExp(`<script[^>]*src=["'][^"']*${escapeRe(name)}["'][^>]*>\\s*</script>`, "gi"), `<script>\n${f.content}\n</script>`);
  }
  return doc;
}
