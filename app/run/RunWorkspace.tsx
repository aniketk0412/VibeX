"use client";

// The build workspace — two panes. LEFT: conversation (locked goal, streamed Coder/Reviewer
// narration, steering input + always-on Interrupt). RIGHT: working canvas (live step stream,
// progress, usage, output). Driven by the engine over /api/run, which persists the run to the
// DB when `projectId` is set (signed-in). Falls back to a local simulation if the stream dies.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { buildSteps, type Spec, type GenFile } from "@/lib/steps";
import { captureIframe } from "@/lib/screenshot";
import { AttachButton, Thumbs, type AttachedImage } from "@/components/ImageAttach";
import BackLink from "@/components/BackLink";
import CopyButton from "@/components/CopyButton";
import OpenInStackBlitz from "@/components/OpenInStackBlitz";
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Claude-Code-style collapsible "wrote a file" card shown in the conversation.
function FileCard({ path, code, stub }: { path: string; code: string; stub?: boolean }) {
  const [open, setOpen] = useState(false);
  const lines = code ? code.split("\n").length : 0;
  return (
    <div className={styles.fileCard}>
      <button type="button" className={styles.fileCardHead} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={styles.fileCardIcon} aria-hidden>{stub ? "⚠" : "✎"}</span>
        <span className={styles.fileCardName}>{stub ? "Placeholder for " : "Wrote "}<b>{path}</b></span>
        {stub ? (
          <span className={styles.fileCardMeta} title="The model was unavailable — a safe placeholder was used. Send a correction to retry.">model unavailable</span>
        ) : (
          lines > 0 && <span className={styles.fileCardMeta}>+{lines}</span>
        )}
        <span className={styles.fileCardChevron} data-open={open} aria-hidden>▾</span>
      </button>
      {open && <pre className={styles.fileCardCode}>{code}</pre>}
    </div>
  );
}

// Inline CSS/JS into the HTML so the generated app previews standalone in an iframe.
function buildPreview(files: GenFile[]): string | null {
  const html = files.find((f) => /\.html$/i.test(f.path));
  if (!html) return null;
  let doc = html.content;
  for (const f of files.filter((x) => /\.css$/i.test(x.path))) {
    const name = f.path.split("/").pop() ?? f.path;
    doc = doc.replace(new RegExp(`<link[^>]*href=["'][^"']*${escapeRe(name)}["'][^>]*>`, "gi"), `<style>\n${f.content}\n</style>`);
  }
  for (const f of files.filter((x) => /\.js$/i.test(x.path))) {
    const name = f.path.split("/").pop() ?? f.path;
    doc = doc.replace(new RegExp(`<script[^>]*src=["'][^"']*${escapeRe(name)}["'][^>]*>\\s*</script>`, "gi"), `<script>\n${f.content}\n</script>`);
  }
  return doc;
}

type Role = "vibex" | "coder" | "reviewer" | "user";
type Msg = { id: number; role: Role; text: string; verdict?: "pass" | "revise"; images?: AttachedImage[]; file?: { path: string; code: string; stub?: boolean } };

type RunEvent =
  | { type: "planned"; steps: string[]; live: boolean }
  | { type: "step_start"; index: number; title: string }
  | { type: "coder"; index: number; path: string; preview: string; tokens: number; cost: number; stub?: boolean }
  | { type: "reviewer"; index: number; verdict: "pass" | "revise"; note: string; tokens: number; cost: number }
  | { type: "step_done"; index: number }
  | { type: "usage"; tokens: number; cost: number; window: { kind: string; remaining: number; resetInMs: number } }
  | { type: "paused"; reason: string; resetInMs: number }
  | { type: "complete"; tokens: number; cost: number; steps: number; files: GenFile[] }
  | { type: "error"; message: string };

