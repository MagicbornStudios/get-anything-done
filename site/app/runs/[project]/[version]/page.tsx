import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, ExternalLink, Film, Gamepad2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import VideoEmbed from "@/components/video/VideoEmbed";
import { compositionsForRun } from "@/remotion/registry";
import {
  EVAL_PROJECTS,
  EVAL_RUNS,
  PRODUCED_ARTIFACTS,
  PROJECT_LABELS,
  WORKFLOW_LABELS,
  findRun,
  isRateLimited,
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
  const gateKnown = typeof run.requirementCoverage?.gate_failed === "boolean";
  const divergent = humanScore != null && composite >= 0.6 && humanScore <= 0.25;
  const dimensionScores = SCORE_ORDER.map(([key, label]) => ({
    key,
    label,
    value: (run.scores as RunScores)[key],
  })).filter((s) => s.value != null);

  // Scoring weights for this project (from gad.json). Used for the composite
  // formula breakdown. Falls back to the "default" weights most implementation
  // evals use if the project hasn't emitted a gad.json (shouldn't happen).
  const projectMeta = EVAL_PROJECTS.find((p) => p.id === run.project);
  const weights = projectMeta?.scoringWeights ?? null;
  // Per-dimension contribution to the composite: score * weight.
  const contributions = weights
    ? Object.entries(weights)
        .map(([dim, weight]) => {
          const raw = (run.scores as Record<string, number | null | undefined>)[dim];
          const value = typeof raw === "number" ? raw : 0;
          return {
            dimension: dim,
            weight,
            value,
            contribution: value * weight,
          };
        })
        .sort((a, b) => b.contribution - a.contribution)
    : [];
  const weightedSum = contributions.reduce((acc, c) => acc + c.contribution, 0);

  // Raw TRACE.json may store skill_accuracy as either a bare number OR an
  // object with expected_triggers + accuracy. We read the object form via the
  // un-normalised path if it exists — the normaliser collapsed it to a number
  // in `scores`, but the richer shape may be available on the raw record
  // via the runtime JSON (not exposed here yet, punt to phase 25). For now:
  // detect the gap by seeing if the run has the bare number and no breakdown.
  const skillAccuracyValue =
    typeof run.scores.skill_accuracy === "number" ? run.scores.skill_accuracy : null;
  const tracingGap = skillAccuracyValue != null && skillAccuracyValue < 1;

  const produced = PRODUCED_ARTIFACTS[`${run.project}/${run.version}`];
  const videos = compositionsForRun(run.project, run.version);
  const rateLimited = isRateLimited(run);
  const rateLimitNote =
    rateLimited && run.timing
      ? ((run.timing as Record<string, unknown>).rate_limit_note as string | undefined) ?? null
      : null;

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
            {rateLimited && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-300">
                ⚠ rate limited — not comparable
              </Badge>
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

              {rateLimited && (
                <div className="mt-6 rounded-2xl border border-amber-500/50 bg-amber-500/5 p-5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-400" aria-hidden />
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                      Rate-limited run · excluded from cross-round comparisons
                    </p>
                  </div>
                  <p className="mt-2 text-base leading-7 text-foreground">
                    This run hit an account-level rate limit before completing. The data
                    captured here reflects partial progress only — it is <strong>not</strong>{" "}
                    included in the freedom-hypothesis scatter, the Results card grid, or any
                    aggregate comparison on the site (decision gad-63). Preserved here as a
                    data point for planning-differential analysis and honest documentation.
                  </p>
                  {rateLimitNote && (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      <strong>Details:</strong> {rateLimitNote}
                    </p>
                  )}
                  <Link
                    href="/findings/2026-04-09-round-4-partial"
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                  >
                    Full round 4 partial-results finding →
                  </Link>
                </div>
              )}

              {divergent && !rateLimited && (
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
            Each dimension is scored 0.0 – 1.0 and combined using the weights in{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">
              evals/{run.project}/gad.json
            </code>
            . Human review dominates on purpose — process metrics alone can&apos;t rescue a broken run.
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

      {weights && contributions.length > 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="section-kicker">Composite formula</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              How {formatNum(composite)} was calculated
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              The composite score is a weighted sum of the dimensions above. Weights come from{" "}
              <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">
                evals/{run.project}/gad.json
              </code>
              . Contribution = score × weight; dimensions sorted by contribution so you can see
              what actually moved the needle.
            </p>

            <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Dimension</th>
                    <th className="px-5 py-3 font-medium tabular-nums">Weight</th>
                    <th className="px-5 py-3 font-medium tabular-nums">Score</th>
                    <th className="px-5 py-3 font-medium tabular-nums">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c, idx) => {
                    const pctOfComposite =
                      weightedSum > 0 ? (c.contribution / weightedSum) * 100 : 0;
                    return (
                      <tr
                        key={c.dimension}
                        className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                      >
                        <td className="px-5 py-3 font-mono text-[11px] text-foreground">
                          {c.dimension}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-muted-foreground">
                          {c.weight.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-muted-foreground">
                          {c.value.toFixed(3)}
                        </td>
                        <td className="px-5 py-3 tabular-nums">
                          <span className="font-semibold text-accent">
                            {c.contribution.toFixed(4)}
                          </span>
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            ({pctOfComposite.toFixed(0)}%)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-border/70 bg-background/40">
                    <td className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Weighted sum
                    </td>
                    <td className="px-5 py-4 tabular-nums text-muted-foreground">
                      {contributions.reduce((acc, c) => acc + c.weight, 0).toFixed(2)}
                    </td>
                    <td />
                    <td className="px-5 py-4 tabular-nums">
                      <span className="text-lg font-bold gradient-text">
                        {weightedSum.toFixed(4)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {Math.abs(weightedSum - composite) > 0.005 && (
              <p className="mt-4 max-w-2xl rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-300">
                <strong>Note:</strong> The weighted sum above ({weightedSum.toFixed(4)}) doesn&apos;t
                exactly match the stored composite ({composite.toFixed(4)}). The difference is
                usually the v3 low-score cap (composite &lt; 0.20 → 0.40, composite &lt; 0.10 → 0.25)
                or a run with an older scoring pass.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Skill accuracy breakdown</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Did the agent invoke the right skills at the right moments?
          </h2>

          {run.skillAccuracyBreakdown && run.skillAccuracyBreakdown.expected_triggers.length > 0 ? (
            <>
              <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                For each expected trigger we recorded whether the agent invoked the skill at the
                right point in the loop. Accuracy = fired / expected ={" "}
                <strong className="text-foreground">
                  {formatNum(run.skillAccuracyBreakdown.accuracy, 2)}
                </strong>
                .
              </p>
              <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Skill</th>
                      <th className="px-5 py-3 font-medium">Expected when</th>
                      <th className="px-5 py-3 font-medium">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.skillAccuracyBreakdown.expected_triggers.map((t, idx) => (
                      <tr
                        key={`${t.skill}-${idx}`}
                        className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                      >
                        <td className="px-5 py-3 font-mono text-[11px] text-accent">{t.skill}</td>
                        <td className="px-5 py-3 text-muted-foreground">{t.when ?? "—"}</td>
                        <td className="px-5 py-3">
                          {t.triggered ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 size={14} aria-hidden />
                              fired
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
                              <XCircle size={14} aria-hidden />
                              missed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : tracingGap ? (
            <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Tracing gap
                </p>
              </div>
              <p className="text-base leading-7 text-foreground">
                This run stored only the aggregate{" "}
                <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">
                  skill_accuracy: {skillAccuracyValue?.toFixed(2)}
                </code>{" "}
                — there is no per-skill trigger breakdown in its TRACE.json. We can&apos;t tell
                you which of the expected skills fired vs missed. This is exactly the failure mode
                gad-50 calls out: the trace schema is too lossy to explain scores like this
                after the fact.
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Phase 25 of the GAD framework work ships trace schema v4 — every tool use, skill
                invocation with its trigger context, and subagent spawn with inputs + outputs.
                Older runs like this one will keep their aggregate score but new runs will land
                with the full breakdown.
              </p>
              <Link
                href="/methodology"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                How tracing works →
              </Link>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Skill accuracy data isn&apos;t relevant for this run (no expected trigger set).
            </p>
          )}
        </div>
      </section>

      {videos.length > 0 && (
        <section className="border-b border-border/60 bg-card/20">
          <div className="section-shell">
            <div className="mb-2 flex items-center gap-2">
              <Film size={18} className="text-accent" aria-hidden />
              <p className="section-kicker !mb-0">Watch this dissection</p>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {videos.length === 1 ? "A 20-second walkthrough" : `${videos.length} walkthroughs`}
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              Remotion React composition, rendered live in your browser. No MP4, no download, no
              external player. Reuses the same components as the rest of the site so the video
              stays accurate to the live data by construction. Press play, pause any time, scrub
              the timeline.
            </p>
            <div className="mt-10 grid gap-10 lg:grid-cols-1">
              {videos.map((c) => (
                <VideoEmbed key={c.slug} composition={c} />
              ))}
            </div>
            <Link
              href="/videos"
              className="mt-10 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
            >
              Browse all video dissections →
            </Link>
          </div>
        </section>
      )}

      {produced && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="section-kicker">What the agent built for itself</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Emergent workflow artifacts
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              Bare and emergent runs don&apos;t have a framework giving them structure — they author
              their own methodology on the fly. These are the files the agent wrote into its own{" "}
              <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">game/.planning/</code>{" "}
              during this run. When a file appears here that isn&apos;t in the inherited bootstrap
              set, the agent invented it.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Skills written", items: produced.skillFiles },
                { label: "Subagents written", items: produced.agentFiles },
                { label: "Planning notes", items: produced.planningFiles },
                { label: "Workflow docs", items: produced.workflowNotes },
              ]
                .filter((col) => col.items.length > 0)
                .map((col) => (
                  <div
                    key={col.label}
                    className="rounded-2xl border border-border/70 bg-card/40 p-5"
                  >
                    <p className="text-xs uppercase tracking-wider text-accent">
                      {col.label}
                      <span className="ml-2 text-muted-foreground">({col.items.length})</span>
                    </p>
                    <ul className="mt-3 space-y-2">
                      {col.items.map((item) => (
                        <li key={item.name} className="flex items-center gap-2">
                          <Circle size={6} className="fill-accent text-accent" aria-hidden />
                          <code className="truncate font-mono text-xs text-foreground">
                            {item.name}
                          </code>
                          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                            {item.bytes < 1024 ? `${item.bytes} B` : `${(item.bytes / 1024).toFixed(1)} KB`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

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
