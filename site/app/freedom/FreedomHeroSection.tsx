import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SiteInlineMetric, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { Ref } from "@/components/refs/Ref";
import type { EvalRunRecord } from "@/lib/eval-data";
import { freedomRunScore } from "./FreedomScoreRow";

type FreedomHeroSectionProps = {
  runs: EvalRunRecord[];
  playableCount: number;
  scoredCount: number;
  latest: EvalRunRecord | undefined;
};

export function FreedomHeroSection({
  runs,
  playableCount,
  scoredCount,
  latest,
}: FreedomHeroSectionProps) {
  return (
    <SiteSection>
      <div className="mb-6 flex items-center gap-2">
        <Badge
          variant="default"
          className="inline-flex items-center gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
        >
          Freedom hypothesis
        </Badge>
      </div>
      <SiteSectionHeading
        kicker="Freedom"
        as="h1"
        preset="hero"
        title={
          <>
            Less framework, <span className="gradient-text">better output?</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        The freedom hypothesis (<Ref id="gad-36" />) emerged from round 3: the{" "}
        <Link
          href="/glossary#bare-workflow"
          className="cursor-help underline decoration-dotted decoration-accent/60"
          title="Bare workflow"
        >
          bare condition
        </Link>{" "}
        — no framework, no inherited skills, just AGENTS.md + requirements — kept outscoring the full
        GAD condition on human review. Bare has improved monotonically across rounds. GAD never exceeded
        0.30. This page rolls up the evidence, the caveats, and a hard link to the{" "}
        <Link href="/skeptic#freedom" className="text-rose-300 underline decoration-dotted">
          skeptic critique
        </Link>{" "}
        — read that too before trusting the pattern.
      </SiteProse>

      <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
        <SiteInlineMetric label="Bare runs" value={runs.length.toString()} />
        <SiteInlineMetric label="Playable" value={playableCount.toString()} />
        <SiteInlineMetric label="Scored" value={scoredCount.toString()} />
        <SiteInlineMetric
          label="Latest score"
          value={latest ? freedomRunScore(latest).toFixed(3) : "—"}
        />
      </div>
    </SiteSection>
  );
}
