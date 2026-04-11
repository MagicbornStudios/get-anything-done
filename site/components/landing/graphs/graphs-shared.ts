import { EVAL_RUNS, isInterrupted, type Workflow } from "@/lib/eval-data";

export const WORKFLOW_COLOR: Record<Workflow, string> = {
  gad: "#38bdf8",
  bare: "#34d399",
  emergent: "#fbbf24",
};

export const GRAPHS_WORKFLOW_ORDER: Workflow[] = ["gad", "bare", "emergent"];

export type GraphsScatterPoint = {
  name: string;
  composite: number;
  human: number;
  workflow: Workflow;
  project: string;
  version: string;
};

export type GraphsBarRow = {
  name: string;
  score: number;
  workflow: Workflow;
};

export function runsWithScores(): GraphsScatterPoint[] {
  return EVAL_RUNS.filter(
    (r) => !isInterrupted(r) && r.scores.composite != null && r.humanReview?.score != null
  ).map((r) => ({
    name: `${r.project.replace("escape-the-dungeon", "etd")}/${r.version}`,
    composite: r.scores.composite!,
    human: r.humanReview!.score as number,
    workflow: r.workflow,
    project: r.project,
    version: r.version,
  }));
}

export function barData(): GraphsBarRow[] {
  return EVAL_RUNS.filter(
    (r) => !isInterrupted(r) && (r.humanReviewNormalized?.aggregate_score != null || r.humanReview?.score != null)
  )
    .map((r) => ({
      name: `${r.project.replace("escape-the-dungeon", "etd").replace("-", "\n")}/${r.version}`,
      score: r.humanReviewNormalized?.aggregate_score ?? r.humanReview?.score ?? 0,
      workflow: r.workflow,
    }))
    .sort((a, b) => b.score - a.score);
}
