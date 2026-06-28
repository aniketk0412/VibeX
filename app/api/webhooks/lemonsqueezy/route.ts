// LemonSqueezy webhook — verifies the signature and flips the user's plan on purchase / change.
// Inert until LEMONSQUEEZY_WEBHOOK_SECRET (and the variant ids) are set.

import type { NextRequest } from "next/server";
import { verifyWebhook, planForVariant, setUserPlanById } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }

  let body: {
    meta?: { event_name?: string; custom_data?: { user_id?: string } };
    data?: { attributes?: { variant_id?: number; first_order_item?: { variant_id?: number } } };
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const event = body.meta?.event_name;
  const userId = body.meta?.custom_data?.user_id;
  const attrs = body.data?.attributes;
  const variantId = String(attrs?.variant_id ?? attrs?.first_order_item?.variant_id ?? "");

  if (userId) {
    if (event === "order_created" || event === "subscription_created" || event === "subscription_updated") {
      const plan = planForVariant(variantId);
      if (plan) await setUserPlanById(userId, plan);
    } else if (event === "subscription_expired" || event === "subscription_cancelled") {
      await setUserPlanById(userId, "free");
    }
  }

  return new Response("ok");
}
