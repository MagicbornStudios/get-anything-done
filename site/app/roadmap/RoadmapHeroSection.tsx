import Link from "next/link";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { EVAL_RUNS, ROUND_SUMMARIES } from "@/lib/eval-data";
import { FUTURE_ROUNDS } from "./roadmap-shared";

export default function RoadmapHeroSection() {
  const roundedRuns = EVAL_RUNS.length;

  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Roadmap"
        as="h1"
        preset="hero"
        title={
          <>
            Evolution by evolution, <span className="gradient-text">pressure climbs.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        Every round is defined by a{" "}
        <Link href="/requirements" className="text-accent underline decoration-dotted">
          requirements version
        </Link>
        . Requirements expand monotonically — v1 was 12 flat criteria, v5 is {"~"}40 criteria with
        cross-cutting pressure mechanics. This page shows what we asked, what the agents shipped, the
        honest shortcomings we documented, and how each round set up the next. Pressure rating per
        round is self-assessed (gad-75) until the pressure-score formula is programmatic.
      </SiteProse>
      <SiteProse size="sm" className="mt-4">
        Framework: decision{" "}
        <Link href="/decisions#gad-72" className="text-accent underline decoration-dotted">
          gad-72
        </Link>{" "}
        (rounds are requirements-versioned, progressively more complex, earlier rounds can be
        revisited with new hypotheses).
      </SiteProse>

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
          <span className="text-2xl font-semibold tabular-nums text-foreground">{roundedRuns}</span>{" "}
          runs preserved
        </div>
      </div>
    </SiteSection>
  );
}
