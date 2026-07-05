/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baseline security headers. nosniff + referrer policy are free wins; Permissions-Policy and
  // HSTS lock down capabilities and transport.
  //
  // NOTE: Content-Security-Policy is NOT set here — it needs a per-request nonce (for script-src),
  // so it's emitted from middleware.ts instead (a static header can't carry a fresh nonce). See
  // middleware.ts for the strict `script-src 'self' 'nonce-…'` policy and the srcdoc-preview
  // carve-out.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
