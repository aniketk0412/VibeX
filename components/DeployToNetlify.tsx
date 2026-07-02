"use client";

// One-click live deploy of a saved project to Netlify (deployToNetlify server action). Swaps in
// a link to the live site after deploy. Routes to Settings if no token.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deployToNetlify } from "@/app/actions";
import { toast } from "@/lib/toast";
import { trackEvent } from "@/lib/analytics";

export default function DeployToNetlify({
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
      const res = await deployToNetlify(projectId);
      if (res.url && !res.error) {
        setUrl(res.url);
        trackEvent("shipped", { via: "netlify" });
        toast.success("Deployed to Netlify");
        window.open(res.url, "_blank", "noopener");
      } else if (res.error === "plan_required") {
        toast.error("One-click deploy is a Starter feature — download the .zip free, or upgrade");
        router.push("/pricing");
      } else if (res.error === "no_key") {
        toast.error("Add a Netlify token in Settings to deploy");
        router.push("/settings");
      } else if (res.error === "bad_token") {
        toast.error("Your Netlify token was rejected — update it in Settings");
      } else if (res.error === "no_files") {
        toast.error("Nothing to deploy yet");
      } else {
        toast.error(`Netlify deploy failed${res.message ? `: ${res.message}` : ""}`);
      }
    });

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        ◆ Netlify site ↗
      </a>
    );
  }

  return (
    <button type="button" className={className} onClick={run} disabled={pending} aria-busy={pending}>
      {pending ? "Deploying…" : "◆ Deploy to Netlify"}
    </button>
  );
}
