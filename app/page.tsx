import { headers } from "next/headers";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CockpitPanel from "@/components/CockpitPanel";
import PricingTable from "@/components/PricingTable";
import Reveal from "@/components/Reveal";
import BeforeAfter from "@/components/BeforeAfter";
import styles from "./page.module.css";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://vibex.io";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Vibex?",
    a: "Vibex turns an idea into working code. You describe it once; Vibex interviews you to lock the goal, then a Coder AI writes each file and a Reviewer AI checks it — generating and running every prompt until it's done.",
  },
  {
    q: "Do I have to write prompts?",
    a: "No — that's the whole point. You answer a short interview in plain language and Vibex writes and runs all the prompts for you, hands-free.",
  },
  {
    q: "Can I bring my own API key?",
    a: "Yes. Add your Anthropic, OpenAI, or OpenRouter key in Settings and builds run on your key — or use a Vibex plan. OpenRouter's free models cost $0.",
  },
  {
    q: "How do usage limits work?",
    a: "They're time-based rolling windows, not credit top-ups. When you hit a window the build pauses and auto-resumes when it resets, so you never lose progress.",
  },
  {
    q: "What can Vibex build?",
    a: "Web apps, APIs, and CLI tools. You get a live preview, the real file tree, and a downloadable .zip of working code.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes — one free project runs the full Coder + Reviewer loop on free community models, with a live preview, the design critique score, and a .zip download. No card required. Paid plans add your chosen model, automatic design polish, and one-click shipping.",
  },
];

const HOW: { n: string; t: string; d: string }[] = [
  {
    n: "01",
    t: "Describe it once",
    d: "Tell Vibex what you want in plain language. No prompt engineering, no boilerplate, no setup.",
  },
  {
    n: "02",
    t: "It locks the goal",
    d: "A short interview fills the gaps, then locks a concrete spec and a cost estimate — so you approve the plan before a line is written.",
  },
  {
    n: "03",
    t: "Coder + Reviewer build it",
    d: "A Coder AI writes each file and a Reviewer AI checks it, prompt after prompt, until it runs. Watch the live build and interrupt anytime.",
  },
];

// Real stroke icons (not dingbats/emoji — random Unicode glyphs in tinted tiles is the #1
// "AI-generated page" tell). One consistent 24-viewBox stroke style, inherits currentColor.
function Ic({ d, children }: { d?: string; children?: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d ? <path d={d} /> : children}
    </svg>
  );
}
const ICONS = {
  loop: <Ic d="M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />,
  monitor: (
    <Ic>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4M9.5 8l3 2.5-3 2.5" />
    </Ic>
  ),
  key: <Ic d="M21 2l-2 2m-5.5 5.5L21 2m-7.5 7.5L16 12m-2.5-2.5a5.5 5.5 0 1 0-7.8 7.8 5.5 5.5 0 0 0 7.8-7.8z" />,
  box: (
    <Ic>
      <path d="M21 8v13H3V8M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </Ic>
  ),
  zap: <Ic d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  rewind: <Ic d="M1 4v6h6M3.5 15a9 9 0 1 0 2.1-9.4L1 10" />,
  lock: (
    <Ic>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Ic>
  ),
} as const;
type IconKey = keyof typeof ICONS;

const FEATURES: { icon: IconKey; t: string; d: string }[] = [
  { icon: "loop", t: "Two-AI build loop", d: "A Coder writes, a Reviewer verifies — every prompt, hands-free. You get working code, not a rough first draft." },
  { icon: "monitor", t: "Live preview + in-app IDE", d: "Watch it run as it's built, then edit the code and read the console without leaving the page." },
  { icon: "key", t: "Bring your own key", d: "Anthropic, OpenAI, Gemini, or OpenRouter — its free models cost $0. Or run on a Vibex plan." },
  { icon: "box", t: "Your code, yours to keep", d: "A real file tree, a downloadable .zip, and one-click export to a fresh GitHub repo." },
  { icon: "zap", t: "Ship in one click", d: "Deploy straight to Vercel or Netlify, or open the project in StackBlitz." },
  { icon: "rewind", t: "Limits that never burn you", d: "Time-based rolling windows auto-pause and resume — you never lose progress or a credit." },
];

