import Link from "next/link";
import { AlertTriangle, ArrowLeft, ExternalLink, Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PROJECT_LABELS, WORKFLOW_LABELS, type EvalRunRecord } from "@/lib/eval-data";
import { REPO, formatNum } from "@/app/runs/[project]/[version]/run-detail-shared";
import { RunScoreBar } from "@/app/runs/[project]/[version]/RunScoreBar";

export function RunHeroSection({
  run,
  playable,
  composite,
  humanScore,
  gateKnown,
  divergent,
  rateLimited,
  apiInterrupted,
  rateLimitNote,
  interruptionNote,
}: {
  run: EvalRunRecord;
  playable: string | null;
  composite: number;
  humanScore: number | null;
  gateKnown: boolean;
  divergent: boolean;
  rateLimited: boolean;
  apiInterrupted: boolean;
  rateLimitNote: string | null;
  interruptionNote: string | null;
}) {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <Button
          variant="ghost"
          className="mb-6 h-auto gap-2 px-0 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
          asChild
        >
          <Link href="/#results">
            <ArrowLeft size={14} aria-hidden />
            Back to results
          </Link>
        </Button>

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
          {apiInterrupted && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-300">
              ⚠ API interrupted — not comparable
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
                  <RunScoreBar value={composite} />
                </div>
              </div>
              {humanScore != null && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Human review
                  </p>
                  <p
                    className={`mt-1 text-6xl font-semibold tabular-nums ${
                      humanScore >= 0.5
                        ? "text-emerald-400"
                        : humanScore >= 0.25
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  >
                    {humanScore.toFixed(2)}
                  </p>
                  <div className="mt-3">
                    <RunScoreBar value={humanScore} />
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
                  This run hit an account-level rate limit before completing. The data captured here
                  reflects partial progress only — it is <strong>not</strong> included in the
                  freedom-hypothesis scatter, the Results card grid, or any aggregate comparison on
                  the site (decision gad-63). Preserved here as a data point for
                  planning-differential analysis and honest documentation.
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

            {apiInterrupted && (
              <div className="mt-6 rounded-2xl border border-amber-500/50 bg-amber-500/5 p-5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-400" aria-hidden />
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    API interrupted · Anthropic server overload
                  </p>
                </div>
                <p className="mt-2 text-base leading-7 text-foreground">
                  This run was stopped by an HTTP 529 <code>overloaded_error</code> from the
                  Anthropic API — a server-side transient load issue, not a rate limit or agent
                  failure. The data captured here reflects partial progress before the API stopped
                  responding. Excluded from cross-round comparisons per <strong>decision gad-64</strong>.
                </p>
                {interruptionNote && (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    <strong>Details:</strong> {interruptionNote}
                  </p>
                )}
                <Button
                  variant="link"
                  className="mt-4 h-auto gap-1 p-0 text-xs font-semibold text-accent"
                  asChild
                >
                  <Link href="/findings/2026-04-09-round-4-complete">Full round 4 findings →</Link>
                </Button>
              </div>
            )}

            {divergent && !rateLimited && !apiInterrupted && (
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
                <p className="mt-2 text-base leading-7 text-foreground">{run.humanReview.notes}</p>
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
              <Button
                size="lg"
                className="gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5 hover:bg-accent/90"
                asChild
              >
                <a href={playable} target="_blank" rel="noopener noreferrer">
                  <Gamepad2 size={16} aria-hidden />
                  Play this build
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="gap-2 rounded-full border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold hover:border-accent hover:text-accent"
              asChild
            >
              <a
                href={`${REPO}/tree/main/evals/${run.project}/${run.version}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} aria-hidden />
                Source on GitHub
              </a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 rounded-full border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold hover:border-accent hover:text-accent"
              asChild
            >
              <a
                href={`${REPO}/blob/main/evals/${run.project}/${run.version}/TRACE.json`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} aria-hidden />
                Raw TRACE.json
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
