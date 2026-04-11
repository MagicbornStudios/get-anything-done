import { EVAL_PROJECTS, WORKFLOW_LABELS, type Workflow } from "@/lib/eval-data";

export const WORKFLOW_TINT: Record<Workflow, string> = {
  gad: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  bare: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  emergent: "bg-amber-500/15 text-amber-300 border-amber-500/40",
};

export function buildRubricExampleJson(
  dimensions: Array<{ key: string; weight: number }>
): string {
  const parts = dimensions.map((d) => `"${d.key}": 0.80`);
  return `{${parts.join(", ")}}`;
}

export function getProjectsWithRubric() {
  return EVAL_PROJECTS.filter(
    (p) => p.humanReviewRubric && p.humanReviewRubric.dimensions.length > 0
  );
}

export { WORKFLOW_LABELS };
