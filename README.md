<div align="center">

# Vibex

### From idea to code, automatically.

**You have the idea. You hate writing 20 prompts manually. We do it for you.**

</div>

---

Vibex is an **automated vibe-coding platform**. You describe an app idea, a Claude-Code-style Q&A interviews you, a goal doc is locked, then Vibex autonomously generates and runs prompts — a **Coder AI + Reviewer AI** working step-by-step until the goal is met — with an **always-visible Interrupt button**.

It removes the manual loop people do today: generate 15–20 prompts in ChatGPT/Gemini, paste each into Claude/Cursor, wait, repeat. Vibex runs that loop for you and never loses progress.

## Highlights

- **Idea → interview → goal lock → build → output**, as real routes.
- **Claude-Code-style interview** — bordered question cards, number badges, arrow/number/↵ selection, "write your own", adaptive (skips what doesn't apply), in plain language for non-technical users.
- **Two-pane build workspace** (`/run`) — conversation on the left (live Coder/Reviewer narration + steering), working canvas on the right (live step stream + output).
- **Dual-AI execution engine** streamed over SSE — goal-driven *step N of ~M*, not a fixed count.
- **Time-based usage windows** (5-hour / daily / monthly) with **auto-pause & resume** — never credit top-ups, never lost progress. Usage is always visible, including for BYOK.
- **Pre-run cost estimate** computed from real per-model pricing.
- **Plans & pricing** — Free (1 project) · Starter $12 · Pro $29 · Scale $79 · BYOK $5/mo.
- **"Ember on warm charcoal"** design system — dark + light, no Tailwind/shadcn, typography-led, deliberately not AI-generated-looking.

## Tech stack

- **Next.js** (App Router) + **TypeScript**
- **Neon** serverless Postgres + **Prisma**
- **Auth.js (NextAuth v5)** — Google OAuth + email magic links, encrypted BYOK key storage
- **Anthropic SDK** (Claude Opus 4.8 / Sonnet 4.6), OpenAI & Google via REST
- Styling: **CSS variables + CSS Modules** (no Tailwind, no component library)
- Deploy: **Vercel**

## Getting started

```bash
git clone https://github.com/aniketk0412/VibeX.git
cd VibeX
npm install
cp .env.example .env                  # fill in the values below
npx prisma generate
npx prisma migrate dev --name init    # needs a Neon DATABASE_URL
npm run dev                           # http://localhost:3000
```

The app runs **without any keys** — the execution engine *simulates* a run so the whole flow is demoable. Add provider keys to switch to real models.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | Neon Postgres (pooled / direct for migrations) |
| `AUTH_SECRET` | Auth.js secret (`npx auth secret`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
| `AUTH_RESEND_KEY` / `AUTH_EMAIL_FROM` | Email magic links (Resend) |
| `ENCRYPTION_KEY` | 32-byte key for encrypting BYOK keys (`openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | Real Claude runs (else simulated) |
| `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | Real GPT-4o / Gemini runs |
| `NEXT_PUBLIC_APP_URL` | Public base URL (SEO, metadata, sitemap) |

See [.env.example](.env.example) for the full template. **Never commit `.env`** — it's gitignored.

## Project structure

```
app/
  page.tsx              landing (animated Cockpit panel) + #pricing
  new/                  idea entry
  interview/            Claude-Code-style Q&A → goal lock
  run/                  two-pane build workspace (conversation + canvas)
  result/               code view + prompt history + download
  pricing/              plans page
  signin/  dashboard/   Auth.js sign-in + project-count routing
  api/run/              SSE stream of the execution engine
  api/auth/             Auth.js handlers
  robots.ts sitemap.ts not-found.tsx
components/             Logo, ThemeToggle, SiteHeader/Footer, StepIndicator,
                        QuestionCard, CockpitPanel, PricingTable
lib/
  engine.ts             dual-AI Coder→Reviewer loop (async generator)
  ai/                   provider layer (Anthropic SDK + REST) + pricing
  usage.ts              rolling usage windows + limits
  plans.ts              plan catalog (tied to usage limits)
  steps.ts              goal-driven build plan
  prisma.ts  projects.ts  crypto.ts
prisma/schema.prisma    User/Account/Session/Project/Run/Prompt/UsageWindow/ApiKey
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Next lint |

## Design system — Ember on warm charcoal

Tokens live in `app/globals.css` (dark default + a light variant). The accent is ember `#FF5A1F` — the one ownable color, never blue/purple. Fonts via `next/font`: **Bricolage Grotesque** (display), **Hanken Grotesk** (body), **JetBrains Mono** (mono). Theme is set before first paint in `app/layout.tsx`, toggled by `components/ThemeToggle.tsx`, persisted to `localStorage`. No gradients, glassmorphism, or stock AI art — typography does the heavy lifting.

## Deploy (Vercel)

1. Import the repo into Vercel.
2. Add the env vars above in the Vercel project settings.
3. Vercel runs `prisma generate` on install (via the `postinstall` script) then `next build`.
4. Run `npx prisma migrate deploy` against your Neon database to apply the schema in production.

## Roadmap

1. ✅ Foundation — design system, fonts, logo, theme, landing
2. ✅ Core flow — `/new` → `/interview` → `/run` → `/result`
3. ✅ Prisma + Auth.js (Neon) + project-count routing *(set env to enable)*
4. ✅ Dual-AI execution engine + usage/limits *(simulates without keys)*
5. ✅ Plans & pricing + pre-run cost estimate
6. ✅ Launch polish — SEO (robots/sitemap/metadata), custom 404, deploy prep

---

<div align="center"><sub>Vibex — vibe + execute.</sub></div>
