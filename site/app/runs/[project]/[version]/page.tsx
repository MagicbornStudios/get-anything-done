import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/site";
import { type RubricDimension } from "@/components/charts/RubricRadar";
import { compositionsForRun } from "@/remotion/registry";
import {
  EVAL_PROJECTS,
  EVAL_RUNS,
  PRODUCED_ARTIFACTS,
  findRun,
  isApiInterrupted,
  isRateLimited,
  playableUrl,
} from "@/lib/eval-data";
import { RunCompositeFormulaSection } from "@/app/runs/[project]/[version]/RunCompositeFormulaSection";
import { RunDimensionScoresSection } from "@/app/runs/[project]/[version]/RunDimensionScoresSection";
import { RunGateReportSection } from "@/app/runs/[project]/[version]/RunGateReportSection";
import { RunHeroSection } from "@/app/runs/[project]/[version]/RunHeroSection";
import { RunProcessMetricsSection } from "@/app/runs/[project]/[version]/RunProcessMetricsSection";
import { RunProducedArtifactsSection } from "@/app/runs/[project]/[version]/RunProducedArtifactsSection";
import { RunRubricSection } from "@/app/runs/[project]/[version]/RunRubricSection";
import { RunSkillAccuracySection } from "@/app/runs/[project]/[version]/RunSkillAccuracySection";
import { RunSkillProvenanceSection } from "@/app/runs/[project]/[version]/RunSkillProvenanceSection";
import { RunVideosSection } from "@/app/runs/[project]/[version]/RunVideosSection";
import { SCORE_ORDER, type RunScores } from "@/app/runs/[project]/[version]/run-detail-shared";

export const dynamicParams = false;

export function generateStaticParams() {
  return EVAL_RUNS.map((r) => ({ project: r.project, version: r.version }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ project: string; version: string }>;
}) {
  const { project, version } = await params;
  const run = findRun(project, version);
  if (!run) return { title: "Not found" };
  return {
    title: `${project} ${version} — GAD eval run`,
    description: run.humanReview?.notes ?? `Eval trace for ${project} ${version}`,
  };
}

export default async function RunPage({
  params,
}: {
  params: Promise<{ project: string; version: string }>;
}) {
  const { project, version } = await params;
  const run = findRun(project, version);
  if (!run) notFound();

  const playable = playableUrl(run);
  const composite = run.scores.composite ?? 0;
  const humanScore = run.humanReview?.score ?? null;
  const gateKnown = typeof run.requirementCoverage?.gate_failed === "boolean";
  const divergent = humanScore != null && composite >= 0.6 && humanScore <= 0.25;
  const dimensionScores = SCORE_ORDER.map(([key, label]) => ({
    key,
    label,
    value: (run.scores as RunScores)[key],
  })).filter((s) => s.value != null);

  const projectMeta = EVAL_PROJECTS.find((p) => p.id === run.project);
  const weights = projectMeta?.scoringWeights ?? null;
  const contributions = weights
    ? Object.entries(weights)
        .map(([dim, weight]) => {
          const raw = (run.scores as Record<string, number | null | undefined>)[dim];
          const value = typeof raw === "number" ? raw : 0;
          return {
            dimension: dim,
            weight,
            value,
            contribution: value * weight,
          };
        })
        .sort((a, b) => b.contribution - a.contribution)
    : [];
  const weightedSum = contributions.reduce((acc, c) => acc + c.contribution, 0);

  const skillAccuracyValue =
    typeof run.scores.skill_accuracy === "number" ? run.scores.skill_accuracy : null;
  const tracingGap = skillAccuracyValue != null && skillAccuracyValue < 1;

  const produced = PRODUCED_ARTIFACTS[`${run.project}/${run.version}`];
  const videos = compositionsForRun(run.project, run.version);

  const rubric = run.humanReviewNormalized;
  const projectMetaForRubric = EVAL_PROJECTS.find((p) => p.id === run.project);
  const rubricDef = projectMetaForRubric?.humanReviewRubric;
  const rubricDimensions: RubricDimension[] =
    !rubric?.is_legacy && !rubric?.is_empty && rubricDef?.dimensions
      ? rubricDef.dimensions.map((d) => ({
          key: d.key,
          label: d.label,
          score: rubric.dimensions[d.key]?.score ?? null,
        }))
      : [];
  const hasRubricScores =
    rubricDimensions.length >= 3 && rubricDimensions.some((d) => d.score != null);
  const rateLimited = isRateLimited(run);
  const apiInterrupted = isApiInterrupted(run);
  const rateLimitNote =
    rateLimited && run.timing
      ? ((run.timing as Record<string, unknown>).rate_limit_note as string | undefined) ?? null
      : null;
  const interruptionNote =
    apiInterrupted && run.timing
      ? ((run.timing as Record<string, unknown>).interruption_note as string | undefined) ?? null
      : null;

  return (
    <MarketingShell>
      <RunHeroSection
        run={run}
        playable={playable}
        composite={composite}
        humanScore={humanScore}
        gateKnown={gateKnown}
        divergent={divergent}
        rateLimited={rateLimited}
        apiInterrupted={apiInterrupted}
        rateLimitNote={rateLimitNote}
        interruptionNote={interruptionNote}
      />
      <RunDimensionScoresSection run={run} dimensionScores={dimensionScores} />
      {weights && contributions.length > 0 && (
        <RunCompositeFormulaSection
          run={run}
          composite={composite}
          contributions={contributions}
          weightedSum={weightedSum}
        />
      )}
      <RunSkillAccuracySection
        run={run}
        tracingGap={tracingGap}
        skillAccuracyValue={skillAccuracyValue}
      />
      <RunSkillProvenanceSection run={run} />
      {hasRubricScores && rubricDef && (
        <RunRubricSection
          run={run}
          rubricDimensions={rubricDimensions}
          rubricDef={rubricDef}
          rubric={rubric}
        />
      )}
      <RunVideosSection videos={videos} />
      {produced && <RunProducedArtifactsSection produced={produced} />}
      <RunGateReportSection run={run} />
      <RunProcessMetricsSection run={run} />
    </MarketingShell>
  );
}
