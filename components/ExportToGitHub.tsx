"use client";

// Exports a saved project's generated files to a new GitHub repo via the exportToGitHub server
// action (uses the user's encrypted PAT). Routes to Settings if no token is connected.

import { useTransition } from "react";
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

  const run = () =>
    start(async () => {
      const res = await exportToGitHub(projectId);
      if (res.url && !res.error) {
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
        toast.error("Repo created, but some files failed to push");
        window.open(res.url, "_blank", "noopener");
      } else {
        toast.error(`GitHub export failed${res.message ? `: ${res.message}` : ""}`);
      }
    });

  return (
    <button type="button" className={className} onClick={run} disabled={pending} aria-busy={pending}>
      {pending ? "Exporting…" : "↗ Export to GitHub"}
    </button>
  );
}
