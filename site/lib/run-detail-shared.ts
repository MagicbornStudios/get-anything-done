export const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export type RunScores = {
  human_review?: number;
  requirement_coverage?: number;
  planning_quality?: number;
  per_task_discipline?: number;
  workflow_emergence?: number;
  implementation_quality?: number;
  iteration_evidence?: number;
  skill_accuracy?: number;
  time_efficiency?: number;
  composite?: number;
};

export const SCORE_ORDER: Array<[keyof RunScores, string]> = [
  ["human_review", "Human review"],
  ["requirement_coverage", "Requirement coverage"],
  ["planning_quality", "Planning quality"],
  ["per_task_discipline", "Per-task discipline"],
  ["workflow_emergence", "Workflow emergence"],
  ["implementation_quality", "Implementation quality"],
  ["iteration_evidence", "Iteration evidence"],
  ["skill_accuracy", "Skill accuracy"],
  ["time_efficiency", "Time efficiency"],
];

export function formatNum(n: number | undefined | null, digits = 3): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}
