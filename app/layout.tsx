import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Brand type stack — typography does the heavy lifting.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://vibex.io"),
  title: "Vibex — From idea to code, automatically",
  description:
    "You have the idea. You hate writing 20 prompts manually. We do it for you. Vibex automates the entire vibe-coding loop — idea to working code, hands-free.",
  icons: { icon: "/vibex-mark.svg" },
  openGraph: {
    title: "Vibex — From idea to code, automatically",
    description: "You have the idea. You hate writing 20 prompts manually. We do it for you.",
    type: "website",
  },
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
    <html lang="en" data-theme="light" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
