import { EVAL_RUNS, isInterrupted, type Workflow } from "@/lib/eval-data";

export const RESULTS_REPO = "https://github.com/MagicbornStudios/get-anything-done";

export const RESULTS_WORKFLOW_TINT: Record<Workflow, string> = {
  gad: "border-l-sky-400/70",
  bare: "border-l-emerald-400/70",
  emergent: "border-l-amber-400/70",
};

// Only show runs that have human review AND weren't interrupted — decisions
// gad-63 (rate limit) and gad-64 (api overload) pin interrupted runs as
// archival-only, not comparison data.
export const RESULT_DISPLAY_RUNS = EVAL_RUNS.filter(
  (r) => r.humanReview?.score != null && !isInterrupted(r)
).sort((a, b) => {
  if (a.project !== b.project) return a.project.localeCompare(b.project);
  const av = parseInt(a.version.slice(1), 10) || 0;
  const bv = parseInt(b.version.slice(1), 10) || 0;
  return av - bv;
});
