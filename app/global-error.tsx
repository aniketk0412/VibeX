"use client";

// Last-resort boundary for errors thrown in the root layout itself. Must render its own
// <html>/<body> because it replaces the root layout. Kept dependency-free and inline-styled.

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body style={{ margin: 0, background: "#14110F", color: "#F4EEE6", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            textAlign: "center",
            padding: "40px 28px",
          }}
        >
          <h1 style={{ fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em" }}>Something went wrong</h1>
          <p style={{ color: "#B4AB9A", maxWidth: 420, lineHeight: 1.5 }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 8,
              background: "#5E5CE6",
              color: "#1F1808",
              border: "none",
              borderRadius: 11,
              padding: "13px 24px",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
