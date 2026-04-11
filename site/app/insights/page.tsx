import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { EVAL_RUNS, ALL_DECISIONS, ALL_TASKS, ALL_PHASES, WORKFLOW_LABELS, type EvalRunRecord } from "@/lib/eval-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import selfEvalData from "@/data/self-eval.json";

export const metadata = {
  title: "Insights — structured data from GAD evals + self-evaluation",
  description: "Curated queries against eval traces, planning artifacts, and self-evaluation metrics. Every number has a source.",
};

/** Compute a query result at build time */
function query<T>(label: string, fn: () => T): { label: string; result: T } {
  return { label, result: fn() };
}

function buildInsights() {
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
      const best = completedRuns.reduce((a, b) =>
        (a.humanReview?.score ?? 0) > (b.humanReview?.score ?? 0) ? a : b, completedRuns[0]);
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
      return sorted[0] ? `Phase ${sorted[0].phase} (score: ${sorted[0].pressure_score}, ${sorted[0].tasks_total} tasks, ${sorted[0].crosscuts} crosscuts)` : "—";
    }),
    query("Bare vs GAD (best human scores)", () => {
      const bare = completedRuns.filter((r) => r.workflow === "bare").reduce((a, b) =>
        (a.humanReview?.score ?? 0) > (b.humanReview?.score ?? 0) ? a : b, completedRuns.find((r) => r.workflow === "bare")!);
      const gad = completedRuns.filter((r) => r.workflow === "gad").reduce((a, b) =>
        (a.humanReview?.score ?? 0) > (b.humanReview?.score ?? 0) ? a : b, completedRuns.find((r) => r.workflow === "gad")!);
      return `Bare: ${bare?.humanReview?.score?.toFixed(2) ?? "—"} | GAD: ${gad?.humanReview?.score?.toFixed(2) ?? "—"}`;
    }),
  ];
}

export default function InsightsPage() {
  const insights = buildInsights();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="section-shell">
        <p className="section-kicker">Insights</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Structured data from every eval, <span className="gradient-text">every session.</span>
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          Curated queries against eval traces, planning artifacts, and self-evaluation metrics.
          Every number on this page has a source — computed from TRACE.json, TASK-REGISTRY.xml,
          DECISIONS.xml, and .gad-log/ trace data at build time.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((q) => (
            <Card key={q.label}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase tracking-wider">{q.label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{String(q.result)}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-accent/40 bg-accent/5 p-6">
          <p className="section-kicker">Data sources</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs text-muted-foreground">
            <div>
              <Badge variant="outline">EVAL_RUNS</Badge>
              <p className="mt-1">{EVAL_RUNS.length} runs from evals/*/TRACE.json</p>
            </div>
            <div>
              <Badge variant="outline">ALL_DECISIONS</Badge>
              <p className="mt-1">{ALL_DECISIONS.length} decisions from DECISIONS.xml</p>
            </div>
            <div>
              <Badge variant="outline">ALL_TASKS</Badge>
              <p className="mt-1">{ALL_TASKS.length} tasks from TASK-REGISTRY.xml</p>
            </div>
            <div>
              <Badge variant="outline">self-eval.json</Badge>
              <p className="mt-1">{selfEvalData.latest.totals.events} trace events from .gad-log/</p>
            </div>
            <div>
              <Badge variant="outline">ALL_PHASES</Badge>
              <p className="mt-1">{ALL_PHASES.length} phases from ROADMAP.xml</p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
