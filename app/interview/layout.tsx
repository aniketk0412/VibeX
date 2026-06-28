import type { ReactNode } from "react";

export const metadata = {
  title: "Interview",
  robots: { index: false },
};

export default function InterviewLayout({ children }: { children: ReactNode }) {
  return children;
}
