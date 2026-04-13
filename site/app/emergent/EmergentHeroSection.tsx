import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Identified } from "@/components/devid/Identified";
import { SiteInlineMetric, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

type EmergentHeroSectionProps = {
  runsCount: number;
  playableCount: number;
  scoredCount: number;
  latestScore: number | null;
};

export function EmergentHeroSection({
  runsCount,
  playableCount,
  scoredCount,
  latestScore,
}: EmergentHeroSectionProps) {
  return (
    <SiteSection>
      <Identified as="EmergentHeroSection">
      <div className="mb-6 flex items-center gap-2">
        <Badge
          variant="default"
          className="inline-flex items-center gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-300"
        >
          <Sparkles size={11} aria-hidden />
          Compound-skills hypothesis
        </Badge>
      </div>
      <SiteSectionHeading
        kicker="Emergent"
        as="h1"
        preset="hero"
        title={
          <>
            Does a skill library <span className="gradient-text">compound in value</span> across rounds?
          </>
        }
      />
      <SiteProse className="mt-6">
        The emergent workflow runs with no framework but inherits a skill library from previous runs.
        It&apos;s allowed to evolve skills in place, author new ones, and deprecate wrong ones via a
        CHANGELOG. If the{" "}
        <Link
          href="/glossary#compound-skills-hypothesis"
          className="cursor-help underline decoration-dotted decoration-accent/60"
          title="CSH"
        >
          compound-skills hypothesis
        </Link>{" "}
        is real, each emergent round should produce measurably better results than the last as the
        inherited library accumulates craft. This page is the evidence rollup.
      </SiteProse>

      <SiteProse size="sm" className="mt-4">
        Anchor decisions:{" "}
        <Link href="/decisions#gad-65" className="text-accent underline decoration-dotted">
          gad-65
        </Link>{" "}
        (CSH pinned),{" "}
        <Link href="/decisions#gad-68" className="text-accent underline decoration-dotted">
          gad-68
        </Link>{" "}
        (emergent-evolution synthesis),{" "}
        <Link href="/decisions#gad-73" className="text-accent underline decoration-dotted">
          gad-73
        </Link>{" "}
        (fundamental skills triumvirate).
      </SiteProse>

      <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
        <SiteInlineMetric label="Emergent runs" value={runsCount.toString()} />
        <SiteInlineMetric label="Playable" value={playableCount.toString()} />
        <SiteInlineMetric label="Scored" value={scoredCount.toString()} />
        <SiteInlineMetric
          label="Latest score"
          value={latestScore != null ? latestScore.toFixed(3) : "—"}
        />
      </div>
      </Identified>
    </SiteSection>
  );
}
