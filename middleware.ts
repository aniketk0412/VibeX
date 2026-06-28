// "Keep me signed in" opt-out. When the user unchecks it on /signin, a `vibex-remember=0`
// cookie is set client-side. On each authenticated request we re-issue the Auth.js session
// cookie with NO Max-Age, turning it into a session cookie that the browser clears on close.
// When the box stays checked (default) the cookie is absent and the 30-day session stands.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function middleware(req: NextRequest) {
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
