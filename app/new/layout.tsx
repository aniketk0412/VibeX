import type { ReactNode } from "react";

export const metadata = {
  title: "Start a build",
  description: "Describe your idea once — Vibex interviews you, locks the goal, then generates and runs every prompt until it's working code.",
  alternates: { canonical: "/new" },
};

export default function NewLayout({ children }: { children: ReactNode }) {
  return children;
}
