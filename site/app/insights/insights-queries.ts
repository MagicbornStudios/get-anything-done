import { EVAL_RUNS, ALL_DECISIONS, ALL_TASKS, ALL_PHASES, WORKFLOW_LABELS } from "@/lib/eval-data";
import selfEvalData from "@/data/self-eval.json";

/** Compute a query result at build time */
export function query<T>(label: string, fn: () => T): { label: string; result: T } {
  return { label, result: fn() };
}

export function buildInsights() {
  const selfEval = selfEvalData.latest;
  const completedRuns = EVAL_RUNS.filter((r) => r.humanReview?.score != null);
  const allRuns = EVAL_RUNS;

  return [
    query("Total eval runs", () => allRuns.length),
    query("Runs with human review", () => completedRuns.length),
    query("Average human review score", () => {
      const scores = completedRuns.map((r) => r.humanReview?.score ?? 0);
      return scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3) : "—";
    }),
    query("Best human review score", () => {
      const best = completedRuns.reduce(
        (a, b) => ((a.humanReview?.score ?? 0) > (b.humanReview?.score ?? 0) ? a : b),
        completedRuns[0]
      );
      return best ? `${(best.humanReview?.score ?? 0).toFixed(2)} (${best.project} ${best.version})` : "—";
    }),
    query("Eval projects", () => {
      const projects = new Set(allRuns.map((r) => r.project));
      return projects.size;
    }),
    query("Workflows tested", () => {
      const wf = new Set(allRuns.map((r) => r.workflow));
      return [...wf].map((w) => WORKFLOW_LABELS[w] || w).join(", ");
    }),
    query("Total decisions", () => ALL_DECISIONS.length),
    query("Total tasks", () => ALL_TASKS.length),
    query("Tasks done", () => ALL_TASKS.filter((t) => t.status === "done").length),
    query("Total phases", () => ALL_PHASES.length),
    query("Phases done", () => ALL_PHASES.filter((p) => p.status === "done").length),
    query("Framework overhead", () => `${(selfEval.framework_overhead.ratio * 100).toFixed(1)}%`),
    query("Loop compliance", () => `${(selfEval.loop_compliance.score * 100).toFixed(0)}%`),
    query("Trace events captured", () => selfEval.totals.events.toLocaleString()),
    query("GAD CLI calls", () => selfEval.totals.gad_cli_calls),
    query("Highest pressure phase", () => {
      const sorted = [...selfEval.phases_pressure].sort((a, b) => b.pressure_score - a.pressure_score);
      return sorted[0]
        ? `Phase ${sorted[0].phase} (score: ${sorted[0].pressure_score}, ${sorted[0].tasks_total} tasks, ${sorted[0].crosscuts} crosscuts)`
        : "—";
    }),
    query("Bare vs GAD (best human scores)", () => {
      const bare = completedRuns
        .filter((r) => r.workflow === "bare")
        .reduce(
          (a, b) => ((a.humanReview?.score ?? 0) > (b.humanReview?.score ?? 0) ? a : b),
          completedRuns.find((r) => r.workflow === "bare")!
        );
      const gad = completedRuns
        .filter((r) => r.workflow === "gad")
        .reduce(
          (a, b) => ((a.humanReview?.score ?? 0) > (b.humanReview?.score ?? 0) ? a : b),
          completedRuns.find((r) => r.workflow === "gad")!
        );
      return `Bare: ${bare?.humanReview?.score?.toFixed(2) ?? "—"} | GAD: ${gad?.humanReview?.score?.toFixed(2) ?? "—"}`;
    }),
  ];
}

export type InsightDataSource = ReturnType<typeof buildDataSources>[number];

export function buildDataSources() {
  return [
    { id: "eval-runs", label: "EVAL_RUNS", caption: `${EVAL_RUNS.length} runs from evals/*/TRACE.json` },
    { id: "decisions", label: "ALL_DECISIONS", caption: `${ALL_DECISIONS.length} decisions from DECISIONS.xml` },
    { id: "tasks", label: "ALL_TASKS", caption: `${ALL_TASKS.length} tasks from TASK-REGISTRY.xml` },
    {
      id: "self-eval",
      label: "self-eval.json",
      caption: `${selfEvalData.latest.totals.events.toLocaleString()} trace events from .gad-log/`,
    },
    { id: "phases", label: "ALL_PHASES", caption: `${ALL_PHASES.length} phases from ROADMAP.xml` },
  ] as const;
}
