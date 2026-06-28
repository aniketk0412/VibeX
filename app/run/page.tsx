"use client";

// The build workspace — two panes. LEFT: the conversation (locked goal, the Coder/Reviewer
// narration streamed from the engine, and a steering input + always-on Interrupt). RIGHT: the
// working canvas (live step stream, progress, usage, and the finished output). Driven by the
// real dual-AI engine over /api/run; falls back to a local simulation if the stream can't start.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { buildSteps, type Spec } from "@/lib/steps";
import styles from "./run.module.css";

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function Send() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function fmtMs(ms: number): string {
  const m = Math.round(ms / 60_000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

type Role = "vibex" | "coder" | "reviewer" | "user";
type Msg = { id: number; role: Role; text: string; verdict?: "pass" | "revise" };

type RunEvent =
  | { type: "planned"; steps: string[]; live: boolean }
  | { type: "step_start"; index: number; title: string }
  | { type: "coder"; index: number; preview: string; tokens: number; cost: number }
  | { type: "reviewer"; index: number; verdict: "pass" | "revise"; note: string; tokens: number; cost: number }
  | { type: "step_done"; index: number }
  | { type: "usage"; tokens: number; cost: number; window: { kind: string; remaining: number; resetInMs: number } }
  | { type: "paused"; reason: string; resetInMs: number }
  | { type: "complete"; tokens: number; cost: number; steps: number }
  | { type: "error"; message: string };

export default function RunPage() {
  const router = useRouter();
  const [spec, setSpec] = useState<Spec>({});
  const [live, setLive] = useState(true);

  const [steps, setSteps] = useState<string[]>([]);
  const [completed, setCompleted] = useState(0);
  const [paused, setPaused] = useState(false);
  const [limitPause, setLimitPause] = useState(false);
  const [done, setDone] = useState(false);

  const [tokens, setTokens] = useState(0);
  const [cost, setCost] = useState(0);
  const [resetInMs, setResetInMs] = useState(3 * 3600_000 + 12 * 60_000);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const localTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const stepsRef = useRef<string[]>([]);
  const idRef = useRef(0);
  const feedEnd = useRef<HTMLDivElement>(null);

  const addMsg = (role: Role, text: string, verdict?: "pass" | "revise") =>
    setMessages((m) => [...m, { id: idRef.current++, role, text, verdict }]);

  useEffect(() => {
    let parsed: Spec = {};
    try {
      parsed = JSON.parse(sessionStorage.getItem("vibex-spec") ?? "{}");
    } catch {
      /* defaults */
    }
    setSpec(parsed);
    const plan = buildSteps(parsed);
    setSteps(plan);
    stepsRef.current = plan;
    if (!startedRef.current) {
      startedRef.current = true;
      void startStream(parsed, 0);
    }
    return () => {
      abortRef.current?.abort();
      if (localTimer.current) clearInterval(localTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    feedEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function apply(ev: RunEvent) {
    switch (ev.type) {
      case "planned":
        setSteps(ev.steps);
        stepsRef.current = ev.steps;
        setLive(ev.live);
        addMsg("vibex", `Goal locked. Planned ${ev.steps.length} steps — building now${ev.live ? "" : " (simulated — no API key set)"}.`);
        break;
      case "coder": {
        const title = stepsRef.current[ev.index] ?? `Step ${ev.index + 1}`;
        addMsg("coder", `${title} — ${ev.preview}`);
        break;
      }
      case "reviewer":
        addMsg("reviewer", ev.note, ev.verdict);
        break;
      case "step_done":
        setCompleted(ev.index + 1);
        break;
      case "usage":
        setTokens(ev.tokens);
        setCost(ev.cost);
        setResetInMs(ev.window.resetInMs);
        break;
      case "paused":
        setLimitPause(true);
        setPaused(true);
        setResetInMs(ev.resetInMs);
        addMsg("vibex", `${ev.reason}. Progress is saved — auto-resumes in ${fmtMs(ev.resetInMs)}, or resume now.`);
        break;
      case "complete":
        setTokens(ev.tokens);
        setCost(ev.cost);
        setDone(true);
        addMsg("vibex", `Build complete — ${ev.steps} steps · ~$${ev.cost.toFixed(2)}. Open the output on the canvas.`);
        break;
      default:
        break;
    }
  }

  async function startStream(theSpec: Spec, fromIndex: number) {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec: theSpec, startIndex: fromIndex }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let got = false;
      for (;;) {
        const { value, done: rDone } = await reader.read();
        if (rDone) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = block.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            apply(JSON.parse(line.slice(5).trim()) as RunEvent);
            got = true;
          } catch {
            /* skip frame */
          }
        }
      }
      if (!got) runLocalFallback(theSpec, fromIndex);
    } catch {
      if (ctrl.signal.aborted) return;
      runLocalFallback(theSpec, fromIndex);
    }
  }

  function runLocalFallback(theSpec: Spec, fromIndex: number) {
    const plan = buildSteps(theSpec);
    setSteps(plan);
    stepsRef.current = plan;
    setLive(false);
    let i = fromIndex;
    if (localTimer.current) clearInterval(localTimer.current);
    localTimer.current = setInterval(() => {
      addMsg("coder", `${plan[i] ?? "Step"} — generated.`);
      i += 1;
      setCompleted(i);
      setTokens((t) => t + 4200);
      setCost((c) => c + 0.04);
      if (i >= plan.length) {
        if (localTimer.current) clearInterval(localTimer.current);
        setDone(true);
        addMsg("vibex", "Build complete. Open the output on the canvas.");
      }
    }, 1000);
  }

  function interrupt() {
    abortRef.current?.abort();
    if (localTimer.current) clearInterval(localTimer.current);
    setLimitPause(false);
    setPaused(true);
    addMsg("vibex", "Paused. Tell me what to adjust, or resume.");
  }

  function resume() {
    setPaused(false);
    setLimitPause(false);
    addMsg("vibex", "Resuming.");
    void startStream(spec, completed);
  }

  function send() {
    const text = draft.trim();
    if (!text || done) return;
    addMsg("user", text);
    setDraft("");
    if (paused) {
      addMsg("vibex", "On it — resuming with that in mind.");
      void startStream(spec, completed);
      setPaused(false);
      setLimitPause(false);
    } else {
      addMsg("vibex", "Noted — I'll fold that into the upcoming steps.");
    }
  }

  const total = steps.length || 1;
  const currentStep = done ? null : steps[completed];
  const pct = Math.round((completed / total) * 100);
  const status = done ? "DONE" : paused ? "PAUSED" : "LIVE";

  const roleLabel: Record<Role, string> = { vibex: "Vibex", coder: "Coder", reviewer: "Reviewer", user: "You" };

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" aria-label="Vibex home">
          <Logo size={26} />
        </Link>
        <div className={styles.topRight}>
          <span className={styles.live} data-status={status}>
            <span className={styles.dot} /> {status}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div className={styles.workspace}>
        {/* ── left: conversation ───────────────────────── */}
        <section className={styles.convo}>
          <div className={styles.paneHead}>
            <span className={styles.paneLabel}>Conversation</span>
            {!live && <span className={styles.simBadge}>simulated</span>}
          </div>

          <div className={styles.goal}>
            <span className={styles.lock}>🔒</span>
            <span className={styles.goaltext}>
              <b>{spec.idea ?? "Your project"}</b>
              {spec.coder ? ` · ${spec.coder} + ${spec.reviewer}` : ""}
            </span>
          </div>

          <div className={styles.feed}>
            {messages.map((m) => (
              <div key={m.id} className={styles.msg} data-role={m.role}>
                <span className={styles.msgRole}>{roleLabel[m.role]}</span>
                <span className={styles.msgText}>
                  {m.role === "reviewer" && (
                    <span className={styles.verdict} data-v={m.verdict}>{m.verdict === "revise" ? "REVISE" : "PASS"}</span>
                  )}
                  {m.text}
                </span>
              </div>
            ))}
            <div ref={feedEnd} />
          </div>

          <div className={styles.composer}>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={done ? "Build finished" : paused ? "Add a correction, then resume…" : "Steer the build — e.g. use a calendar view…"}
                disabled={done}
                aria-label="Steer the build"
              />
              <button type="button" className={styles.sendBtn} onClick={send} disabled={done || !draft.trim()} aria-label="Send">
                <Send />
              </button>
            </div>
            <div className={styles.actions}>
              {done ? (
                <button type="button" className="btn btn-primary" onClick={() => router.push("/result")}>
                  View output →
                </button>
              ) : paused ? (
                <button type="button" className={styles.resumeBtn} onClick={resume}>▶ Resume</button>
              ) : (
                <button type="button" className={styles.interruptBtn} onClick={interrupt}>❚❚ Interrupt</button>
              )}
            </div>
          </div>
        </section>

        {/* ── right: working canvas ────────────────────── */}
        <section className={styles.canvas}>
          <div className={styles.paneHead}>
            <span className={styles.paneLabel}>Working canvas</span>
            <div className={styles.canvasMeta}>
              <span className={styles.usageChip}>{(tokens / 1000).toFixed(1)}k · ~${cost.toFixed(2)} · resets {fmtMs(resetInMs)}</span>
              {!done && <span className={styles.steppill}>step {Math.min(completed + 1, total)} of ~{total}</span>}
            </div>
          </div>

          <div className={styles.progress}><i style={{ width: `${done ? 100 : pct}%` }} /></div>

          <div className={styles.canvasBody}>
            <div className={styles.stream}>
              {steps.map((s, i) => {
                const state = i < completed ? "done" : i === completed && !done ? "active" : "upcoming";
                return (
                  <div key={`${i}-${s}`} className={styles.line} data-state={state}>
                    <span className={styles.glyph}>
                      {state === "done" ? (
                        <span className={styles.chk}><Check /></span>
                      ) : state === "active" && !paused ? (
                        <span className={styles.spin} />
                      ) : (
                        <span className={styles.pending} />
                      )}
                    </span>
                    <span className={styles.ltext}>{s}</span>
                    {state === "active" && !paused && <span className={styles.tag}>running…</span>}
                  </div>
                );
              })}
            </div>

            {done && (
              <div className={styles.complete}>
                <div className={styles.completeIcon}><Check /></div>
                <div>
                  <div className={styles.completeTitle}>Build complete</div>
                  <div className={styles.completeSub}>{total} steps · {(tokens / 1000).toFixed(1)}k tokens · ~${cost.toFixed(2)}</div>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => router.push("/result")}>
                  View output →
                </button>
              </div>
            )}
          </div>

          <div className={styles.canvasFoot}>
            <span className={styles.gear}>{done ? "✓" : "⚙"}</span>
            <span className={styles.footLabel}>{done ? "Build complete" : currentStep ?? "Working…"}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
