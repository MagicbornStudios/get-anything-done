import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import {
  EVAL_RUNS,
  PROJECT_LABELS,
  WORKFLOW_LABELS,
  findRun,
  playableUrl,
} from "@/lib/eval-data";

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

const SCORE_ORDER: Array<[keyof RunScores, string]> = [
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

type RunScores = {
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

export const dynamicParams = false;

export function generateStaticParams() {
  return EVAL_RUNS.map((r) => ({ project: r.project, version: r.version }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ project: string; version: string }>;
}) {
  const { project, version } = await params;
  const run = findRun(project, version);
  if (!run) return { title: "Not found" };
  return {
    title: `${project} ${version} — GAD eval run`,
    description: run.humanReview?.notes ?? `Eval trace for ${project} ${version}`,
  };
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent/60 via-accent to-accent/80"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function formatNum(n: number | undefined | null, digits = 3): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

export default async function RunPage({
  params,
}: {
  params: Promise<{ project: string; version: string }>;
}) {
  const { project, version } = await params;
  const run = findRun(project, version);
  if (!run) notFound();

  const playable = playableUrl(run);
  const composite = run.scores.composite ?? 0;
  const humanScore = run.humanReview?.score ?? null;
  // Only show a gate badge if the requirements version actually had gates
  // (v1/v2 predate the concept, so gate_failed is absent).
  const gateKnown = typeof run.requirementCoverage?.gate_failed === "boolean";
  // Divergence callout: mechanical composite >= 0.6 but human review <= 0.25.
  // Highlights runs where process metrics lie.
  const divergent = humanScore != null && composite >= 0.6 && humanScore <= 0.25;
  const dimensionScores = SCORE_ORDER.map(([key, label]) => ({
    key,
    label,
    value: (run.scores as RunScores)[key],
  })).filter((s) => s.value != null);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <section className="border-b border-border/60">
        <div className="section-shell">
          <Link
            href="/#results"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} aria-hidden />
            Back to results
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="default">{WORKFLOW_LABELS[run.workflow]}</Badge>
            <Badge variant="outline">{run.version}</Badge>
            <Badge variant="outline">requirements {run.requirementsVersion}</Badge>
            <Badge variant="outline">{run.date}</Badge>
            {gateKnown ? (
              run.requirementCoverage!.gate_failed ? (
                <Badge variant="danger">Gate failed</Badge>
              ) : (
                <Badge variant="success">Gate passed</Badge>
              )
            ) : (
              <Badge variant="outline">pre-gate requirements</Badge>
            )}
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
            {PROJECT_LABELS[run.project] ?? run.project}
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {run.project}/{run.version}
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Composite score
                  </p>
                  <p className="mt-1 text-6xl font-semibold tabular-nums gradient-text">
                    {formatNum(composite)}
                  </p>
                  <div className="mt-3">
                    <ScoreBar value={composite} />
                  </div>
                </div>
                {humanScore != null && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Human review
                    </p>
                    <p
                      className={`mt-1 text-6xl font-semibold tabular-nums ${
                        humanScore >= 0.5 ? "text-emerald-400" : humanScore >= 0.25 ? "text-amber-400" : "text-red-400"
                      }`}
                    >
                      {humanScore.toFixed(2)}
                    </p>
                    <div className="mt-3">
                      <ScoreBar value={humanScore} />
                    </div>
                  </div>
                )}
              </div>

              {divergent && (
                <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/5 p-5">
                  <p className="text-xs uppercase tracking-wider text-red-400">
                    Process metrics diverged from reality
                  </p>
                  <p className="mt-2 text-base leading-7 text-foreground">
                    This run scored <strong>{formatNum(composite)}</strong> on the composite formula
                    (requirement coverage, planning quality, commit discipline, skill accuracy, time
                    efficiency) but a human reviewer rated the actual artifact{" "}
                    <strong>{humanScore!.toFixed(2)}</strong> out of 1.0. This is exactly the failure
                    mode that prompted gad-29 (&quot;process metrics do not guarantee output
                    quality&quot;) and the move to weight human review at 30%.
                  </p>
                </div>
              )}

              {run.humanReview?.notes && (
                <div className="mt-6 rounded-2xl border border-border/70 bg-card/40 p-5">
                  <p className="text-xs uppercase tracking-wider text-accent">Human review note</p>
                  <p className="mt-2 text-base leading-7 text-foreground">
                    {run.humanReview.notes}
                  </p>
                  {run.humanReview.reviewed_by && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Reviewed by {run.humanReview.reviewed_by}
                      {run.humanReview.reviewed_at
                        ? ` · ${String(run.humanReview.reviewed_at).slice(0, 10)}`
                        : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {playable && (
                <a
                  href={playable}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5"
                >
                  <Gamepad2 size={16} aria-hidden />
                  Play this build
                </a>
              )}
              <a
                href={`${REPO}/tree/main/evals/${run.project}/${run.version}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <ExternalLink size={14} aria-hidden />
                Source on GitHub
              </a>
              <a
                href={`${REPO}/blob/main/evals/${run.project}/${run.version}/TRACE.json`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <ExternalLink size={14} aria-hidden />
                Raw TRACE.json
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Dimension scores</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Where the composite came from
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Each dimension is scored 0.0 – 1.0 and combined using the weights in
            <code className="mx-1 rounded bg-card/60 px-1.5 py-0.5 text-sm">evals/{run.project}/gad.json</code>.
            Human review dominates on purpose — process metrics alone can&apos;t rescue a broken run.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Dimension</th>
                  <th className="px-5 py-3 font-medium tabular-nums">Score</th>
                  <th className="px-5 py-3">Bar</th>
                </tr>
              </thead>
              <tbody>
                {dimensionScores.map((row, idx) => (
                  <tr
                    key={row.key}
                    className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                  >
                    <td className="px-5 py-3 font-medium text-foreground">{row.label}</td>
                    <td className="px-5 py-3 tabular-nums text-accent">{formatNum(row.value, 3)}</td>
                    <td className="px-5 py-3">
                      <div className="max-w-xs">
                        <ScoreBar value={row.value ?? 0} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {run.requirementCoverage && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="section-kicker">Gate report</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Requirement coverage
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total criteria</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">
                    {run.requirementCoverage.total_criteria ?? "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Fully met</CardDescription>
                  <CardTitle className="text-3xl tabular-nums text-emerald-400">
                    {run.requirementCoverage.fully_met ?? 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Partially met</CardDescription>
                  <CardTitle className="text-3xl tabular-nums text-amber-400">
                    {run.requirementCoverage.partially_met ?? 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Not met</CardDescription>
                  <CardTitle className="text-3xl tabular-nums text-red-400">
                    {run.requirementCoverage.not_met ?? 0}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
            {run.requirementCoverage.gate_notes && (
              <div className="mt-6 rounded-2xl border border-border/70 bg-card/40 p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Reviewer notes on gates
                </p>
                <p className="mt-2 text-base leading-7 text-foreground">
                  {run.requirementCoverage.gate_notes}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Process metrics</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            How the agent actually worked
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {run.timing && (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Wall clock</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">
                    {run.timing.duration_minutes != null ? `${run.timing.duration_minutes}m` : "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {run.timing.phases_completed ?? 0} phases · {run.timing.tasks_completed ?? 0} tasks
                </CardContent>
              </Card>
            )}
            {run.tokenUsage && (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Tool uses</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">
                    {run.tokenUsage.tool_uses ?? "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {run.tokenUsage.total_tokens != null
                    ? `${run.tokenUsage.total_tokens.toLocaleString()} tokens`
                    : ""}
                  {run.tokenUsage.note ? ` · ${run.tokenUsage.note}` : ""}
                </CardContent>
              </Card>
            )}
            {run.gitAnalysis && (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Commits</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">
                    {run.gitAnalysis.total_commits ?? 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {run.gitAnalysis.task_id_commits ?? 0} with task id ·{" "}
                  {run.gitAnalysis.batch_commits ?? 0} batch
                </CardContent>
              </Card>
            )}
            {run.planningQuality && (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Planning docs</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">
                    {run.planningQuality.decisions_captured ?? 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  decisions captured · {run.planningQuality.phases_planned ?? 0} phases planned
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
