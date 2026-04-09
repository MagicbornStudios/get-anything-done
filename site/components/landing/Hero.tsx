import Link from "next/link";
import { ArrowRight, Gauge, Flame, Github, FileText, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EVAL_RUNS, PLAYABLE_INDEX, ALL_DECISIONS } from "@/lib/eval-data";

/**
 * Hero rewrite 2026-04-09 per decisions gad-74, gad-75, gad-76.
 *
 * New framing: "A system for evaluating and evolving agents through real
 * tasks, measurable pressure, and iteration." Primary audience is coding-agent
 * researchers (A); secondary is indie devs (C) who land via Play and stay
 * for the research transparency. Pressure is the new first-class concept.
 *
 * Primary CTA: Play an eval (B). Priority stack below: Methodology, Findings,
 * Hypothesis, Fork.
 */
export default function Hero() {
  const playableCount = Object.keys(PLAYABLE_INDEX).length;
  const runsScored = EVAL_RUNS.filter((r) => r.scores.composite != null).length;
  const decisionsLogged = ALL_DECISIONS.length;
  const currentRequirementsVersion = "v5";

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-50" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <div className="section-shell relative">
        <div className="max-w-3xl">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Badge variant="default" className="inline-flex items-center gap-1.5">
              <Flame size={11} aria-hidden />
              requirements {currentRequirementsVersion}
            </Badge>
            <Badge variant="outline">milestone gad-v1.1</Badge>
          </div>

          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            <span className="text-foreground">Evaluate and evolve agents</span>{" "}
            <span className="gradient-text">under measurable pressure.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
            <strong className="font-semibold text-foreground">Get Anything Done</strong> is a
            planning + evaluation framework for AI coding agents. We give agents real
            implementation tasks, measure the{" "}
            <Link
              href="/glossary#pressure-mechanics"
              className="cursor-help underline decoration-dotted decoration-accent/60 underline-offset-2 hover:decoration-accent hover:text-accent"
              title="Pressure = requirement complexity + ambiguity + constraint density + iteration budget + failure cost. Decision gad-75."
            >
              pressure
            </Link>{" "}
            the requirements apply, and score the outcome across rounds. The goal isn&apos;t
            to ship a framework for faster software — the goal is to find out what works,
            why, and under what conditions. Every decision lives in the repo.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {/* Primary CTA: Play (B) */}
            <a
              href="#play"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5"
            >
              <Gauge size={18} aria-hidden />
              Play an eval
              <ArrowRight size={16} aria-hidden />
            </a>

            {/* Secondary: Methodology (D) */}
            <Link
              href="/methodology"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <ClipboardCheck size={16} aria-hidden />
              Methodology
            </Link>

            {/* Tertiary: Latest findings (E) */}
            <Link
              href="/findings"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <FileText size={16} aria-hidden />
              Latest findings
            </Link>

            {/* Quaternary: Hypothesis (A) */}
            <Link
              href="/gad"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              The hypothesis
            </Link>

            {/* Quinary: Fork/GitHub (C) */}
            <a
              href="https://github.com/MagicbornStudios/get-anything-done"
              rel="noopener noreferrer"
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Github size={14} aria-hidden />
              Fork on GitHub
            </a>
          </div>

          <dl className="mt-14 grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-4">
            <Stat label="Playable runs" value={playableCount.toString()} />
            <Stat label="Runs scored" value={runsScored.toString()} />
            <Stat label="Decisions logged" value={decisionsLogged.toString()} />
            <Stat label="Requirements" value={currentRequirementsVersion} />
          </dl>

          <p className="mt-10 max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-[13px] leading-6 text-amber-200">
            <strong className="font-semibold text-amber-100">New this round:</strong>{" "}
            <Link
              href="/glossary#compound-skills-hypothesis"
              className="cursor-help underline decoration-dotted decoration-amber-300/60 underline-offset-2 hover:text-amber-100"
              title="CSH = compound-skills hypothesis"
            >
              CSH
            </Link>
            -testing via the Emergent workflow. Round 4&apos;s Emergent v4 scored{" "}
            <strong className="font-semibold text-amber-100">0.885</strong> after
            authoring two new skills and deprecating one — the first observed full
            skill-ratcheting cycle.{" "}
            <Link
              href="/emergent"
              className="underline decoration-amber-300 underline-offset-2 hover:text-amber-100"
            >
              See the evidence <ArrowRight size={11} className="inline" aria-hidden />
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
