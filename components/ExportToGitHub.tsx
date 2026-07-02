"use client";

// Exports a saved project's files to a new GitHub repo (exportToGitHub server action, encrypted
// PAT). After a successful export, swaps in a "Deploy to Vercel" link for the created repo.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { exportToGitHub } from "@/app/actions";
import { toast } from "@/lib/toast";

export default function ExportToGitHub({
  projectId,
  className = "btn btn-ghost",
}: {
  projectId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [makePublic, setMakePublic] = useState(false);

  const run = () =>
    start(async () => {
      const res = await exportToGitHub(projectId, { makePublic });
      if (res.url && !res.error) {
        setRepoUrl(res.url);
        toast.success(`Pushed to ${res.repo ?? "GitHub"}`);
        window.open(res.url, "_blank", "noopener");
      } else if (res.error === "no_key") {
        toast.error("Add a GitHub token in Settings to export");
        router.push("/settings");
      } else if (res.error === "bad_token") {
        toast.error("Your GitHub token was rejected — update it in Settings");
      } else if (res.error === "no_files") {
        toast.error("No files to export yet");
      } else if (res.error === "push_failed" && res.url) {
        setRepoUrl(res.url);
        toast.error("Repo created, but some files failed to push");
        window.open(res.url, "_blank", "noopener");
      } else {
        toast.error(`GitHub export failed${res.message ? `: ${res.message}` : ""}`);
      }
    });

  // Once the repo exists, link to it. (Live deploys are handled by DeployToVercel.)
  if (repoUrl) {
    return (
      <a href={repoUrl} target="_blank" rel="noopener noreferrer" className={className}>
        ✓ GitHub repo ↗
      </a>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <button type="button" className={className} onClick={run} disabled={pending} aria-busy={pending}>
        {pending ? "Exporting…" : `↗ Export to GitHub (${makePublic ? "public" : "private"})`}
      </button>
      <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85em", cursor: "pointer" }}>
        <input type="checkbox" checked={makePublic} onChange={(e) => setMakePublic(e.target.checked)} disabled={pending} />
        Public
      </label>
    </span>
  );
}
