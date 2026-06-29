import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CockpitPanel from "@/components/CockpitPanel";
import PricingTable from "@/components/PricingTable";
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
    a: "Yes — one free project lets you run the entire loop end to end, no card required.",
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

const FEATURES: { icon: string; t: string; d: string }[] = [
  { icon: "◑", t: "Two-AI build loop", d: "A Coder writes, a Reviewer verifies — every prompt, hands-free. You get working code, not a rough first draft." },
  { icon: "▷", t: "Live preview + in-app IDE", d: "Watch it run as it's built, then edit the code and read the console without leaving the page." },
  { icon: "⌘", t: "Bring your own key", d: "Anthropic, OpenAI, Gemini, or OpenRouter — its free models cost $0. Or run on a Vibex plan." },
  { icon: "⤓", t: "Your code, yours to keep", d: "A real file tree, a downloadable .zip, and one-click export to a fresh GitHub repo." },
  { icon: "⚡", t: "Ship in one click", d: "Deploy straight to Vercel or Netlify, or open the project in StackBlitz." },
  { icon: "⟳", t: "Limits that never burn you", d: "Time-based rolling windows auto-pause and resume — you never lose progress or a credit." },
];

const STATS: { v: string; l: string }[] = [
  { v: "0", l: "prompts to write" },
  { v: "2", l: "AIs: Coder + Reviewer" },
  { v: "3", l: "targets: web · API · CLI" },
  { v: "1", l: "free project, no card" },
];

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
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <SiteHeader />

      <main className="wrap">
        <section className={styles.hero}>
          <div>
            <span className="eyebrow"><span className="dot" /> Automated vibe coding</span>
            <h1 className={styles.headline}>
              <span className={styles.lead}>You have the idea.</span>
              <span className={styles.pain}>You hate writing 20 prompts manually.</span>
              <span className={styles.punch}>We do it for you.</span>
            </h1>
            <p className={styles.sub}>
              Describe it once. Vibex interviews you, locks the goal, then generates and runs every prompt until it&apos;s done.
            </p>
            <p className={styles.tag}>// from idea to code, automatically</p>
            <div className={styles.ctaRow}>
              <Link href="/new" className="btn btn-primary btn-lg">Build something →</Link>
              <button className="btn btn-ghost btn-lg" type="button">Watch a run</button>
            </div>
            <p className={styles.note}><b>1 free project</b> — no prompt-writing, no babysitting. Interrupt anytime.</p>
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

        <section className={styles.how} id="how">
          <div className={styles.sectionHead}>
            <span className="eyebrow"><span className="dot" /> How it works</span>
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

        <div className={styles.stats}>
          {STATS.map((s) => (
            <div key={s.l} className={styles.statCell}>
              <span className={styles.statV}>{s.v}</span>
              <span className={styles.statL}>{s.l}</span>
            </div>
          ))}
        </div>

        <section className={styles.features} id="features">
          <div className={styles.sectionHead}>
            <span className="eyebrow"><span className="dot" /> What you get</span>
            <h2 className={styles.h2}>Everything to go from idea to shipped</h2>
          </div>
          <div className={styles.featGrid}>
            {FEATURES.map((f) => (
              <div key={f.t} className={styles.feat}>
                <span className={styles.featIcon} aria-hidden>{f.icon}</span>
                <h3 className={styles.featTitle}>{f.t}</h3>
                <p className={styles.featBody}>{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.pricing} id="pricing">
          <div className={styles.pricingHead}>
            <span className="eyebrow"><span className="dot" /> Plans</span>
            <h2 className={styles.h2}>Simple, usage-based plans</h2>
            <p className={styles.h2sub}>
              Start free. Limits are <b>time-based rolling windows</b> — never credit top-ups — so a run
              auto-pauses and resumes, and you never lose progress.
            </p>
          </div>
          <PricingTable />
        </section>

        <section className={styles.faq} id="faq">
          <div className={styles.faqHead}>
            <span className="eyebrow"><span className="dot" /> FAQ</span>
            <h2 className={styles.h2}>Questions, answered</h2>
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

        <section className={styles.cta}>
          <h2 className={styles.ctaTitle}>Ready to stop writing prompts?</h2>
          <p className={styles.ctaSub}>Describe your idea once and watch Vibex build it — live, end to end.</p>
          <div className={styles.ctaRow}>
            <Link href="/new" className="btn btn-primary btn-lg">Build something →</Link>
            <Link href="/pricing" className="btn btn-ghost btn-lg">See plans</Link>
          </div>
          <p className={styles.note}><b>1 free project</b> — no card, interrupt anytime.</p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
