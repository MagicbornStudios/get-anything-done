import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { EVAL_RUNS, ALL_DECISIONS, ALL_TASKS, ALL_PHASES, WORKFLOW_LABELS } from "@/lib/eval-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import selfEvalData from "@/data/self-eval.json";

export const metadata = {
  title: "Insights — structured data from GAD evals + self-evaluation",
  description:
    "Curated queries against eval traces, planning artifacts, and self-evaluation metrics. Every number has a source.",
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

function buildDataSources() {
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

function InsightsPageIntro() {
  return (
    <header className="max-w-3xl">
      <p className="section-kicker">Insights</p>
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
        Structured data from every eval, <span className="gradient-text">every session.</span>
      </h1>
      <p className="mt-5 text-lg leading-8 text-muted-foreground">
        Curated queries against eval traces, planning artifacts, and self-evaluation metrics. Every
        number on this page has a source — computed from TRACE.json, TASK-REGISTRY.xml, DECISIONS.xml,
        and .gad-log/ trace data at build time.
      </p>
    </header>
  );
}

function InsightMetricCard({ label, value }: { label: string; value: unknown }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wider">{label}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <CardTitle className="text-2xl font-semibold tabular-nums leading-none">{String(value)}</CardTitle>
      </CardContent>
    </Card>
  );
}

export default function InsightsPage() {
  const insights = buildInsights();
  const dataSources = buildDataSources();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="section-shell">
        <InsightsPageIntro />

        <ul className="mt-12 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((q) => (
            <li key={q.label}>
              <InsightMetricCard label={q.label} value={q.result} />
            </li>
          ))}
        </ul>

        <Card className="mt-12 border-accent/40 bg-accent/5 shadow-none">
          <CardHeader className="pb-2">
            <p className="section-kicker !mb-0">Data sources</p>
          </CardHeader>
          <CardContent>
            <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dataSources.map((src) => (
                <li key={src.id} className="space-y-1.5">
                  <Badge variant="outline" className="font-mono text-[10px] normal-case tracking-normal">
                    {src.label}
                  </Badge>
                  <p className="text-xs leading-snug text-muted-foreground">{src.caption}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
