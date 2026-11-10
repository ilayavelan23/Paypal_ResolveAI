import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Bot, Lock, MessagesSquare, RefreshCw, Scale, ShieldCheck, Workflow } from "lucide-react";
import heroImg from "@/assets/hero-laptop.jpg";
import botImg from "@/assets/resolve-bot.png";
import { BrandLockup } from "@/components/app/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PayPal ResolveAI — Resolve your PayPal payments with AI" },
      { name: "description", content: "An intelligent multi-agent assistant that explains transactions, detects risk, guides refunds and prepares disputes using verified PayPal Sandbox data." },
      { property: "og:title", content: "PayPal ResolveAI — Resolve your PayPal payments with AI" },
      { property: "og:description", content: "Multi-agent AI for payments, fraud checks, refunds and disputes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: MessagesSquare, title: "AI Assistance", body: "Instant, grounded answers about your payments." },
  { icon: ShieldCheck, title: "Fraud Detection", body: "Explainable risk rules — never black-box verdicts." },
  { icon: RefreshCw, title: "Refund Guidance", body: "Eligibility checks and confirmed refund actions." },
  { icon: Scale, title: "Dispute Support", body: "Case summaries and evidence checklists." },
];

const STEPS = [
  { icon: BadgeCheck, title: "Create & approve a Sandbox payment", body: "Orders v2 checkout with real buyer approval in PayPal Sandbox." },
  { icon: Workflow, title: "Coordinator routes your question", body: "Four specialist agents analyse verified records in parallel." },
  { icon: Bot, title: "Get one clear answer", body: "A unified recommendation that labels DEMO vs. SANDBOX data." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-landing text-sidebar-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
        <BrandLockup />
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex" aria-label="Landing">
          <a href="#features" className="hover:text-brand-sky">Features</a>
          <a href="#how" className="hover:text-brand-sky">How it Works</a>
          <a href="#security" className="hover:text-brand-sky">Security</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" search={{ mode: "signin" }} className="rounded-xl border border-sidebar-foreground/40 px-4 py-2 text-sm font-semibold hover:bg-sidebar-accent">
            Sign In
          </Link>
          <Link to="/auth" search={{ mode: "signup" }} className="hidden rounded-xl bg-sidebar-primary px-4 py-2 text-sm font-semibold text-sidebar-primary-foreground sm:inline-block">
            Get Started
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pt-6 pb-16 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
            Resolve Your PayPal Payments <span className="text-brand-sky">with AI</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-sidebar-foreground/85">
            An intelligent multi-agent assistant to analyze transactions, detect risks, guide refunds, and resolve disputes — faster and easier.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <f.icon className="h-7 w-7 text-brand-sky" aria-hidden />
                <p className="mt-2 text-sm font-semibold">{f.title}</p>
              </div>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-2 rounded-xl bg-sidebar-primary px-6 py-3 font-semibold text-sidebar-primary-foreground shadow-elevated">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/auth" search={{ mode: "signin" }} className="inline-flex items-center gap-2 rounded-xl border border-sidebar-foreground/40 px-6 py-3 font-semibold hover:bg-sidebar-accent">
              Sign in to the demo
            </Link>
          </div>
        </div>
        <img src={heroImg} alt="ResolveAI dashboard on a laptop with security and chat icons" width={1600} height={1104} className="w-full rounded-3xl" />
      </section>

      <section id="features" className="bg-background py-16 text-foreground">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-3xl font-extrabold tracking-tight">Four specialists, one coordinator</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">Each agent focuses on one job and only uses data you're authorized to see.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-5 shadow-card">
                <f.icon className="h-8 w-8 text-primary" aria-hidden />
                <h3 className="mt-3 font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="bg-background pb-16 text-foreground">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 lg:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">How it works</h2>
            <ol className="mt-6 grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl border bg-card p-5 shadow-card">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                  <h3 className="mt-3 font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <img src={botImg} alt="" width={1024} height={1024} loading="lazy" className="mx-auto h-56 w-56" />
        </div>
      </section>

      <section id="security" className="bg-navy py-16">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight"><Lock className="h-7 w-7 text-brand-sky" /> Built for trust</h2>
          <ul className="mt-6 grid gap-4 text-sidebar-foreground/90 sm:grid-cols-2 lg:grid-cols-4">
            <li className="rounded-2xl bg-sidebar-accent p-5">PayPal credentials stay on the server — never in your browser.</li>
            <li className="rounded-2xl bg-sidebar-accent p-5">Every record is labelled DEMO or verified PAYPAL SANDBOX.</li>
            <li className="rounded-2xl bg-sidebar-accent p-5">No refund or capture happens without your explicit confirmation.</li>
            <li className="rounded-2xl bg-sidebar-accent p-5">Per-user data isolation with row-level security.</li>
          </ul>
          <p className="mt-10 text-xs text-sidebar-muted">PayPal ResolveAI is an independent demo project and is not affiliated with or endorsed by PayPal. Sandbox mode only — no real money moves.</p>
        </div>
      </section>
    </div>
  );
}
