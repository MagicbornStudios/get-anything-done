import { EVAL_RUNS, type EvalRunRecord } from "@/lib/eval-data";

export const FREEDOM_PROJECT_ID = "escape-the-dungeon-bare";

export function bareRuns(): EvalRunRecord[] {
  return EVAL_RUNS.filter((r) => r.project === FREEDOM_PROJECT_ID).sort((a, b) => {
    const av = parseInt(a.version.slice(1), 10) || 0;
    const bv = parseInt(b.version.slice(1), 10) || 0;
    return av - bv;
  });
}
