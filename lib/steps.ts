// Client-safe (no server imports): turns a locked spec into a goal-driven build plan.
// Shared by the execution engine (server) and the /run screen's local fallback (client).

export type Spec = {
  idea?: string;
  platform?: string;
  audience?: string;
  core?: string;
  accounts?: string;
  vibe?: string;
  accent?: string;
  stack?: string;
  integrations?: string;
  coder?: string;
  reviewer?: string;
  billing?: string;
};

export function buildSteps(spec: Spec): string[] {
  const core =
    spec.core && !spec.core.startsWith("Core") && !spec.core.startsWith("Just")
      ? spec.core
      : "the core loop";

  const steps = [
    "Scaffold the project",
    "Set up the design system",
    "Model the data",
    "Build the main UI",
    `Implement ${core}`,
  ];

  if (spec.accounts && spec.accounts !== "No login needed") steps.push("Add accounts & login");
  if (spec.integrations && spec.integrations !== "None") {
    spec.integrations
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((intg) => steps.push(`Wire up: ${intg}`));
  }

  steps.push("Write tests", "Reviewer pass", "Polish & accessibility", "Final build");
  return steps;
}
