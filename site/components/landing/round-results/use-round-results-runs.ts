import { useMemo } from "react";
import { EVAL_RUNS, isInterrupted } from "@/lib/eval-data";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";

export function useRoundResultsRuns(effectiveRound: string | null) {
  const displayRuns = useMemo(() => {
    let runs = EVAL_RUNS.filter((r) => r.humanReview?.score != null && !isInterrupted(r));

    if (effectiveRound) {
      runs = runs.filter((r) => roundForRun(r) === effectiveRound);
    }

    return runs.sort((a, b) => {
      if (a.project !== b.project) return a.project.localeCompare(b.project);
      const av = parseInt(a.version.slice(1), 10) || 0;
      const bv = parseInt(b.version.slice(1), 10) || 0;
      return av - bv;
    });
  }, [effectiveRound]);

  const tbdRuns = useMemo(() => {
    if (!effectiveRound) return [];
    return EVAL_RUNS.filter((r) => {
      const rRound = roundForRun(r);
      if (rRound !== effectiveRound) return false;
      if (isInterrupted(r)) return false;
      return r.humanReview?.score == null;
    });
  }, [effectiveRound]);

  return { displayRuns, tbdRuns };
}