export default function RunWorkspace({ initialSpec, projectId }: { initialSpec?: Spec; projectId?: string }) {
  const router = useRouter();
  const [spec, setSpec] = useState<Spec>(initialSpec ?? {});
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
  const [attachments, setAttachments] = useState<AttachedImage[]>([]);

  // Working canvas: Preview ⇄ Code over the generated files (live previews while building,
  // full contents once the run completes).
  const [canvasTab, setCanvasTab] = useState<"preview" | "code">("code");
  const [files, setFiles] = useState<GenFile[]>([]);
  const [streamPaths, setStreamPaths] = useState<{ path: string; preview: string }[]>([]);
  const [activeFile, setActiveFile] = useState(0);
  const autoSwitched = useRef(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(true);
  const canvasRef = useRef<HTMLElement>(null);

  const abortRef = useRef<AbortController | null>(null);
  const localTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const stepsRef = useRef<string[]>([]);
  const idRef = useRef(0);
  const feedEnd = useRef<HTMLDivElement>(null);
  const steerRef = useRef<string[]>([]); // accumulated corrections
  const imagesRef = useRef<string[]>([]); // reference images (data URLs) for the build
  const previewIframeRef = useRef<HTMLIFrameElement>(null); // live preview, captured for design review
  const filesRef = useRef<GenFile[]>([]); // latest generated files (for capture + restyle base)
  const restylingRef = useRef(false); // true during a design-critic refine pass
  const designPassRef = useRef(0); // design refine passes done this build

  // Resizable split between the conversation and the working canvas (persisted).
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [convoW, setConvoW] = useState(400);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("vibex-run-convo-w"));
      if (saved >= 300 && saved <= 760) setConvoW(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      const max = Math.min(760, rect.width - 380);
      const w = Math.max(300, Math.min(max, ev.clientX - rect.left));
      setConvoW(w);
    };
    const onUp = () => {
      setDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setConvoW((w) => {
        try {
          localStorage.setItem("vibex-run-convo-w", String(Math.round(w)));
        } catch {
          /* ignore */
        }
        return w;
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const addMsg = (role: Role, text: string, verdict?: "pass" | "revise", images?: AttachedImage[], file?: { path: string; code: string; stub?: boolean }) =>
    setMessages((m) => [...m, { id: idRef.current++, role, text, verdict, images, file }]);

  const viewOutput = () => router.push(projectId ? `/result?project=${projectId}` : "/result");

  const toggleFullscreen = () => {
    const el = canvasRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  useEffect(() => {
    let parsed: Spec = initialSpec ?? {};
    if (!initialSpec) {
      try {
        parsed = JSON.parse(sessionStorage.getItem("vibex-spec") ?? "{}");
      } catch {
        /* defaults */
      }
    }
    setSpec(parsed);
    const plan = buildSteps(parsed);
    setSteps(plan);
    stepsRef.current = plan;
    if (!startedRef.current) {
      startedRef.current = true;
      void runBuild(parsed, 0);
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

  // Tidy up once the build finishes — collapse the step tracker so the feed has room.
  useEffect(() => {
    if (done) setTrackOpen(false);
  }, [done]);

  function apply(ev: RunEvent) {
    switch (ev.type) {
      case "planned":
        setSteps(ev.steps);
        stepsRef.current = ev.steps;
        setLive(ev.live);
        if (!restylingRef.current)
          addMsg("vibex", `Goal locked. Planned ${ev.steps.length} steps — building now${ev.live ? "" : " (simulated — no API key set)"}.`);
        break;
      case "coder": {
        if (ev.path) {
          addMsg("coder", ev.path, undefined, undefined, { path: ev.path, code: ev.preview, stub: ev.stub });
          setStreamPaths((p) =>
            p.some((x) => x.path === ev.path)
              ? p.map((x) => (x.path === ev.path ? { path: ev.path, preview: ev.preview } : x))
              : [...p, { path: ev.path, preview: ev.preview }],
          );
        } else {
          const title = stepsRef.current[ev.index] ?? `Step ${ev.index + 1}`;
          addMsg("coder", `${title} — ${ev.preview}`);
        }
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
        setRemaining(ev.window.remaining);
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
        if (ev.files?.length) {
          setFiles(ev.files);
          filesRef.current = ev.files;
        }
        // Finalization (done + completion message) and the auto design-critic loop are driven by
        // runBuild() once the whole stream is consumed — restyle passes must not flip "done" early.
        break;
      default:
        break;
    }
  }

  type StreamResult = { files: GenFile[] | null; live: boolean };

  // Run the build (or a design restyle pass) and report the final files. `extra.only` +
  // `extra.baseFiles` drive a targeted restyle; the design loop reuses this same path.
  async function startStream(
    theSpec: Spec,
    fromIndex: number,
    extra?: { only?: string[]; baseFiles?: GenFile[] },
  ): Promise<StreamResult> {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let finalFiles: GenFile[] | null = null;
    let liveFlag = true;
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spec: theSpec,
          startIndex: fromIndex,
          projectId,
          steer: steerRef.current.join(" — ") || undefined,
          images: imagesRef.current.length ? imagesRef.current : undefined,
          only: extra?.only,
          baseFiles: extra?.baseFiles,
        }),
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
            const ev = JSON.parse(line.slice(5).trim()) as RunEvent;
            if (ev.type === "planned") liveFlag = ev.live;
            if (ev.type === "complete") finalFiles = ev.files ?? [];
            apply(ev);
            got = true;
          } catch {
            /* skip frame */
          }
        }
      }
      if (!got) {
        runLocalFallback(theSpec, fromIndex);
        return { files: null, live: false };
      }
      return { files: finalFiles, live: liveFlag };
    } catch {
      if (ctrl.signal.aborted) return { files: null, live: false };
      runLocalFallback(theSpec, fromIndex);
      return { files: null, live: false };
    }
  }

  // One build, then the automatic design-critic loop, then finalize. Used for the initial run,
  // resumes, and user corrections — the design loop only runs on live, previewable builds.
  const MAX_DESIGN_PASSES = 2;
  async function runBuild(theSpec: Spec, fromIndex: number) {
    designPassRef.current = 0;
    restylingRef.current = false;
    const r = await startStream(theSpec, fromIndex);
    if (!r.files) return; // local fallback / aborted handle their own state
    await runDesignLoop(theSpec, r.live);
    setDone(true);
    addMsg("vibex", "Build complete — preview is on the canvas →");
  }

  // Wait for the preview iframe to mount the latest doc, then snapshot it for the critic.
  async function capturePreview(): Promise<string | null> {
    setCanvasTab("preview");
    for (let i = 0; i < 30; i++) {
      const body = previewIframeRef.current?.contentDocument?.body;
      if (body && body.childElementCount > 0) break;
      await new Promise((res) => setTimeout(res, 100));
    }
    await new Promise((res) => setTimeout(res, 200)); // let paint + fonts settle
    return captureIframe(previewIframeRef.current);
  }

  // Screenshot → /api/design-review → (if templated) a targeted restyle pass, up to N times.
  async function runDesignLoop(theSpec: Spec, isLive: boolean) {
    if (!isLive) return; // simulated build — nothing to critique
    for (let pass = 0; pass < MAX_DESIGN_PASSES; pass++) {
      if (abortRef.current?.signal.aborted) return;
      const current = filesRef.current;
      if (!current.length || !buildPreview(current)) return; // not previewable (API / CLI)

      const shot = await capturePreview();
      if (!shot) {
        addMsg("vibex", "Skipped design review — couldn't capture the preview.");
        return;
      }
      addMsg("reviewer", "Design review — assessing the rendered UI…");

      let res: { ok?: boolean; reason?: string; verdict?: "pass" | "revise"; score?: number; summary?: string; directions?: string } | null = null;
      try {
        const r = await fetch("/api/design-review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ screenshot: shot, spec: theSpec, projectId }),
        });
        res = await r.json();
      } catch {
        return;
      }
      if (!res?.ok) {
        if (res?.reason === "no-vision-key")
          addMsg("vibex", "Add an Anthropic or OpenAI key in Settings to auto-review and polish the design.");
        else if (res?.reason === "limit") addMsg("vibex", "Usage limit reached — skipping design review.");
        return;
      }

      addMsg("reviewer", `${res.summary || "Design assessed"} — ${res.score ?? 0}/100`, res.verdict);
      if (res.verdict === "pass" || !res.directions) {
        addMsg("vibex", "Design reads as distinctive — shipping it.");
        return;
      }

      designPassRef.current = pass + 1;
      addMsg("vibex", `Refining the design (pass ${pass + 1}): ${res.directions}`);
      steerRef.current.push(res.directions);
      restylingRef.current = true;
      const out = await startStream(theSpec, 0, { only: ["styles.css", "index.html"], baseFiles: filesRef.current });
      restylingRef.current = false;
      if (!out.files) return; // aborted / failed restyle
    }
    addMsg("vibex", "Design polished.");
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
        const title = theSpec.idea ?? "Your app";
        setFiles([
          {
            path: "index.html",
            content: `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>\n<body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#14110f;color:#f4eee6"><main style="text-align:center"><h1 style="color:#ff5a1f">${title}</h1><p>Built by Vibex.</p></main></body></html>\n`,
          },
        ]);
        setDone(true);
        addMsg("vibex", "Build complete. Preview is on the canvas →");
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
    void runBuild(spec, completed);
  }

  // A correction (text and/or an image) re-runs the build from the top with the new direction
  // (and the image's description) folded into every file.
  async function send() {
    const text = draft.trim();
    if ((!text && attachments.length === 0) || done) return;
    addMsg("user", text || "(reference image)", undefined, attachments);
    if (attachments.length) {
      try {
        imagesRef.current = await Promise.all(attachments.slice(0, 2).map((a) => fileToDataUrl(a.file)));
      } catch {
        imagesRef.current = [];
      }
    }
    if (text) steerRef.current.push(text);
    setDraft("");
    setAttachments([]);

    abortRef.current?.abort();
    if (localTimer.current) clearInterval(localTimer.current);
    setCompleted(0);
    setDone(false);
    setPaused(false);
    setLimitPause(false);
    // Keep the current files on the canvas during the rebuild — a correction shouldn't blank
    // the user's working app; the new build replaces them only once it completes.
    setStreamPaths([]);
    setActiveFile(0);
    autoSwitched.current = false;
    addMsg("vibex", "On it — rebuilding with that change folded in.");
    void runBuild(spec, 0);
  }

  const total = steps.length || 1;
  const pct = Math.round((completed / total) * 100);
  const status = done ? "DONE" : paused ? "PAUSED" : "LIVE";

  const roleLabel: Record<Role, string> = { vibex: "Vibex", coder: "Coder", reviewer: "Reviewer", user: "You" };

  // Canvas content: full files once complete, otherwise the live per-file previews as they stream.
  const canvasFiles: GenFile[] = files.length ? files : streamPaths.map((s) => ({ path: s.path, content: s.preview }));
  const safeFile = Math.min(activeFile, Math.max(0, canvasFiles.length - 1));
  const previewDoc = files.length ? buildPreview(files) : null;

  // When the build finishes and there's something previewable, flip the canvas to Preview once.
  useEffect(() => {
    if (done && previewDoc && !autoSwitched.current) {
      autoSwitched.current = true;
      setCanvasTab("preview");
    }
  }, [done, previewDoc]);

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" aria-label="Vibex home">
          <Logo size={26} />
        </Link>
        <div className={styles.topRight}>
          <BackLink href="/dashboard" label="Back" />
          <span className={styles.live} data-status={status}>
            <span className={styles.dot} /> {status}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div
        ref={workspaceRef}
        className={`${styles.workspace} ${dragging ? styles.dragging : ""}`}
        style={{ "--convo-w": `${convoW}px` } as React.CSSProperties}
      >
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

          <div className={styles.buildTrack}>
            <button type="button" className={styles.buildTrackHead} onClick={() => setTrackOpen((v) => !v)} aria-expanded={trackOpen}>
              <span className={styles.paneLabel}>Build</span>
              <span className={styles.buildTrackMeta}>
                <span className={styles.steppill} data-done={done}>
                  {done ? "done" : `step ${Math.min(completed + 1, total)} of ~${total}`}
                </span>
                <span className={styles.trackChevron} data-open={trackOpen} aria-hidden>▾</span>
              </span>
            </button>
            <div className={styles.progress}><i style={{ width: `${done ? 100 : pct}%` }} /></div>
            {trackOpen && (
            <div className={styles.steps}>
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
            )}
          </div>

          <div className={styles.feed}>
            {messages.map((m) => (
              <div key={m.id} className={styles.msg} data-role={m.role}>
                <span className={styles.msgRole}>{roleLabel[m.role]}</span>
                {m.file ? (
                  <FileCard path={m.file.path} code={m.file.code} stub={m.file.stub} />
                ) : (
                  <span className={styles.msgText}>
                    {m.role === "reviewer" && (
                      <span className={styles.verdict} data-v={m.verdict}>{m.verdict === "revise" ? "REVISE" : "PASS"}</span>
                    )}
                    {m.text}
                    {m.images && m.images.length > 0 && (
                      <span className={styles.msgImages}>
                        {m.images.map((im) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={im.id} src={im.url} alt={im.name} />
                        ))}
                      </span>
                    )}
                  </span>
                )}
              </div>
            ))}
            {!done && !paused && (
              <div className={styles.typing} aria-hidden>
                <span className={styles.typingRole}>{roleLabel.coder}</span>
                <span className={styles.typingDots}><i /><i /><i /></span>
              </div>
            )}
            <div ref={feedEnd} />
          </div>

          <div className={styles.composer}>
            {attachments.length > 0 && (
              <div className={styles.attachStrip}>
                <Thumbs images={attachments} onRemove={(id) => setAttachments((a) => a.filter((x) => x.id !== id))} />
              </div>
            )}
            <div className={styles.inputRow}>
              <AttachButton onPick={(imgs) => setAttachments((a) => [...a, ...imgs])} />
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
              <button type="button" className={styles.sendBtn} onClick={send} disabled={done || (!draft.trim() && attachments.length === 0)} aria-label="Send">
                <Send />
              </button>
            </div>
            <div className={styles.actions}>
              {done ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={viewOutput}>
                    View output →
                  </button>
                  {files.length > 0 && <OpenInStackBlitz files={files} title={spec.idea} />}
                </>
              ) : paused ? (
                <button type="button" className={styles.resumeBtn} onClick={resume}>▶ Resume</button>
              ) : (
                <button type="button" className={styles.interruptBtn} onClick={interrupt}>❚❚ Interrupt</button>
              )}
            </div>
          </div>
        </section>

        <div
          className={styles.divider}
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize panels"
          onMouseDown={startDrag}
        />

        {/* ── right: working canvas ────────────────────── */}
        <section className={styles.canvas} ref={canvasRef}>
          <div className={styles.paneHead}>
            <div className={styles.canvasTabs} role="tablist">
              <button type="button" role="tab" aria-selected={canvasTab === "preview"} className={styles.canvasTab} data-active={canvasTab === "preview"} onClick={() => setCanvasTab("preview")}>
                Preview
              </button>
              <button type="button" role="tab" aria-selected={canvasTab === "code"} className={styles.canvasTab} data-active={canvasTab === "code"} onClick={() => setCanvasTab("code")}>
                Code
              </button>
            </div>
            <div className={styles.canvasCtrls}>
              <button type="button" className={styles.ctrlBtn} onClick={toggleFullscreen} aria-label="Toggle fullscreen" title="Fullscreen">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
              </button>
            </div>
          </div>

          <div className={styles.canvasBody}>
            {canvasTab === "preview" ? (
              previewDoc ? (
                <iframe
                  ref={previewIframeRef}
                  className={styles.previewFrame}
                  srcDoc={previewDoc}
                  title="Live preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                />
              ) : (
                <div className={styles.canvasEmpty}>
                  <div className={styles.canvasEmptyIcon} aria-hidden>◴</div>
                  <p>{done ? "No previewable HTML — check the Code tab." : "Live preview appears once the build produces the files."}</p>
                </div>
              )
            ) : canvasFiles.length ? (
              <div className={styles.ide}>
                <aside className={styles.ideTree}>
                  {canvasFiles.map((f, i) => (
                    <button key={f.path} type="button" className={styles.ideItem} data-active={safeFile === i} onClick={() => setActiveFile(i)}>
                      <span className={styles.ideIcon}>›</span>
                      {f.path}
                    </button>
                  ))}
                </aside>
                <div className={styles.ideViewer}>
                  <div className={styles.ideBar}>
                    <span className={styles.ideBarPath}>{canvasFiles[safeFile]?.path}</span>
                    {!files.length && <span className={styles.ideLive}>writing…</span>}
                    {canvasFiles[safeFile]?.content && <CopyButton text={canvasFiles[safeFile].content} />}
                  </div>
                  <pre className={styles.ideCode}>{canvasFiles[safeFile]?.content}</pre>
                </div>
              </div>
            ) : (
              <div className={styles.canvasEmpty}>
                <div className={styles.canvasEmptyIcon} aria-hidden>{"›_"}</div>
                <p>Files appear here as the build writes them.</p>
              </div>
            )}
          </div>

          <button type="button" className={styles.usageDock} data-open={usageOpen} onClick={() => setUsageOpen((o) => !o)} aria-label="Token usage">
            <span className={styles.usageDockMain}>
              {(tokens / 1000).toFixed(1)}k used{remaining != null ? ` · ${Math.max(0, remaining / 1000).toFixed(0)}k left` : ""}
            </span>
            {usageOpen && (
              <span className={styles.usageDockDetail}>~${cost.toFixed(2)} · resets in {fmtMs(resetInMs)}</span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
}
