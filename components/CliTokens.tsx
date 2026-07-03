"use client";

// Settings → CLI access. Lists tokens, revokes them, and mints new ones — the freshly minted
// plaintext is held only in local state and shown once, with a copy button.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mintCliToken, revokeCliToken } from "@/app/actions";
import CopyButton from "./CopyButton";
import styles from "./CliTokens.module.css";

type Row = { id: string; name: string; createdAt: string; lastUsedAt: string | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// UTC getters — deterministic across server prerender and client hydration.
function fmt(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export default function CliTokens({ tokens }: { tokens: Row[] }) {
  const router = useRouter();
  const [minted, setMinted] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  const mint = () =>
    start(async () => {
      const r = await mintCliToken(name.trim() || "CLI token");
      if (r.token) {
        setMinted(r.token);
        setName("");
        router.refresh();
      }
    });

  const revoke = (id: string) =>
    start(async () => {
      await revokeCliToken(id);
      router.refresh();
    });

  return (
    <div className={styles.wrap}>
      {minted && (
        <div className={styles.reveal}>
          <span className={styles.revealNote}>Copy this token now — it won&apos;t be shown again.</span>
          <div className={styles.revealRow}>
            <code className={styles.revealToken}>{minted}</code>
            <CopyButton text={minted} />
          </div>
        </div>
      )}

      {tokens.length > 0 && (
        <div className={styles.list}>
          {tokens.map((t) => (
            <div key={t.id} className={styles.row}>
              <div className={styles.info}>
                <span className={styles.name}>{t.name}</span>
                <span className={styles.meta}>
                  created {fmt(t.createdAt)}{t.lastUsedAt ? ` · last used ${fmt(t.lastUsedAt)}` : " · never used"}
                </span>
              </div>
              <button type="button" className={styles.revoke} disabled={pending} onClick={() => revoke(t.id)}>
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.mintRow}>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Token name — e.g. work laptop"
          aria-label="Token name"
        />
        <button type="button" className={styles.mintBtn} onClick={mint} disabled={pending}>
          {pending ? "Working…" : "Generate token"}
        </button>
      </div>
    </div>
  );
}
