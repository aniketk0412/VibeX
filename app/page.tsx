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

        <div className={styles.trust} id="how">
          <b>Claude · GPT-4o · Gemini</b><span className={styles.sep} />
          <b>Bring your own key, or use a Vibex plan</b><span className={styles.sep} />
          <b>Coder AI + Reviewer AI</b><span className={styles.sep} />
          <b>Live usage &amp; cost, always visible</b>
        </div>

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
      </main>

      <SiteFooter />
    </>
  );
}
