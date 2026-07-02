/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baseline security headers. frame-ancestors 'self' stops other sites from framing the app
  // (clickjacking on dashboard/settings); nosniff + referrer policy are free wins. A full CSP
  // (script-src etc.) is deliberately omitted — the app relies on inline scripts (theme init,
  // JSON-LD, Next hydration) and srcdoc previews, so a strict CSP needs its own careful pass.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
