"use client";

// The interview: one Claude-Code-style question at a time across Scope → Design → Stack →
// Models, written in plain language (no jargon — the audience has ideas, not tech vocab).
// Questions adapt to earlier answers (e.g. Design is skipped for CLI / API builds), answered
// ones collapse into a transcript, and it ends on a goal-lock summary with an estimated cost.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import StepIndicator, { type FlowStep } from "@/components/StepIndicator";
import QuestionCard, { type Question } from "@/components/QuestionCard";
import { estimateProjectCost } from "@/lib/ai/models";
import { startProject } from "@/app/actions";
import styles from "./interview.module.css";

type Answers = Record<string, string>;

// Platforms that have a UI worth designing. Custom platforms default to "yes, design it".
const hasUI = (a: Answers) => !["CLI tool", "API / backend"].includes(a.platform ?? "");

const QUESTIONS: Question[] = [
  {
    id: "platform",
    phase: "Scope",
    prompt: "What platform should this run on?",
    options: [
      { label: "Web app", desc: "Runs in the browser — the default for most ideas." },
      { label: "Mobile app", desc: "iOS / Android via React Native." },
      { label: "CLI tool", desc: "A command-line utility." },
      { label: "API / backend", desc: "A service with no UI of its own." },
    ],
    customPlaceholder: "Something else…",
  },
  {
    id: "audience",
    phase: "Scope",
    prompt: "Who is this for?",
    hint: "Shapes how simple, polished, or powerful it needs to be.",
    options: [
      { label: "General consumers", desc: "Everyday people — keep it simple and polished." },
      { label: "Just me", desc: "A personal tool. No onboarding needed." },
      { label: "A business or team", desc: "Used inside an organization; may need roles." },
      { label: "Developers", desc: "Technical users — docs and an API matter." },
    ],
    customPlaceholder: "Someone else…",
  },
  {
    id: "core",
    phase: "Scope",
    prompt: "What's the core feature for v1?",
    hint: "Keep it to the one thing it must do well first.",
    options: [
      { label: "Just the core loop", desc: "The single essential action — nothing extra." },
      { label: "Core + accounts", desc: "Add sign-in and saved, per-user data." },
      { label: "Core + dashboard", desc: "Add a place to view and track progress." },
    ],
    customPlaceholder: "Describe the core feature…",
  },
  {
    id: "accounts",
    phase: "Scope",
    prompt: "Do people log in and save their own stuff?",
    hint: "Accounts let each person keep their own private data.",
    options: [
      { label: "No login needed", desc: "Anyone can use it right away; nothing is saved per person." },
      { label: "Personal accounts", desc: "Each person logs in; their data stays private to them." },
      { label: "Accounts with admins & members", desc: "Different people get different access — e.g. an owner vs. users." },
    ],
    customPlaceholder: "Describe it…",
  },
  {
    id: "vibe",
    phase: "Design",
    prompt: "What should it feel like?",
    hint: "The overall personality of the look.",
    when: hasUI,
    options: [
      { label: "Minimal & clean", desc: "Lots of whitespace, calm, content-first." },
      { label: "Bold & playful", desc: "Big type, bright, energetic." },
      { label: "Premium & dark", desc: "Sleek, high-contrast, dev-tool vibes." },
      { label: "Corporate & trustworthy", desc: "Professional, safe, enterprise-ready." },
    ],
    customPlaceholder: "Describe the vibe…",
  },
  {
    id: "accent",
    phase: "Design",
    prompt: "Pick an accent color.",
    hint: "The one color that stands out across the app.",
    when: hasUI,
    options: [
      { label: "Ember", desc: "Warm orange — energetic.", swatch: "#FF5A1F" },
      { label: "Blue", desc: "Classic and trustworthy.", swatch: "#3B82F6" },
      { label: "Green", desc: "Fresh, growth, money.", swatch: "#22C55E" },
      { label: "Violet", desc: "Creative and premium.", swatch: "#8B5CF6" },
      { label: "Monochrome", desc: "Black & white — no accent.", swatch: "#9CA3AF" },
    ],
    customPlaceholder: "Hex e.g. #FF5A1F",
  },
  {
    id: "stack",
    phase: "Stack",
    prompt: "Any tech preference?",
    options: [
      { label: "Recommended", desc: "Let Vibex pick a proven stack (Next.js + Postgres)." },
      { label: "Next.js full-stack", desc: "App Router, API routes, and a database." },
      { label: "React SPA", desc: "Frontend-only, no server." },
      { label: "Static site", desc: "Fast, no backend — great for content." },
    ],
    customPlaceholder: "Name your stack…",
  },
  {
    id: "integrations",
    phase: "Stack",
    prompt: "Does it need to connect to anything?",
    hint: "Outside services it should plug into. Pick any — or skip if you're not sure.",
    multi: true,
    submitLabel: "Done",
    options: [
      { label: "Take payments", desc: "Accept money — Razorpay / Stripe." },
      { label: "Send emails", desc: "Notifications, receipts, sign-in links." },
      { label: "Social sign-in", desc: "Let people log in with Google / GitHub." },
      { label: "Maps / location", desc: "Show maps or use the user's location." },
      { label: "AI features", desc: "Chat, summaries, or content generation." },
    ],
    customPlaceholder: "Name one…",
  },
  {
    id: "coder",
    phase: "Models",
    prompt: "Pick your Coder AI.",
    hint: "Writes the code, step by step.",
    customPlaceholder: "Other model… (advanced / BYOK)",
    options: [
      { group: "Anthropic", label: "Claude Opus", desc: "Top-tier reasoning, highest quality." },
      { group: "Anthropic", label: "Claude Sonnet", desc: "Balanced speed and quality. Recommended." },
      { group: "OpenAI", label: "GPT-4o", desc: "Fast, strong general coder." },
      { group: "Google", label: "Gemini Flash", desc: "Cheapest and quickest, lighter touch." },
    ],
  },
  {
    id: "reviewer",
    phase: "Models",
    prompt: "Pick your Reviewer AI.",
    hint: "Checks each step before it ships.",
    customPlaceholder: "Other model… (advanced / BYOK)",
    options: [
      { group: "Anthropic", label: "Claude Opus", desc: "Deepest reviews. Recommended." },
      { group: "Anthropic", label: "Claude Sonnet", desc: "Faster reviews, still sharp." },
      { group: "OpenAI", label: "GPT-4o", desc: "Solid, fast second opinion." },
      { group: "Google", label: "Gemini Pro", desc: "Thorough and economical." },
    ],
  },
  {
    id: "billing",
    phase: "Models",
    prompt: "How should model usage be billed?",
    allowCustom: false,
    options: [
      { label: "Vibex plan", desc: "We cover provider costs under your plan's limits." },
      { label: "Bring your own key", desc: "Use your own API keys — $5/mo platform fee." },
    ],
  },
];

