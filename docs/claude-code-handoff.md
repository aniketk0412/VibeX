# Claude Code — kickoff prompt

Paste the block below into Claude Code (run it from inside `X:\VibeX`). It assumes Claude Code auto-reads `CLAUDE.md`.

---

```
Read CLAUDE.md fully first — all product, stack, and design decisions are locked there. Don't re-decide them.

We're at Phase 2: build the /new flow. Work incrementally, match the "Ember on warm charcoal" design system (CSS variables in app/globals.css + CSS Modules — NO Tailwind/shadcn), and keep the build type-clean (npx tsc --noEmit) after each step.

STEP 1 — /new (idea entry), only screen for now:
- A step indicator at the top: Idea · Scope · Stack · Models · Goal (Idea active).
- "What do you want to build?" heading (Bricolage display), a short subtext, then a large auto-growing <textarea> (surface bg, ember focus ring) with placeholder "e.g. a habit tracker with streaks and daily reminders…".
- 3–4 example chips that fill the textarea on click.
- Primary "Start interview →" button, disabled until there's text. ⌘/Ctrl+Enter also submits.
Then stop and let me run `npm run dev` to check it.

STEP 2 — /interview (Claude-Code-style Q&A):
- One bordered question card at a time. Each option: number badge + bold label + dim description; a ❯ pointer on the highlighted row. Arrow keys move, number keys pick, ↵ selects. Include a "write your own" input row.
- Answered questions collapse into a transcript above the active card. The step indicator advances (Scope → Stack → Models).
- Phases/questions: (Scope) platform? · core feature for v1? (Stack) tech preference? (Models) Coder + Reviewer duo, plus a BYOK vs Vibex-plan toggle.
- End on a goal-lock summary card (idea, platform, core, stack, models, estimated cost) with a "Start building →" primary.

Keep all state client-side for now — NO database and NO execution engine yet (those are Phases 3 and 4). There are reference HTML prototypes of these screens; match their structure and the tokens in app/globals.css.
```

---

After /new is done, continue down the roadmap in CLAUDE.md (Phase 3: Prisma + Auth.js on Neon, then the execution engine). Come back to Cowork anytime for design directions, prototypes, copy, or planning.