// Reassurance, framed as a contrast: the failure mode users hit elsewhere → what Vibex does
// instead. Every claim maps to a real safeguard shipped in the build pipeline.
const GUARANTEES: { risk: string; without: string; withVibex: string }[] = [
  {
    risk: "Builds that freeze halfway",
    without: "With other AI tools a single stuck model means an endless spinner — and the work so far is gone.",
    withVibex: "Vibex times out and recovers automatically. Your build always finishes with openable code.",
  },
  {
    risk: "Cookie-cutter, templated apps",
    without: "Most AI coders stop at a generic first draft that instantly reads as “AI-made.”",
    withVibex: "A Coder writes, a Reviewer checks, then an art-director AI redesigns it until it looks hand-built.",
  },
  {
    risk: "Vague questions, vague results",
    without: "Generic prompts give every idea the same shallow treatment — so you get something off.",
    withVibex: "Vibex asks sharp, idea-specific questions first, so it builds what you actually meant.",
  },
  {
    risk: "Exposed API keys",
    without: "Paste a key into the wrong tool and it can leak or get logged.",
    withVibex: "Your keys are encrypted (AES-256) and never leave the server or touch the browser.",
  },
  {
    risk: "Losing progress at a limit",
    without: "Hit a usage cap elsewhere and the run dies — you start over from scratch.",
    withVibex: "Vibex pauses on rolling windows and auto-resumes. You never lose progress.",
  },
];

// Testimonials — the section auto-hides while this is empty. Add REAL customer quotes only:
// shipping placeholder quotes to production is the fastest way to look AI-generated.
const TESTIMONIALS: { quote: string; name: string; role: string }[] = [];

