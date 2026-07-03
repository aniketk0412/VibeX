// App-surface gatekeeper. Two jobs:
//
// 1. AUTH GATE — every matched route (the app screens) requires a session. Signed-out visitors
//    keep only the basic tabs (landing, pricing, legal, signin) and are bounced to /signin with
//    a callbackUrl back to where they were headed. The cookie-presence check here is the fast
//    UX path; server components and API routes re-verify with auth() and are the real gate — a
//    forged cookie sees static UI shells, never data or model spend.
//
// 2. "Keep me signed in" opt-out — when the user unchecks it on /signin, a `vibex-remember=0`
//    cookie is set client-side. On each authenticated request we re-issue the Auth.js session
//    cookie with NO Max-Age, turning it into a session cookie the browser clears on close.
//    When the box stays checked (default) the cookie is absent and the 30-day session stands.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function middleware(req: NextRequest) {
  const hasSession = SESSION_COOKIES.some((n) => !!req.cookies.get(n)?.value);
  if (!hasSession) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  if (req.cookies.get("vibex-remember")?.value !== "0") return res;

  for (const name of SESSION_COOKIES) {
    const cookie = req.cookies.get(name);
    if (!cookie) continue;
    res.cookies.set({
      name,
      value: cookie.value,
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
      path: "/",
      // intentionally no maxAge/expires → session cookie
    });
  }
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/result/:path*", "/run/:path*", "/new/:path*", "/interview/:path*"],
};
