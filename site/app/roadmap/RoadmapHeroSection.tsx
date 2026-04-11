import Link from "next/link";
import { EVAL_RUNS, ROUND_SUMMARIES } from "@/lib/eval-data";
import { FUTURE_ROUNDS } from "./roadmap-shared";

export default function RoadmapHeroSection() {
  const roundedRuns = EVAL_RUNS.length;

  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Roadmap</p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
          Round by round,{" "}
          <span className="gradient-text">pressure climbs.</span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          Every round is defined by a{" "}
          <Link href="/requirements" className="text-accent underline decoration-dotted">
            requirements version
          </Link>
          . Requirements expand monotonically — v1 was 12 flat criteria, v5 is{" "}
          {"~"}40 criteria with cross-cutting pressure mechanics. This page shows what we
          asked, what the agents shipped, the honest shortcomings we documented, and how
          each round set up the next. Pressure rating per round is self-assessed (gad-75)
          until the pressure-score formula is programmatic.
        </p>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          Framework: decision{" "}
          <Link href="/decisions#gad-72" className="text-accent underline decoration-dotted">
            gad-72
          </Link>{" "}
          (rounds are requirements-versioned, progressively more complex, earlier rounds
          can be revisited with new hypotheses).
        </p>

        <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {ROUND_SUMMARIES.length}
            </span>{" "}
            rounds run
          </div>
          <div>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {FUTURE_ROUNDS.length}
            </span>{" "}
            rounds planned
          </div>
          <div>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {roundedRuns}
            </span>{" "}
            runs preserved
          </div>
        </div>
      </div>
    </section>
  );
}
