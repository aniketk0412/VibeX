// Design RAG: the always-on rubric + retrieval over the DesignReference store. Retrieval is
// resilient — it uses pgvector cosine search when a query embedding is available, and otherwise
// falls back to a category match, so the critic always gets references even with no embedding key.

import { prisma } from "@/lib/prisma";

// Always injected into the critic, regardless of retrieval. The non-negotiable quality bar.
export const DESIGN_RUBRIC = `Quality bar — a hand-crafted UI, never a default template:
- Typography: a characterful display face for headings + a clean body face, a deliberate scale, real weight contrast. Not one system font at one size.
- Spacing: a consistent 4/8px rhythm with generous whitespace (64-96px between sections). Not uniform cramped gaps.
- Colour: a warm, considered palette with ONE confident accent. Not pure white/black or default blue/grey.
- Layout: intentional composition and asymmetry where it helps. Not a single centered column of identical cards.
- Depth: a shadow scale + tinted hairline borders. Not flat bordered boxes.
- Detail & motion: focus states, hover lifts, tasteful entrance motion, real empty/loading states.
- Accessibility: legible contrast (WCAG AA), visible keyboard focus, labelled controls/inputs, and status conveyed by more than colour alone.`;

export type RetrievedRef = { title: string; body: string };

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// Top-k references for a build. With a query embedding, ranks by cosine similarity over the
// (small) corpus in JS; otherwise falls back to a category-then-general ordering.
export async function retrieveDesignRefs(
  queryVec: number[] | null,
  category: string | undefined,
  k = 4,
): Promise<RetrievedRef[]> {
  let rows: { title: string; body: string; category: string; embedding: number[] }[];
  try {
    rows = await prisma.designReference.findMany({
      select: { title: true, body: true, category: true, embedding: true },
    });
  } catch {
    return [];
  }
  if (!rows.length) return [];

  if (queryVec && queryVec.length) {
    const scored = rows
      .filter((r) => r.embedding && r.embedding.length)
      .map((r) => ({ r, s: cosine(queryVec, r.embedding) }))
      .sort((a, b) => b.s - a.s);
    if (scored.length) return scored.slice(0, k).map(({ r }) => ({ title: r.title, body: r.body }));
  }

  const rank = (c: string) => (c === category ? 0 : c === "general" ? 1 : 2);
  return rows
    .sort((a, b) => rank(a.category) - rank(b.category))
    .slice(0, k)
    .map((r) => ({ title: r.title, body: r.body }));
}

// Map an interview platform label to a corpus category for retrieval/fallback.
export function categoryForSpec(platform?: string): string {
  const p = (platform ?? "").toLowerCase();
  if (p.includes("api") || p.includes("cli")) return "tool";
  if (p.includes("dashboard") || p.includes("admin")) return "dashboard";
  return "landing";
}

// Render retrieved references into the block the critic reads.
export function formatRefs(refs: RetrievedRef[]): string {
  return refs.map((r) => `• ${r.title}: ${r.body}`).join("\n");
}
