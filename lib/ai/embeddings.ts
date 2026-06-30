// Text embeddings for the design RAG. OpenAI text-embedding-3-small (1536-d), BYOK key first
// then the server env key. Returns null when no key is available — callers then fall back to the
// curated rubric without semantic retrieval, so the feature degrades gracefully.

export const EMBED_DIM = 1536;
const EMBED_MODEL = "text-embedding-3-small";

export async function embed(text: string, keys: { openai?: string } = {}): Promise<number[] | null> {
  const apiKey = keys.openai ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const vec = j?.data?.[0]?.embedding;
    return Array.isArray(vec) && vec.length === EMBED_DIM ? (vec as number[]) : null;
  } catch {
    return null;
  }
}
