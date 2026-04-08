import { ArrowRight, Github, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-50" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <div className="section-shell relative">
        <div className="max-w-3xl">
          <Badge variant="default" className="mb-6">v1.1 — milestone in flight</Badge>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            <span className="text-foreground">Measure whether your</span>{" "}
            <span className="gradient-text">AI agent workflow</span>{" "}
            <span className="text-foreground">actually works.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
            <strong className="font-semibold text-foreground">Get Anything Done</strong> is a
            planning + evaluation framework for AI coding agents. We give agents real implementation
            tasks under three different workflow regimes — full framework, bare, emergent — and
            score the outcomes against human review. The goal isn&apos;t to ship a framework. The
            goal is to find out which framework, if any, beats &quot;just let the agent work.&quot;
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="https://github.com/MagicbornStudios/get-anything-done"
              rel="noopener noreferrer"
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5"
            >
              <Github size={18} aria-hidden />
              MagicbornStudios / get-anything-done
            </a>
            <a
              href="#results"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              See the round 3 results
              <ArrowRight size={16} aria-hidden />
            </a>
            <a
              href="#run"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Terminal size={16} aria-hidden />
              Run it locally
            </a>
          </div>

          <dl className="mt-14 grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { label: "Eval projects", value: "6" },
  { label: "Runs scored", value: "7" },
  { label: "Workflows tested", value: "3" },
  { label: "Decisions logged", value: "48" },
];
