import type { MetadataRoute } from "next";

// PWA / install manifest. Mirrors the brand ember-on-charcoal palette.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vibex — From idea to code, automatically",
    short_name: "Vibex",
    description:
      "Vibex automates the entire vibe-coding loop — describe an idea once, and it interviews you, locks the goal, then generates and runs every prompt until it's done.",
    start_url: "/",
    display: "standalone",
    background_color: "#14110F",
    theme_color: "#FF5A1F",
    icons: [
      { src: "/vibex-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    categories: ["developer", "productivity", "utilities"],
  };
}
