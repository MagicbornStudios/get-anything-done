import { ROUND_SUMMARIES, EVAL_RUNS, type RoundSummary } from "@/lib/eval-data";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";

export const ROUND_TINT: Record<string, string> = {
  "Round 1": "border-red-500/40",
  "Round 2": "border-amber-500/40",
  "Round 3": "border-sky-500/40",
  "Round 4": "border-emerald-500/40",
  "Round 5": "border-purple-500/40",
};

/** Unique project names that appear in any round */
export const ALL_PROJECTS = [...new Set(EVAL_RUNS.map((r) => r.project))].sort();

/** Unique hypothesis/workflow labels */
export const HYPOTHESES = [
  { id: "bare", label: "Freedom" },
  { id: "gad", label: "GAD framework" },
  { id: "emergent", label: "CSH" },
] as const;

/** All round labels from summaries */
export const ALL_ROUNDS = ROUND_SUMMARIES.map((s) => s.round);

/** Check if a round has runs matching project/hypothesis filters */
export function roundHasMatchingRuns(
  round: string,
  projectFilter: string | null,
  hypothesisFilter: string | null
): boolean {
  return EVAL_RUNS.some((r) => {
    const rRound = roundForRun(r);
    if (rRound !== round) return false;
    if (projectFilter && r.project !== projectFilter) return false;
    if (hypothesisFilter && r.workflow !== hypothesisFilter) return false;
    return true;
  });
}

/** Get runs for a specific round, optionally filtered */
export function runsForRound(
  round: string,
  projectFilter: string | null,
  hypothesisFilter: string | null
) {
  return EVAL_RUNS.filter((r) => {
    const rRound = roundForRun(r);
    if (rRound !== round) return false;
    if (projectFilter && r.project !== projectFilter) return false;
    if (hypothesisFilter && r.workflow !== hypothesisFilter) return false;
    return true;
  });
}

export function filterExperimentLogSummaries(
  summaries: RoundSummary[],
  opts: {
    globalRoundFilter: string | null;
    projectFilter: string | null;
    effectiveHypothesis: string | null;
    localSearchQuery: string;
  }
): RoundSummary[] {
  let result = summaries;

  if (opts.globalRoundFilter) {
    result = result.filter((s) => s.round === opts.globalRoundFilter);
  }

  if (opts.projectFilter || opts.effectiveHypothesis) {
    result = result.filter((s) =>
      roundHasMatchingRuns(s.round, opts.projectFilter, opts.effectiveHypothesis)
    );
  }

  if (opts.localSearchQuery.trim()) {
    const q = opts.localSearchQuery.trim().toLowerCase();
    result = result.filter(
      (s) =>
        s.round.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q)
    );
  }

  return result;
}
