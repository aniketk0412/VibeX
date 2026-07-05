// One-shot seeder for the design RAG corpus. Idempotent (clears then re-inserts). Embeddings are
// stored as a Float[] (cosine is computed in JS at retrieval); rows still seed without an embedding
// key, in which case retrieval falls back to category match. Guarded: open in dev, secret in prod.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { DESIGN_CORPUS } from "@/lib/designCorpus";
import { embed } from "@/lib/ai/embeddings";
import { safeEqual } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Always require the secret — no dev bypass (a mis-set NODE_ENV must never expose seeding).
  const secret = process.env.SEED_SECRET;
  const provided = req.headers.get("x-seed-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!secret || !provided || !safeEqual(provided, secret)) return new Response("Forbidden", { status: 403 });

  try {
    await prisma.designReference.deleteMany();
    let embedded = 0;
    for (const ref of DESIGN_CORPUS) {
      const vec = await embed(`${ref.title}\n${ref.body}`);
      if (vec) embedded++;
      await prisma.designReference.create({
        data: { category: ref.category, title: ref.title, body: ref.body, embedding: vec ?? [] },
      });
    }
    return Response.json({ ok: true, seeded: DESIGN_CORPUS.length, embedded });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "seed failed" }, { status: 500 });
  }
}
