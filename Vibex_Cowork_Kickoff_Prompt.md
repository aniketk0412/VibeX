# Vibex — Cowork Kickoff Prompt
Paste everything below this line into Cowork 👇

---

I'm building a product called **Vibex** — an automated vibe coding platform. I have a full PRD document (attached) that explains everything in detail. Read it fully before doing anything else.

Here's the context so you understand the spirit of the product:

Vibex solves a real problem — when people vibe code, they currently have to manually generate 15-20 prompts using Gemini or ChatGPT, then copy-paste each one into Claude/Cursor and wait for it to finish, then repeat. Vibex automates this entire loop. User describes their idea, gets interviewed by an AI Q&A system, a goal document is locked, and then Vibex autonomously generates and executes prompts one by one until the project is done — with a live interrupt button always on screen.

---

## What I want you to do

Act as both a senior product engineer AND as the Vibex methodology itself. That means:

1. **Read the PRD fully first** — understand every decision that's already been made
2. **Ask me ONLY what you genuinely cannot infer** from the PRD — don't ask things already answered there
3. **Generate a step-by-step build plan** — break Vibex into logical build phases (foundation → core loop → UI → payments → launch)
4. **Then start executing phase 1** — don't wait for me to say go after the plan is confirmed

---

## Tech stack (already decided, do not change)

- Frontend: Next.js (App Router)
- Database: Neon DB (Serverless Postgres) — NOT Supabase (blocked for Indian JIO SIM users)
- ORM: Prisma
- Auth: NextAuth.js
- Deployment: Vercel

---

## Key product decisions already locked (do not re-ask)

- Name: Vibex
- Hero copy: "You have the idea. You hate writing 20 prompts manually. We do it for you."
- The homepage hero is a LIVE animated execution loop — not a screenshot or mockup
- Dual AI system: Coder AI + Reviewer AI (user picks the combo)
- Supports Claude, GPT-4o, Gemini — user brings own API key (BYOK) or uses Vibex plan
- Interrupt button is ALWAYS visible during execution — not a mode, always on screen
- Interrupt shows current step context e.g. "⚙ Building auth system — step 4 of ~12"
- After interrupt: AI summarises where it stopped, user corrects, then resumes
- Execution loop is goal-driven, NOT a fixed prompt count
- Rate limiting: time-based resets (5-hour rolling, daily, monthly) — NOT credit top-ups
- All users including BYOK see live usage stats
- Monetization: 1 free project trial, then paid plans + BYOK at $5/mo platform fee
- Both light and dark mode with toggle always accessible
- Design must NOT look AI-generated — no generic shadcn/Tailwind templates

---

## What's still open (you can ask about these if needed)

- Final color direction and visual identity — I haven't picked this yet, suggest something that feels premium and non-generic
- Exact token limits per plan tier
- Domain name (vibex.io / vibex.app / getvibex.com)

---

## How I want you to work

Build this the way Vibex itself works — autonomously, step by step, telling me what you're doing at each step. Don't ask for permission at every turn. If you hit a decision point that genuinely requires my input, pause and ask. Otherwise keep going.

Let's build Vibex using the Vibex methodology. Go.
