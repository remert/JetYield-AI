import { ArrowRight, Gauge, MessageSquare, Plane, Sparkles, Upload, Wrench } from "lucide-react";
import Link from "next/link";
import { ScoreRing } from "@/components/kpis";
import { GithubIcon, Wordmark } from "@/components/logo";
import { generateSampleDataset } from "@/lib/data/generate";
import { todayISO } from "@/lib/dates";
import { computeAnalytics } from "@/lib/engine/analytics";
import { usd, usdCompact } from "@/lib/format";

// Re-render daily so the hero numbers track the rolling sample data.
export const revalidate = 86400;

const REPO_URL = "https://github.com/remert/JetYield-AI";

const FEATURES = [
  {
    icon: Gauge,
    title: "True all-in cost per hour",
    body: "Fixed, variable, and the depreciation most owners leave out. See what each hour really costs, and what a lower hourly rate actually saves.",
  },
  {
    icon: Plane,
    title: "Empty legs, priced and ranked",
    body: "Every repositioning leg on your schedule, priced from route demand and lead time, ranked by expected net to you.",
  },
  {
    icon: Sparkles,
    title: "Prioritized AI recommendations",
    body: "Claude reviews costs, utilization and maintenance, and turns them into this-week actions with dollar impact attached.",
  },
  {
    icon: MessageSquare,
    title: "Ask your aircraft anything",
    body: "\"How much would I save flying 50 more hours?\" The agent runs the scenario through the cost engine and answers with real math.",
  },
  {
    icon: Wrench,
    title: "Maintenance timing alerts",
    body: "Inspections projected from your flying pace, with downtime conflicts against upcoming trips.",
  },
  {
    icon: Upload,
    title: "Bring your own data",
    body: "Drop in flight logs, cost ledgers and maintenance CSVs. Validated row by row, analyzed instantly, kept in your browser.",
  },
];

export default function Home() {
  const today = todayISO();
  const cj3 = computeAnalytics(generateSampleDataset("cj3", today), today);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]"
        aria-hidden
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark height={44} />
        <nav className="flex items-center gap-1 text-sm">
          <a href={REPO_URL} className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-text-2 hover:text-text sm:inline-flex">
            <GithubIcon size={15} /> GitHub
          </a>
          <Link href="/dashboard" className="rounded-lg border border-border-strong bg-surface-2 px-3.5 py-2 text-text hover:bg-surface-3">
            Open demo
          </Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-12 pt-10 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden /> Yield optimization for private aircraft
            </p>
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Your jet costs more per hour than you think.
              <span className="text-accent"> JetYield finds the money.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-2">
              JetYield SI shows owners and small operators their true all-in cost per hour, prices the empty legs they&apos;re already flying,
              and turns flight, cost and maintenance data into prioritized actions that lower the cost of ownership.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-[#04121f] transition-colors hover:bg-[#63c8ff]"
              >
                Open the live demo <ArrowRight size={16} aria-hidden />
              </Link>
              <span className="text-sm text-muted">No signup. Three sample aircraft preloaded.</span>
            </div>
          </div>

          {/* Product preview built from the live engine output for the sample CJ3+ */}
          <div className="card relative p-5 shadow-2xl shadow-black/50">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="num text-sm font-semibold">N525JY</div>
                <div className="text-xs text-muted">Citation CJ3+ · KSDL · Part 91</div>
              </div>
              <ScoreRing score={cj3.yieldScore.score} size={60} />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { k: "True cost / hr", v: usd(cj3.allInCostPerHour), s: `operator quotes ${usd(cj3.variablePerHour)}` },
                { k: "Utilization", v: `${Math.round(cj3.annualizedHours)} hrs`, s: `${cj3.utilizationPct}% of ${cj3.targetHours} target` },
                { k: "Flown empty", v: `${Math.round(cj3.emptyLegShare * 100)}%`, s: `${Math.round(cj3.emptyHours)} unsold hrs` },
                { k: "Found per year", v: `+${usdCompact(cj3.improvement.total)}`, s: `${cj3.improvement.lines.length} levers identified` },
              ].map((x) => (
                <div key={x.k} className="rounded-xl border border-border bg-surface-2/60 p-3">
                  <div className="text-[11px] text-muted">{x.k}</div>
                  <div className="num mt-1 text-xl font-semibold">{x.v}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{x.s}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-accent/20 bg-accent/[0.06] p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-accent">
                <Sparkles size={13} aria-hidden /> Ask JetYield
              </div>
              <p className="text-text-2">
                <span className="text-text">&ldquo;How much would I save if I flew 50 more hours?&rdquo;</span> Cost per hour falls, but total spend
                rises unless those hours are charter. Here&apos;s the math…
              </p>
            </div>
          </div>
        </section>

        <section className="pb-20">
          <h2 className="mb-2 text-sm font-medium tracking-wider text-muted uppercase">What it does</h2>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-surface p-6">
                <Icon size={18} className="text-accent" aria-hidden />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-2">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-24">
          <div className="card flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">See it on three real-world scenarios</h2>
              <p className="mt-2 max-w-2xl text-text-2">
                An under-flown CJ3+, a managed Citation XLS+ flying charter, and an aging Hawker 800XP facing a major inspection. Switch between
                them and watch the economics change.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-[#04121f] hover:bg-[#63c8ff]"
            >
              Open the demo <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>JetYield SI · demo MVP. Aircraft, tails and figures are fictional sample data.</span>
          <a href={REPO_URL} className="hover:text-text">
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
