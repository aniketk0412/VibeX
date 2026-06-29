"use client";

// One-click live deploy of a saved project to Vercel (deployToVercel server action). After a
// successful deploy it swaps in a link to the live site. Routes to Settings if no token.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deployToVercel } from "@/app/actions";
import { toast } from "@/lib/toast";

export default function DeployToVercel({
  projectId,
  className = "btn btn-ghost",
}: {
  projectId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);

  const run = () =>
    start(async () => {
      const res = await deployToVercel(projectId);
      if (res.url && !res.error) {
        setUrl(res.url);
        toast.success("Deployed to Vercel");
        window.open(res.url, "_blank", "noopener");
      } else if (res.error === "no_key") {
        toast.error("Add a Vercel token in Settings to deploy");
        router.push("/settings");
      } else if (res.error === "bad_token") {
        toast.error("Your Vercel token was rejected — update it in Settings");
      } else if (res.error === "no_files") {
        toast.error("Nothing to deploy yet");
      } else {
        toast.error(`Deploy failed${res.message ? `: ${res.message}` : ""}`);
      }
    });

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        ▲ Live site ↗
      </a>
    );
  }

  return (
    <button type="button" className={className} onClick={run} disabled={pending} aria-busy={pending}>
      {pending ? "Deploying…" : "▲ Deploy to Vercel"}
    </button>
  );
}
