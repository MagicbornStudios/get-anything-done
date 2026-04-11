import { ALL_DECISIONS, EVAL_RUNS, PLAYABLE_INDEX } from "@/lib/eval-data";

export const CURRENT_REQUIREMENTS_VERSION = "v5";

export function getHeroStats() {
  return {
    playableCount: Object.keys(PLAYABLE_INDEX).length,
    runsScored: EVAL_RUNS.filter((r) => r.scores.composite != null).length,
    decisionsLogged: ALL_DECISIONS.length,
    currentRequirementsVersion: CURRENT_REQUIREMENTS_VERSION,
  };
}
