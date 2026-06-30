// Lightweight CSRF guard for POST route handlers. Server Actions get Next's built-in CSRF
// protection, but custom route handlers authenticate purely via the session cookie — so a
// cross-site credentialed POST could trigger them. Browsers always send Origin on cross-site
// POSTs; we allow a missing Origin (non-browser clients carry no victim cookies anyway).
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
