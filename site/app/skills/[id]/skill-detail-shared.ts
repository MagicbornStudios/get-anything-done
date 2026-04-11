import { PRODUCED_ARTIFACTS, EVAL_RUNS } from "@/lib/eval-data";

export interface AuthoredByRun {
  project: string;
  version: string;
  humanScore: number | null;
}

/** Provenance: which eval runs authored a file matching this skill id. */
export function getAuthoredByRuns(skillId: string): AuthoredByRun[] {
  const authoredByRuns: AuthoredByRun[] = [];
  for (const [runKey, artifacts] of Object.entries(PRODUCED_ARTIFACTS)) {
    if (
      artifacts.skillFiles?.some(
        (f) =>
          f.name === `${skillId}.md` ||
          f.name === `${skillId}/SKILL.md` ||
          f.name.startsWith(`${skillId}-`)
      )
    ) {
      const [project, version] = runKey.split("/");
      const run = EVAL_RUNS.find((r) => r.project === project && r.version === version);
      authoredByRuns.push({
        project,
        version,
        humanScore: run?.humanReviewNormalized?.aggregate_score ?? run?.humanReview?.score ?? null,
      });
    }
  }
  return authoredByRuns;
}
