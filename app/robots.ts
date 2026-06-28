import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://vibex.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
