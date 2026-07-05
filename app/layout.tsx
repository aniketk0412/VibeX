import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Toaster from "@/components/Toaster";
import "./globals.css";

// Type system: Inter for body/UI (the modern dev-tool workhorse), Space Grotesk for display
// headings (geometric, technical, zero bakery-serif energy), JetBrains Mono for code + chips.
const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const DESCRIPTION =
  "You have the idea. Other AI coders stop at a rough draft — Vibex writes every prompt and reviews every file until it actually runs. Idea to working code, hands-free.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://vibex.io"),
  title: {
    default: "Vibex — From idea to code, automatically",
    template: "%s · Vibex",
  },
  description: DESCRIPTION,
  applicationName: "Vibex",
  keywords: [
    "AI code generation",
    "vibe coding",
    "idea to app",
    "AI app builder",
    "automated coding",
    "AI developer tool",
    "prompt to code",
    "Claude code generation",
    "AI website builder",
    "no-code to code",
  ],
  authors: [{ name: "Vibex" }],
  creator: "Vibex",
  publisher: "Vibex",
  icons: { icon: "/vibex-mark.svg", apple: "/vibex-mark.svg" },
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    title: "Vibex — From idea to code, automatically",
    description: DESCRIPTION,
    url: "/",
    siteName: "Vibex",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vibex — From idea to code, automatically" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vibex — From idea to code, automatically",
    description: "Other AI coders stop at a rough draft. Vibex reviews every file until it runs.",
    creator: "@vibex",
    images: ["/og.png"],
  },
  category: "technology",
};

// Set the theme before first paint to avoid a flash. Defaults to dark (dev-tool posture);
// a stored toggle choice always wins.
const themeInit = `
(function(){
  try {
    var t = localStorage.getItem('vibex-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce set by middleware.ts — stamps the inline theme script so it survives the
  // strict `script-src 'self' 'nonce-…'` policy. Undefined on the srcdoc-preview routes (no nonce
  // in their CSP), where inline scripts are allowed anyway.
  const nonce = headers().get("x-nonce") ?? undefined;
  return (
    // suppressHydrationWarning: themeInit intentionally rewrites data-theme before hydration
    // when the user has a stored preference — that mismatch is by design, not a bug.
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <head>
        {/* suppressHydrationWarning: the per-request CSP nonce differs between the server HTML and
            React's dev hydration pass — a known Next.js + nonce quirk. The nonce IS applied
            correctly in the shipped HTML (verified in prod); this only silences the dev warning. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* Without JS the IntersectionObserver never fires — keep revealed content visible. */}
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
