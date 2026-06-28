import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://vibex.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/pricing", "/new", "/signin"];
  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
