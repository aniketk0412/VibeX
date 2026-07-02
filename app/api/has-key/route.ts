// Lets client screens (e.g. /new) know whether a real build can run, so they can nudge the user
// to connect a key before investing time describing an idea — and whether the caller is on a
// paid plan, so paid-only affordances (reference images) aren't shown to users the server would
// ignore. No secrets returned.

import { auth } from "@/auth";
import { hasModelAccess } from "@/lib/keys";
import { getUserPlan } from "@/lib/runs";
import { isPaid } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const paid = session?.user ? isPaid(await getUserPlan(session.user.id)) : false;
  return Response.json({ hasKey: await hasModelAccess(session?.user?.id), paid });
}
