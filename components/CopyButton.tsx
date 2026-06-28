"use client";

// Copy-to-clipboard button with toast feedback. Used on code/IDE viewers.

import { useState } from "react";
import { toast } from "@/lib/toast";
import styles from "./CopyButton.module.css";

export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn’t copy — select the text and copy manually");
    }
  };

  return (
    <button type="button" className={styles.copy} onClick={copy} data-copied={copied} aria-label={label}>
      {copied ? "Copied ✓" : label}
    </button>
  );
}
