import type { MetadataRoute } from "next";

// PWA / install manifest. Mirrors the brand champagne-on-ink palette.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vibex — From idea to code, automatically",
    short_name: "Vibex",
    description:
      "Vibex automates the entire vibe-coding loop — describe an idea once, and it interviews you, locks the goal, then generates and runs every prompt until it's done.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0C10",
    theme_color: "#5E5CE6",
    icons: [
      { src: "/vibex-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    categories: ["developer", "productivity", "utilities"],
  };
}
