// Lets client screens (e.g. /new) know whether a real build can run, so they can nudge the user
// to connect a key before investing time describing an idea. No secrets returned — just a boolean.

import { auth } from "@/auth";
import { hasModelAccess } from "@/lib/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  return Response.json({ hasKey: await hasModelAccess(session?.user?.id) });
}
