import { EVAL_RUNS, type EvalRunRecord } from "@/lib/eval-data";

export const EMERGENT_PROJECT_ID = "escape-the-dungeon-emergent";

export function emergentRuns(): EvalRunRecord[] {
  return EVAL_RUNS.filter((r) => r.project === EMERGENT_PROJECT_ID).sort((a, b) => {
    const av = parseInt(a.version.slice(1), 10) || 0;
    const bv = parseInt(b.version.slice(1), 10) || 0;
    return av - bv;
  });
}
