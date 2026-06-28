// Streams the dual-AI engine to the /run screen as Server-Sent Events.
// POST { spec, startIndex } → text/event-stream of RunEvent JSON.
// Aborting the request (client interrupt) cancels the engine at the next step boundary.

import type { NextRequest } from "next/server";
import { runEngine } from "@/lib/engine";
import type { Spec } from "@/lib/steps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const spec: Spec = body?.spec ?? {};
  const startIndex = typeof body?.startIndex === "number" ? body.startIndex : 0;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        for await (const ev of runEngine(spec, { startIndex, signal: req.signal })) {
          send(ev);
        }
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "engine error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
