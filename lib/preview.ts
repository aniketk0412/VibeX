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

  // Replace each referenced asset in place. If the generated HTML references the file in a way the
  // filename regex misses (subfolder path, absolute URL, typo'd name), inject the asset anyway —
  // an unstyled preview both looks broken to the user and makes the design critic score a
  // rendering artifact instead of the actual design.
  for (const f of files.filter((x) => /\.css$/i.test(x.path))) {
    const name = f.path.split("/").pop() ?? f.path;
    const tag = `<style>\n${f.content}\n</style>`;
    const next = doc.replace(new RegExp(`<link[^>]*href=["'][^"']*${escapeRe(name)}["'][^>]*>`, "gi"), tag);
    doc = next !== doc ? next : /<\/head>/i.test(doc) ? doc.replace(/<\/head>/i, `${tag}\n</head>`) : tag + doc;
  }
  for (const f of files.filter((x) => /\.js$/i.test(x.path))) {
    const name = f.path.split("/").pop() ?? f.path;
    const tag = `<script>\n${f.content}\n</script>`;
    const next = doc.replace(new RegExp(`<script[^>]*src=["'][^"']*${escapeRe(name)}["'][^>]*>\\s*</script>`, "gi"), tag);
    doc = next !== doc ? next : /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, `${tag}\n</body>`) : doc + tag;
  }
  return doc;
}
