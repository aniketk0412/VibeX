"use client";

// Route-level error boundary. Catches render/data errors in any segment and offers a retry
// (reset re-runs the failed render) plus an escape hatch home.

import { useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        textAlign: "center",
        padding: "40px 28px",
      }}
    >
      <Link href="/" aria-label="Vibex home" style={{ marginBottom: 8 }}>
        <Logo size={30} />
      </Link>
      <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--faint)", letterSpacing: "0.04em" }}>
        SOMETHING BROKE
      </div>
      <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, letterSpacing: "-0.03em", fontSize: "clamp(24px, 4vw, 32px)" }}>
        That didn&apos;t go as planned.
      </h1>
      <p style={{ color: "var(--dim)", maxWidth: 440, lineHeight: 1.5 }}>
        An unexpected error interrupted this page. You can try again, or head back and pick up where you left off.
      </p>
      {error.digest && (
        <code style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--faint)" }}>ref: {error.digest}</code>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button type="button" className="btn btn-primary btn-lg" onClick={reset}>
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-ghost btn-lg">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
