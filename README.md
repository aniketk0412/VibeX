# Vibex

**From idea to code, automatically.** An automated vibe-coding platform — describe an idea, get interviewed by a smart Q&A, lock a goal, and let Vibex generate and run prompts step-by-step until it's done.

## Stack

- **Next.js** (App Router) + TypeScript
- **Neon** (serverless Postgres) — *not* Supabase
- **Prisma** ORM
- **Auth.js** (NextAuth) — sessions, OAuth, encrypted BYOK key storage
- **Vercel** for deployment
- Styling: hand-rolled design system (CSS variables + CSS Modules). **No** generic shadcn/Tailwind template — typography and one ownable ember accent do the work.

## Getting started

```bash
npm install
cp .env.example .env      # fill in values when wiring DB/auth (Phase 3)
npm run dev               # http://localhost:3000
```

## Design system — Ember on warm charcoal

Tokens live in `app/globals.css` (dark default + light). The accent is ember `#FF5A1F`; never blue/purple. Fonts (via `next/font`): **Bricolage Grotesque** (display), **Hanken Grotesk** (body), **JetBrains Mono** (mono). Theme is set before paint in `app/layout.tsx` and toggled by `components/ThemeToggle.tsx` (persists to `localStorage`, default dark).

## Project structure (current)

```
app/
  layout.tsx        fonts, theme init, metadata
  globals.css       design tokens + primitives
  page.tsx          landing (hero + Cockpit live-run panel)
  page.module.css
components/
  Logo.tsx          custom » brand mark + wordmark
  ThemeToggle.tsx   client theme switch
  SiteHeader.tsx    nav + logo + toggle
  SiteFooter.tsx
public/
  vibex-mark.svg    favicon / brand mark
```

## Build roadmap

1. ✅ Foundation — design system, fonts, logo, theme, app shell
2. ⏳ Core flow screens — `/new` (idea entry), `/interview` (Claude-Code-style Q&A), `/goal`, `/run`, `/result`
3. Next.js + Prisma + Auth.js data layer (Neon) with project-count routing
4. Dual-AI execution engine + usage/rate-limits (5h / daily / monthly)
5. Plans & pricing (Free trial, Starter $12, Pro $29, Scale $79, BYOK $5/mo) + pre-run cost estimate
6. Launch polish, SEO, deploy
