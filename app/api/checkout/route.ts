// Upgrade entry point. /api/checkout?plan=pro → a LemonSqueezy hosted checkout when billing is
// configured; otherwise back to /pricing. Requires sign-in.

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { createCheckoutUrl, billingConfigured } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const plan = url.searchParams.get("plan") ?? "";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  const session = await auth();
  if (!session?.user) return Response.redirect(`${base}/signin`);
  if (!billingConfigured()) return Response.redirect(`${base}/pricing?billing=soon`);

  const checkout = await createCheckoutUrl(plan, session.user.id, session.user.email ?? undefined);
  return Response.redirect(checkout ?? `${base}/pricing?billing=soon`);
}
