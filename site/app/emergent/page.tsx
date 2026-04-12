import Link from "next/link";
import { Sparkles, TrendingUp, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingShell, SiteInlineMetric, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { SkillLineageCard } from "@/components/emergent/SkillLineageCard";
import {
  EVAL_RUNS,
  PRODUCED_ARTIFACTS,
  PLAYABLE_INDEX,
  type EvalRunRecord,
} from "@/lib/eval-data";
import { EmergentScoredRunRow, emergentRunKey } from "./EmergentScoredRunRow";

export const metadata = {
  title: "Emergent — the compound-skills hypothesis",
  description:
    "Emergent is the eval workflow that inherits skills from previous runs, evolves them in place, and writes a CHANGELOG. This page rolls up every piece of evidence for the compound-skills hypothesis.",
};

const PROJECT_ID = "escape-the-dungeon-emergent";

function emergentRuns(): EvalRunRecord[] {
  return EVAL_RUNS.filter((r) => r.project === PROJECT_ID).sort((a, b) => {
    const av = parseInt(a.version.slice(1), 10) || 0;
    const bv = parseInt(b.version.slice(1), 10) || 0;
    return av - bv;
  });
}

export default function EmergentPage() {
  const runs = emergentRuns();
  const playableRuns = runs.filter((r) => PLAYABLE_INDEX[emergentRunKey(r)]);
  const scoredRuns = runs.filter(
    (r) =>
      r.humanReviewNormalized &&
      !r.humanReviewNormalized.is_empty &&
      r.humanReviewNormalized.aggregate_score != null,
  );

  const latestRun = runs[runs.length - 1];
  const latestScore = latestRun?.humanReviewNormalized?.aggregate_score ?? null;

  return (
    <MarketingShell>
      <SiteSection>
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
              Does a skill library <span className="gradient-text">compound in value</span> across
              rounds?
            </>
          }
        />
        <SiteProse className="mt-6">
          The emergent workflow runs with no framework but inherits a skill library from previous
          runs. It&apos;s allowed to evolve skills in place, author new ones, and deprecate wrong ones
          via a CHANGELOG. If the{" "}
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
          <SiteInlineMetric label="Emergent runs" value={runs.length.toString()} />
          <SiteInlineMetric label="Playable" value={playableRuns.length.toString()} />
          <SiteInlineMetric label="Scored" value={scoredRuns.length.toString()} />
          <SiteInlineMetric
            label="Latest score"
            value={latestScore != null ? latestScore.toFixed(3) : "—"}
          />
        </div>
      </SiteSection>

      <SiteSection tone="muted">
        <SiteSectionHeading
          icon={TrendingUp}
          kicker="CSH signal — human review across rounds"
          kickerRowClassName="mb-6 gap-3"
        />
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          If skills are compounding, the line goes up-and-to-the-right across rounds. The sixth
          rubric dimension,{" "}
          <code className="rounded bg-background/60 px-1 py-0.5">skill_inheritance_effectiveness</code>,
          is the CSH-specific signal (weight 0.20).
        </p>
        <div className="space-y-3">
          {scoredRuns.map((r) => (
            <EmergentScoredRunRow key={emergentRunKey(r)} run={r} />
          ))}
        </div>
        {scoredRuns.length < 2 && (
          <p className="mt-4 text-xs text-muted-foreground">
            Only {scoredRuns.length} scored run so far — not enough signal to claim the hypothesis is
            holding OR failing. Round 5 will be the first real trial against v5 requirements.
          </p>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground">
          <strong className="text-foreground">Data provenance:</strong> scores read from{" "}
          <code className="rounded bg-background/60 px-1 py-0.5">
            EVAL_RUNS[n].humanReviewNormalized.aggregate_score
          </code>
          , computed at prebuild from each run&apos;s rubric submission via{" "}
          <code className="rounded bg-background/60 px-1 py-0.5">gad eval review --rubric</code>.
        </p>
      </SiteSection>

      <SiteSection>
        <SiteSectionHeading icon={GitBranch} kicker="Skill lineage per run" kickerRowClassName="mb-6 gap-3" />
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          Every run&apos;s skill footprint — what it inherited from the previous run, what new skills
          it authored, what it deprecated. A healthy CSH signal looks like: inherited count goes up,
          authored count stays positive, deprecated count is non-zero (the agent is self-correcting),
          and CHANGELOG dispositions are recorded.
        </p>
        <div className="space-y-4">
          {runs.map((r) => {
            const artifacts = PRODUCED_ARTIFACTS[emergentRunKey(r)];
            const skillFiles = artifacts?.skillFiles ?? [];
            return (
              <SkillLineageCard
                key={emergentRunKey(r)}
                runKey={emergentRunKey(r)}
                version={r.version}
                date={r.date}
                playable={!!PLAYABLE_INDEX[emergentRunKey(r)]}
                projectHref={`/project-market`}
                runHref={`/runs/${r.project}/${r.version}`}
                skills={skillFiles.map((s) => ({
                  name: s.name,
                  bytes: s.bytes,
                  content: s.content ?? null,
                  file: s.file ?? null,
                }))}
              />
            );
          })}
        </div>
      </SiteSection>

      <SiteSection tone="muted">
        <SiteSectionHeading kicker="How emergent differs from bare and GAD" className="mb-6" />
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bare</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
              No framework, no inherited skills. Agent gets AGENTS.md + requirements and builds. Tests
              the freedom hypothesis directly.
            </CardContent>
          </Card>
          <Card className="border-l-4 border-amber-500/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-amber-200">Emergent</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
              No framework, but inherits skills from previous runs. Authors a CHANGELOG documenting
              disposition (kept / evolved / deprecated / replaced) of each inherited skill. Tests the
              CSH. See{" "}
              <Link href="/standards" className="text-accent underline decoration-dotted">
                /standards
              </Link>{" "}
              for the SKILL.md format these skills follow.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">GAD</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
              Full framework: .planning/ XML, plan/execute/verify/commit loop, skill triggers. Tests
              whether process discipline pays off despite overhead.
            </CardContent>
          </Card>
        </div>
      </SiteSection>
    </MarketingShell>
  );
}
