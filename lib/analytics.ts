// Product funnel events (Vercel Analytics custom events). One thin wrapper so call sites stay
// one-liners and a tracking failure can never break the product. Client components only.
//
// The funnel: interview_started → goal_locked → build_started → build_completed → shipped.

import { track } from "@vercel/analytics";

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  try {
    track(name, props);
  } catch {
    /* analytics must never break the app */
  }
}
