"use client";

// Shared back control for app screens. Uses real browser history when there is some,
// otherwise falls back to an explicit destination (so a fresh tab / deep link still works).

import { useRouter } from "next/navigation";

export default function BackLink({
  href = "/dashboard",
  label = "Back",
}: {
  href?: string;
  label?: string;
}) {
  const router = useRouter();

  const onClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(href);
  };

  return (
    <button type="button" className="back-link" onClick={onClick} aria-label={label}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}
