/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baseline security headers. frame-ancestors 'self' stops other sites from framing the app
  // (clickjacking on dashboard/settings); nosniff + referrer policy are free wins.
  //
  // The CSP here is the defense-in-depth subset that does NOT need per-request nonces, so it can
  // ship without breaking the app's inline scripts (theme init, JSON-LD, Next hydration) or the
  // srcdoc previews:
  //   object-src 'none'   — no <embed>/<object>/plugin execution (a legacy XSS vector)
  //   base-uri 'self'     — blocks <base> injection redirecting every relative URL to an attacker
  //   form-action 'self'  — an injected <form> can't exfiltrate to an off-site endpoint
  //                         (OAuth uses 302 redirects, which form-action doesn't govern)
  // A full script-src (which requires threading a nonce through those inline scripts) is the
  // remaining pass and is tracked separately.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // 6 months, no preload commitment yet — long enough to matter, short enough to unwind.
          { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
