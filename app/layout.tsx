import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Toaster from "@/components/Toaster";
import "./globals.css";

// Type system: Hanken Grotesk for body/UI, a Fraunces serif for display headings (editorial
// character against the techy charcoal), JetBrains Mono for code + numeric chips.
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
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
  "You have the idea. You hate writing 20 prompts manually. We do it for you. Vibex automates the entire vibe-coding loop — idea to working code, hands-free.";

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
  },
  twitter: {
    card: "summary_large_image",
    title: "Vibex — From idea to code, automatically",
    description: "You have the idea. You hate writing 20 prompts manually. We do it for you.",
    creator: "@vibex",
  },
  category: "technology",
};

// Set the theme before first paint to avoid a flash. Defaults to light.
const themeInit = `
(function(){
  try {
    var t = localStorage.getItem('vibex-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
