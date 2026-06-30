// The curated design knowledge the art-director critic retrieves from (the RAG corpus). Each
// entry is a concrete, prescriptive reference — the quality bar to push generated apps toward,
// and the antidote to "vibe-coded" defaults. Seeded into DesignReference by /api/admin/seed-design.

export type DesignRef = { category: string; title: string; body: string };

export const DESIGN_CORPUS: DesignRef[] = [
  // ── general anti-template heuristics ──────────────────────────────────────
  {
    category: "general",
    title: "Tells of a vibe-coded UI",
    body: "Generic AI output shares a look: one centered column, the default system font at one or two sizes, a flat blue/grey palette, pure-white background, evenly spaced equal-weight cards, no elevation, and decorative emoji as icons. Fixing any three of these immediately reads as intentional.",
  },
  {
    category: "general",
    title: "Type system over a single font",
    body: "Pair a characterful display face for headings (a serif like Fraunces/Newsreader or a strong grotesk) with a clean body face. Set a deliberate scale (e.g. 13 / 15 / 19 / 28 / 44px), tighten heading letter-spacing to about -0.02em, and lift weight contrast (700-800 headings vs 400-500 body). One font at one weight is the clearest template tell.",
  },
  {
    category: "general",
    title: "Spacing rhythm and whitespace",
    body: "Use a consistent 4/8px spacing scale and be generous: 64-96px between major sections, 20-28px card padding. Whitespace is the cheapest way to look premium. Cramped, uniform 16px gaps everywhere read as a default template.",
  },
  {
    category: "general",
    title: "Warm, considered colour",
    body: "Avoid pure #fff on #000 and default Bootstrap blue. Choose a warm off-white or near-black base (e.g. #F6F1E9 / #14110F), 2-3 neutral steps, and ONE confident accent used sparingly for primary actions. Tint borders and shadows with the base hue rather than pure grey/black.",
  },
  {
    category: "general",
    title: "Depth and elevation",
    body: "Give surfaces a 3-tier shadow scale: a soft resting shadow on cards, a stronger one on hover, and a heavy one for modals. Use 1px hairline borders in a tinted line colour. Flat bordered boxes with no shadow are a template signature.",
  },
  {
    category: "general",
    title: "Micro-interactions and motion",
    body: "Add intentional motion: buttons lift 1px on hover and depress on active, cards translateY(-2px) with a shadow bump, content fades/rises in on scroll. Use one shared easing curve and 150-450ms durations. Respect prefers-reduced-motion.",
  },
  // ── landing pages ─────────────────────────────────────────────────────────
  {
    category: "landing",
    title: "Editorial hero, not a centered stack",
    body: "Strong landing heroes use an asymmetric two-column split (oversized headline + supporting copy on the left, a product visual or live demo on the right), a small mono eyebrow label, and a single primary CTA with a quiet secondary. Avoid the centered headline + two buttons + three identical feature cards template.",
  },
  {
    category: "landing",
    title: "Sectioning and social proof",
    body: "Give a landing real rhythm: hero → trust/logos strip → how-it-works (numbered steps) → features (varied, not identical cards) → proof (stats or testimonials) → pricing → FAQ → closing CTA. Vary section backgrounds subtly and lead each with a mono eyebrow + display H2.",
  },
  // ── dashboards / app shells ───────────────────────────────────────────────
  {
    category: "dashboard",
    title: "Dashboard density and hierarchy",
    body: "Dashboards should feel information-dense but calm: a persistent sidebar or top bar, stat tiles with a mono label + large numeric value, and a clear primary metric. Use tabular/mono numerals for figures, restrained colour (accent only for the key metric or status), and a max content width so it doesn't sprawl.",
  },
  {
    category: "dashboard",
    title: "Data display details",
    body: "Tables and lists read as crafted when rows have generous height, zebra or hairline separators, right-aligned numerics, status as subtle tinted pills (not bright badges), and empty states with an icon + one line + an action. Default unstyled <table> output is an instant template tell.",
  },
  // ── tools / utilities ─────────────────────────────────────────────────────
  {
    category: "tool",
    title: "Focused single-purpose tool layout",
    body: "A good utility centers the one job: a prominent input/canvas, results immediately below or beside it, and controls grouped in a compact toolbar. Give the primary input real presence (large text, clear affordance) and keep chrome minimal. Avoid burying the core action in a generic card grid.",
  },
  {
    category: "tool",
    title: "Keyboard and state feedback",
    body: "Tools feel professional with visible focus rings, keyboard shortcuts shown in <kbd> chips, instant inline feedback (copied!, saved), and clear loading/empty/error states. Disabled and active states should be visually distinct, not just lower opacity.",
  },
  // ── forms ─────────────────────────────────────────────────────────────────
  {
    category: "form",
    title: "Forms that don't look default",
    body: "Group fields with clear labels above inputs, comfortable 10-12px padding, a 1px tinted border that turns accent + soft ring on focus, helper text in a dim tone, and inline validation. One full-width primary button. Avoid stacked unstyled inputs with a lone grey 'Submit' — the canonical template form.",
  },
  {
    category: "form",
    title: "Multi-step and progress",
    body: "For longer forms, show a step indicator, ask one thing at a time where possible, preserve answers, and make the primary action obvious per step. Confirmation and success states should feel like a payoff, not a blank redirect.",
  },
];
