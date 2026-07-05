// App-surface gatekeeper + site-wide Content-Security-Policy. Three jobs:
//
// 1. AUTH GATE — the app screens (PROTECTED) require a session. Signed-out visitors are bounced
//    to /signin with a callbackUrl. The cookie-presence check here is the fast UX path; server
//    components and API routes re-verify with auth() and are the real gate — a forged cookie sees
//    static UI shells, never data or model spend.
//
// 2. CSP with a per-request nonce — the real XSS backstop. Every HTML route gets it (that's why
//    this now runs site-wide, not just on the protected routes). Non-preview routes get a strict
//    `script-src 'self' 'nonce-…'`: no inline scripts run unless they carry this request's nonce,
//    which blocks injected <script> and on*= event-handler XSS. Next auto-stamps the nonce onto
//    its own hydration scripts (it reads it from the request CSP header we set below); our two
//    inline scripts (theme init, JSON-LD) read it via headers() → x-nonce.
//
//    PREVIEW routes (/run, /result) are the exception: they embed the srcdoc live-preview iframe,
//    and a srcdoc document INHERITS the parent page's CSP even when sandboxed to an opaque origin.
//    A nonce there would block the LLM-generated app's own inline scripts and break the preview,
//    so those routes keep a script-src-free policy. The generated code is already contained by the
//    iframe sandbox (allow-scripts WITHOUT allow-same-origin = opaque origin, no parent access).
//
// 3. "Keep me signed in" opt-out — when `vibex-remember=0`, re-issue the Auth.js session cookie
//    with no Max-Age so the browser clears it on close.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

// Screens that require a session. Public routes (landing, pricing, legal, signin, download) are
// absent — they get the CSP but no auth gate.
const PROTECTED = ["/dashboard", "/settings", "/result", "/run", "/new", "/interview"];

// Routes that embed the srcdoc preview iframe (see job #2). These skip the strict script-src.
const PREVIEW = ["/run", "/result"];

// CSP directives shared by both policies — script-src is the only difference. worker-src allows the
// self-hosted Monaco language workers, which load via a blob: proxy (see CodeIDE MonacoEnvironment).
const COMMON_CSP = "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; worker-src 'self' blob:";

function isMatch(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProtected = isMatch(pathname, PROTECTED);
  const isPreview = isMatch(pathname, PREVIEW);
  const hasSession = SESSION_COOKIES.some((n) => !!req.cookies.get(n)?.value);

  // 1) Auth gate — protected screens only.
  if (isProtected && !hasSession) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  // 2) Per-request nonce + CSP. 128-bit hex — opaque token, no base64 padding to escape in a header.
  // Dev needs 'unsafe-eval': Next's HMR / react-refresh evals modules, which a nonce-only
  // script-src would block (blank page under `next dev`). Production never evals, so it stays strict.
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const evalSrc = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
  const csp = isPreview ? COMMON_CSP : `script-src 'self' 'nonce-${nonce}'${evalSrc}; ${COMMON_CSP}`;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next extracts the nonce from THIS header to stamp it onto its own scripts. (Harmless on preview
  // routes: no nonce in their CSP means Next finds none and leaves its scripts un-nonced, which is
  // fine because those routes don't restrict script-src.)
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);

  // 3) "Keep me signed in" opt-out.
  if (hasSession && req.cookies.get("vibex-remember")?.value === "0") {
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
  }

  return res;
}

export const config = {
  // Run on every page so the CSP applies site-wide. Exclude API routes (JSON, no CSP benefit and
  // they must skip the auth redirect), Next internals, the self-hosted Monaco assets, and the
  // favicon. Other /public files match but only receive a harmless CSP header.
  matcher: ["/((?!api|_next/static|_next/image|monaco|favicon.ico).*)"],
};