// "Built with Vibex" — live proof beats testimonials for this product. Populate by dogfooding:
// run a real build, deploy it (one click), then add { title, idea, url, image? }. The section
// auto-hides while empty — never ship placeholders.
const SHOWCASE: { title: string; idea: string; url: string }[] = [];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE}/#org`, name: "Vibex", url: SITE, logo: `${SITE}/vibex-mark.svg` },
    { "@type": "WebSite", "@id": `${SITE}/#website`, url: SITE, name: "Vibex", publisher: { "@id": `${SITE}/#org` } },
    {
      "@type": "SoftwareApplication",
      name: "Vibex",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: SITE,
      description:
        "Vibex automates the entire vibe-coding loop — describe an idea once and it interviews you, locks the goal, then generates and runs every prompt until it's working code.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE}/#faq`,
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  // CSP nonce (middleware.ts) so the JSON-LD block passes the strict script-src on this route.
  const nonce = headers().get("x-nonce") ?? undefined;
  return (
    <>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <SiteHeader />

      <main className="wrap">
        <section className={styles.hero}>
          <div>
            <span className="eyebrow"><span className="dot" /> Automated vibe coding</span>
            <h1 className={styles.headline}>
              <span className={styles.lead}>You have the idea.</span>
              <span className={styles.pain}>Other AI coders stop at a rough draft.</span>
              <span className={styles.punch}>Vibex reviews every file until it runs.</span>
            </h1>
            <p className={styles.sub}>
              Describe it once. Vibex writes the prompts and a Reviewer AI checks every file — so you ship working code, not a rough draft.
            </p>
            <div className={styles.ctaRow}>
              <Link href="/new" className="btn btn-primary btn-lg">Build something →</Link>
              <a href="/#how" className="btn btn-ghost btn-lg">See how it works</a>
            </div>
            <p className={styles.note}><b>1 free project</b> — no prompt-writing, no babysitting. Interrupt anytime.</p>
            <ul className={styles.heroProof}>
              <li><span className={styles.proofIcon}>{ICONS.zap}</span> Builds always finish</li>
              <li><span className={styles.proofIcon}>{ICONS.loop}</span> Coder + Reviewer + design review</li>
              <li><span className={styles.proofIcon}>{ICONS.lock}</span> Keys encrypted</li>
            </ul>
          </div>

          {/* Cockpit live-run panel — the product is the hero (animation lands next) */}
          <CockpitPanel />
        </section>

        <div className={styles.trust}>
          <span className={styles.trustLabel}>Powered by</span>
          <b>Claude</b><span className={styles.sep} />
          <b>GPT-4o</b><span className={styles.sep} />
          <b>Gemini</b><span className={styles.sep} />
          <b>OpenRouter</b>
        </div>

        <Reveal>
          <section className={styles.how} id="how">
            <div className={styles.sectionHead}>
              <span className={styles.kicker}>How it works</span>
              <h2 className={styles.h2}>Three steps. Zero prompts.</h2>
              <p className={styles.h2sub}>From a sentence to running code, without you writing or babysitting a single prompt.</p>
            </div>
            <ol className={styles.steps}>
              {HOW.map((s) => (
                <li key={s.n} className={styles.step}>
                  <span className={styles.stepNum}>{s.n}</span>
                  <h3 className={styles.stepTitle}>{s.t}</h3>
                  <p className={styles.stepBody}>{s.d}</p>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        <Reveal>
          <section className={styles.features} id="features">
            <div className={styles.sectionHead}>
              <span className={styles.kicker}>What you get</span>
              <h2 className={styles.h2}>Everything to go from idea to shipped</h2>
            </div>
            <div className={styles.featIndex}>
              {FEATURES.map((f, i) => (
                <div key={f.t} className={styles.feat}>
                  <span className={styles.featNum} aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  <div className={styles.featMain}>
                    <div className={styles.featTop}>
                      <span className={styles.featIcon} aria-hidden>{ICONS[f.icon]}</span>
                      <h3 className={styles.featTitle}>{f.t}</h3>
                    </div>
                    <p className={styles.featBody}>{f.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className={styles.safeguards} id="guarantees">
            <div className={styles.sectionHead}>
              <span className={styles.kicker}>Built so it doesn&apos;t break</span>
              <h2 className={styles.h2}>What breaks other AI builders — handled here</h2>
              <p className={styles.h2sub}>Every build runs through the same safeguards, automatically. Here&apos;s what that saves you from.</p>
            </div>
            <BeforeAfter />
            <div className={styles.sgGrid}>
              {GUARANTEES.map((g) => (
                <div key={g.risk} className={styles.sgCard}>
                  <div className={styles.sgHead}>
                    <h3 className={styles.sgRisk}>{g.risk}</h3>
                  </div>
                  <p className={styles.sgLine}>
                    <span className={styles.sgTag} data-k="x">Elsewhere</span>
                    {g.without}
                  </p>
                  <p className={styles.sgLine}>
                    <span className={styles.sgTag} data-k="v">Vibex</span>
                    {g.withVibex}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {SHOWCASE.length > 0 && (
          <Reveal>
            <section className={styles.showcase} id="showcase">
              <div className={styles.sectionHead}>
                <span className={styles.kicker}>Built with Vibex</span>
                <h2 className={styles.h2}>Real builds, live on the internet</h2>
              </div>
              <div className={styles.showGrid}>
                {SHOWCASE.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className={styles.showItem}>
                    <span className={styles.showTitle}>{s.title} ↗</span>
                    <span className={styles.showIdea}>{s.idea}</span>
                  </a>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {TESTIMONIALS.length > 0 && (
          <Reveal>
            <section className={styles.testimonials} id="testimonials">
              <div className={styles.sectionHead}>
                <span className={styles.kicker}>Testimonials</span>
                <h2 className={styles.h2}>What builders say</h2>
              </div>
              <div className={styles.tGrid}>
                {TESTIMONIALS.map((t, i) => (
                  <figure key={i} className={styles.tCard}>
                    <blockquote className={styles.tQuote}>“{t.quote}”</blockquote>
                    <figcaption className={styles.tWho}>
                      <span className={styles.tAvatar} aria-hidden>{t.name.slice(0, 1)}</span>
                      <span className={styles.tMeta}>
                        <span className={styles.tName}>{t.name}</span>
                        <span className={styles.tRole}>{t.role}</span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        <Reveal>
          <section className={styles.pricing} id="pricing">
            <div className={styles.pricingHead}>
              <span className={styles.kicker}>Plans</span>
              <h2 className={styles.h2}>Simple, usage-based plans</h2>
              <p className={styles.h2sub}>
                Start free. Limits are <b>time-based rolling windows</b> — never credit top-ups — so a run
                auto-pauses and resumes, and you never lose progress.
              </p>
            </div>
            <PricingTable />
          </section>
        </Reveal>

        <Reveal>
          <section className={styles.faq} id="faq">
            <div className={styles.faqIntro}>
              <span className={styles.kicker}>FAQ</span>
              <h2 className={styles.h2}>Questions, answered</h2>
              <p className={styles.faqLead}>
                The short version: describe it once, get working, reviewed code. The details are here.
              </p>
              <Link href="/new" className={styles.faqCta}>Or just try it — one project is free →</Link>
            </div>
            <div className={styles.faqList}>
              {FAQS.map((f) => (
                <details key={f.q} className={styles.faqItem}>
                  <summary className={styles.faqQ}>
                    {f.q}
                    <span className={styles.faqMark} aria-hidden>+</span>
                  </summary>
                  <p className={styles.faqA}>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>

      </main>

      <SiteFooter />
    </>
  );
}