export default function InterviewPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [idea, setIdea] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [current, setCurrent] = useState(0);

  // Seed the interview with the idea captured on /new. No idea → send them there.
  useEffect(() => {
    let stored = "";
    try {
      stored = sessionStorage.getItem("vibex-idea") ?? "";
    } catch {
      /* sessionStorage may be unavailable */
    }
    if (!stored) {
      router.replace("/new");
      return;
    }
    setIdea(stored);
    setMounted(true);
  }, [router]);

  // Only ask questions whose `when` (which depends on earlier answers) passes.
  const visible = QUESTIONS.filter((q) => !q.when || q.when(answers));
  const done = current >= visible.length;
  const active = done ? undefined : visible[current];
  const activeStep: FlowStep = done ? "Goal" : (active!.phase as FlowStep);

  // The rail drops Design entirely for non-UI builds, so it stays honest.
  const steps: FlowStep[] = hasUI(answers)
    ? ["Idea", "Scope", "Design", "Stack", "Models", "Goal"]
    : ["Idea", "Scope", "Stack", "Models", "Goal"];

  const handleAnswer = (value: string) => {
    if (!active) return;
    setAnswers((prev) => ({ ...prev, [active.id]: value }));
    setCurrent((c) => c + 1);
  };

  const goBack = () => setCurrent((c) => Math.max(0, c - 1));

  const est = estimateProjectCost(answers.coder, answers.reviewer);
  const customModel = !est.known;
  const byok = answers.billing === "Bring your own key";

  // Only summarize what was actually asked (adaptive questions may be absent).
  const summary: { k: string; v?: string }[] = [
    { k: "Idea", v: idea },
    { k: "Platform", v: answers.platform },
    { k: "Who for", v: answers.audience },
    { k: "Core (v1)", v: answers.core },
    { k: "Accounts", v: answers.accounts },
    { k: "Look & feel", v: answers.vibe },
    { k: "Accent", v: answers.accent },
    { k: "Stack", v: answers.stack },
    { k: "Connects to", v: answers.integrations },
    { k: "Coder AI", v: answers.coder },
    { k: "Reviewer AI", v: answers.reviewer },
    { k: "Billing", v: answers.billing },
  ];

  const [starting, setStarting] = useState(false);

  const startBuilding = async () => {
    if (starting) return;
    setStarting(true);
    const spec = { idea, ...answers, estimate: est.cost };
    try {
      sessionStorage.setItem("vibex-spec", JSON.stringify(spec));
    } catch {
      /* ignore */
    }
    // Signed-in users get a saved Project; anonymous users run ephemerally.
    try {
      const { id } = await startProject(spec);
      if (id) {
        router.push(`/run?project=${id}`);
        return;
      }
    } catch {
      /* fall through to ephemeral run */
    }
    router.push("/run");
  };

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" aria-label="Vibex home">
          <Logo size={28} />
        </Link>
        <ThemeToggle />
      </header>

      <main className={styles.main}>
        <StepIndicator active={mounted ? activeStep : "Scope"} steps={steps} />

        {mounted && (
          <>
            {/* transcript — the idea, then every answered question */}
            <div className={styles.transcript}>
              <div className={styles.seed}>
                <span className={styles.seedIcon}>✦</span>
                <div>
                  <div className={styles.aq}>Your idea</div>
                  <div className={styles.aa}>{idea}</div>
                </div>
              </div>

              {visible.slice(0, current).map((q) => (
                <div key={q.id} className={styles.answered}>
                  <span className={styles.tick}>✓</span>
                  <div>
                    <div className={styles.aq}>{q.prompt}</div>
                    <div className={styles.aa}>{answers[q.id]}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* active question, or the goal-lock summary when finished */}
            {!done ? (
              <div className={styles.activeArea}>
                <QuestionCard key={active!.id} question={active!} onAnswer={handleAnswer} />
                {current > 0 && (
                  <button type="button" className={styles.back} onClick={goBack}>
                    ← Back
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.goal}>
                <div className={styles.goalHead}>
                  <span className={styles.goalLock}>🔒</span>
                  <div>
                    <div className={styles.goalTitle}>Lock the goal</div>
                    <div className={styles.goalSub}>Confirm the spec — Vibex builds to exactly this.</div>
                  </div>
                </div>

                <div className={styles.rows}>
                  {summary
                    .filter((r) => r.v)
                    .map((r) => (
                      <div key={r.k} className={styles.row}>
                        <span className={styles.rk}>{r.k}</span>
                        <span className={styles.rv}>{r.v}</span>
                      </div>
                    ))}
                  <div className={styles.row}>
                    <span className={styles.rk}>Est. cost</span>
                    <span className={styles.rv}>
                      {customModel ? (
                        <>
                          <span className={styles.cost}>Varies</span>
                          <span className={styles.costNote}> · custom model — rate set at build time</span>
                        </>
                      ) : (
                        <>
                          <span className={styles.cost}>~${est.cost.toFixed(2)}</span>
                          <span className={styles.costNote}>
                            {` · ~${Math.round(est.tokens / 1000)}k tokens`}
                            {byok ? " · billed to your key" : " · per project"}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className={styles.goalFoot}>
                  <button type="button" className={styles.back} onClick={goBack}>
                    ← Back
                  </button>
                  <button type="button" className="btn btn-primary btn-lg" onClick={startBuilding} disabled={starting}>
                    {starting ? "Starting…" : "Start building →"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
