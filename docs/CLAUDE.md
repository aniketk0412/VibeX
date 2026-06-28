# Vibex — project guide

Vibex is an **automated vibe-coding platform**: a user describes an app idea, a smart Q&A interviews them, a goal doc is locked, then Vibex autonomously generates + runs prompts (Coder AI + Reviewer AI) step-by-step until the goal is met — with an **always-visible Interrupt button**.

- Tagline: *"From idea to code, automatically."*
- Hero copy (locked, exact): **"You have the idea. You hate writing 20 prompts manually. We do it for you."**

## How to work in this repo

- Build **incrementally, one screen/feature at a time**. Do not scaffold everything at once.
- After changes, run `npm run dev` and verify it renders; keep `npx tsc --noEmit` and the build clean.
- **Do not** add Tailwind or shadcn/ui. Styling = CSS variables (`app/globals.css`) + CSS Modules.
- Never hardcode hex colors in components — use the CSS variables.

## Tech stack (locked — do not change)

- **Next.js** (App Router) + TypeScript
- **Neon** (serverless Postgres) — NOT Supabase (geo-blocked for Indian JIO SIM users)
- **Prisma** ORM
- **Auth.js** (NextAuth) — sessions, OAuth (email + Google), encrypted BYOK key storage
- **Vercel** deploy

## Design system — "Ember on warm charcoal" (locked)

Tokens live in `app/globals.css`. Dark is the default; light variant under `[data-theme="light"]`.

- bg `#14110F` · surface `#201B17` · line `#352D26` · text `#F4EEE6` · dim `#B6AC9E`
- **accent (ember) `#FF5A1F`** — the ONE ownable accent. Never blue/purple. Light-mode accent `#E8480D`.
- good `#46C08C`
- Fonts via `next/font` (`app/layout.tsx`): **Bricolage Grotesque** (`--font-display`), **Hanken Grotesk** (`--font-body`), **JetBrains Mono** (`--font-mono`).
- Theme is set before paint in `layout.tsx`, toggled by `components/ThemeToggle.tsx`, persisted to `localStorage('vibex-theme')`, default dark.

### Non-negotiable visual rules (from PRD)

- Must **NOT** look AI-generated. No default shadcn/Tailwind templates.
- No gradients, mesh, noise, glassmorphism. No stock images, robot/neural-net/floating-code art.
- Typography does the heavy lifting — big, confident, slightly unexpected.
- Both light + dark, toggle always accessible.

## Logo

`components/Logo.tsx` — custom mark: a fast-forward `»` (Vibe + Execute) in an ember rounded square. `public/vibex-mark.svg` is the favicon. Never use a default/placeholder logo.

## Core product flow & routing (build as real routes)

- **New signup (0 projects)** → `/new` idea-entry ("What do you want to build?"). Only first-timers see this.
- After submitting the idea → Q&A interview; **every post-idea screen shows a step indicator** (Idea · Scope · Stack · Models · Goal).
- **Returning user (≥1 project)** → lands on the app home/dashboard (skips the idea screen).
- **"New project"** button → goes straight to the Q&A interview.
- **Q&A UI must look like how Claude Code asks**: bordered question cards, options with a bold label + dim description, number badges, a `❯` pointer on the highlighted row, arrow-key / number / `↵` selection, and a "write your own" input row. One question at a time; answered ones collapse into a transcript above.
- **Goal lock** → spec summary the user confirms (incl. estimated cost) before execution.
- **Execution** → live step stream, dynamic "step N of ~M" (goal-driven, NOT a fixed count), always-visible Interrupt bar showing current step context. Interrupt → AI summarizes where it stopped → user corrects → resume.
- **Output** → in-browser code + download `.zip` + full prompt history.

## Dual-AI system

Every run uses a **Coder AI + Reviewer AI**; the user picks the combo.
Coder options: Claude Sonnet / GPT-4o / Gemini Flash. Reviewer options: Claude Opus / GPT-4o / Gemini Pro.
Show an **estimated cost per project before execution**.

## Plans, pricing & limits

- Free trial: **1 project ever**. Starter **$12/mo**. Pro **$29/mo**. Scale **$79/mo**. BYOK **$5/mo** (provider limits).
- Rate limiting = **time-based rolling windows** (5-hour, daily, monthly resets) — NOT credit top-ups. On limit hit: auto-pause + save, notify reset time, auto-resume. Never lose progress.
- **Usage visibility for ALL users incl. BYOK**: tokens used, est. cost, remaining window + reset countdown. BYOK: provider limits apply + auto-retry on rate-limit errors.

## Live-run homepage panel

The homepage hero is a **live animated execution loop** (the product is the hero). Chosen treatment = **"Cockpit"** (usage stats + collapsed goal chip + current-step card with progress + always-visible interrupt bar). Currently rendered **statically** in `app/page.tsx` — animate it next.

## Out of scope (MVP)

Team/multi-user collaboration, version history beyond the current session, native mobile app, self-hosting, custom fine-tuned models.

## Suggested data model (Prisma — to build in Phase 3)

`User`, Auth.js `Account`/`Session`, `Project`, `Run`, `Prompt` (per-step: model, tokens, cost), `UsageWindow` (5h/daily/monthly), `ApiKey` (encrypted, per provider, per user — BYOK). **Project count drives routing.**

## Current status / roadmap

1. ✅ **Foundation** — design system, fonts, logo, theme, app shell, landing (Cockpit panel static)
2. ⏳ **Core flow screens** — `/new` (idea → Claude-Code-style Q&A) → `/goal` → `/run` → `/result`
3. **Prisma + Auth.js** (Neon) + project-count routing
4. **Dual-AI execution engine** + usage/limits
5. **Plans & pricing** + pre-run cost estimate
6. **Launch polish, SEO, deploy**

Domain: `vibex.io` assumed (availability unconfirmed).

## Current files

```
app/layout.tsx · globals.css · page.tsx (+page.module.css)
components/ Logo.tsx · ThemeToggle.tsx · SiteHeader.tsx(+css) · SiteFooter.tsx(+css)
public/vibex-mark.svg
.env.example · README.md
```
