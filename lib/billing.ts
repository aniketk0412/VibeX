// Billing via LemonSqueezy — fully wired but inert until the env keys are set. When configured,
// the pricing CTAs create a hosted checkout, and the webhook flips the user's plan on purchase.
// Set LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_WEBHOOK_SECRET, and the per-plan
// variant ids to activate. Server-only.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export function billingConfigured(): boolean {
  return !!(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID);
}

function variantFor(plan: string): string | undefined {
  if (plan === "starter") return process.env.LEMONSQUEEZY_VARIANT_STARTER;
  if (plan === "pro") return process.env.LEMONSQUEEZY_VARIANT_PRO;
  if (plan === "scale") return process.env.LEMONSQUEEZY_VARIANT_SCALE;
  return undefined;
}

export function planForVariant(variantId: string): string | null {
  if (!variantId) return null;
  if (variantId === process.env.LEMONSQUEEZY_VARIANT_STARTER) return "starter";
  if (variantId === process.env.LEMONSQUEEZY_VARIANT_PRO) return "pro";
  if (variantId === process.env.LEMONSQUEEZY_VARIANT_SCALE) return "scale";
  return null;
}

// Hosted checkout URL for a plan. Returns null until billing is configured.
export async function createCheckoutUrl(plan: string, userId: string, email?: string): Promise<string | null> {
  if (!billingConfigured()) return null;
  const variant = variantFor(plan);
  if (!variant) return null;
  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: { checkout_data: { email, custom: { user_id: userId } } },
        relationships: {
          store: { data: { type: "stores", id: String(process.env.LEMONSQUEEZY_STORE_ID) } },
          variant: { data: { type: "variants", id: String(variant) } },
        },
      },
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return (j?.data?.attributes?.url as string) ?? null;
}

export function verifyWebhook(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function setUserPlanById(userId: string, plan: string) {
  const p = ["free", "starter", "pro", "scale"].includes(plan) ? plan : "free";
  await prisma.user.update({ where: { id: userId }, data: { plan: p } }).catch(() => {});
}
