import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNum } from "@/lib/run-detail-shared";
import type { RunHeroBaseProps } from "./run-hero-props";
import { RunHeroHumanReviewNote } from "./RunHeroHumanReviewNote";

type RunHeroCalloutsProps = Pick<
  RunHeroBaseProps,
  "run" | "composite" | "humanScore" | "divergent" | "rateLimited" | "apiInterrupted" | "rateLimitNote" | "interruptionNote"
>;

export function RunHeroCallouts({
  run,
  composite,
  humanScore,
  divergent,
  rateLimited,
  apiInterrupted,
  rateLimitNote,
  interruptionNote,
}: RunHeroCalloutsProps) {
  return (
    <>
      {rateLimited && (
        <div className="mt-6 rounded-2xl border border-amber-500/50 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Rate-limited run · excluded from cross-round comparisons
            </p>
          </div>
          <p className="mt-2 text-base leading-7 text-foreground">
            This run hit an account-level rate limit before completing. The data captured here reflects partial progress
            only — it is <strong>not</strong> included in the freedom-hypothesis scatter, the Results card grid, or any
            aggregate comparison on the site (decision gad-63). Preserved here as a data point for planning-differential
            analysis and honest documentation.
          </p>
          {rateLimitNote && (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              <strong>Details:</strong> {rateLimitNote}
            </p>
          )}
          <Link
            href="/roadmap"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            Round 4 evidence →
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
            This run was stopped by an HTTP 529 <code>overloaded_error</code> from the Anthropic API — a server-side
            transient load issue, not a rate limit or agent failure. The data captured here reflects partial progress
            before the API stopped responding. Excluded from cross-round comparisons per <strong>decision gad-64</strong>.
          </p>
          {interruptionNote && (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              <strong>Details:</strong> {interruptionNote}
            </p>
          )}
          <Button variant="link" className="mt-4 h-auto gap-1 p-0 text-xs font-semibold text-accent" asChild>
            <Link href="/roadmap">Round 4 evidence →</Link>
          </Button>
        </div>
      )}

      {divergent && !rateLimited && !apiInterrupted && (
        <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/5 p-5">
          <p className="text-xs uppercase tracking-wider text-red-400">Process metrics diverged from reality</p>
          <p className="mt-2 text-base leading-7 text-foreground">
            This run scored <strong>{formatNum(composite)}</strong> on the composite formula (requirement coverage,
            planning quality, commit discipline, skill accuracy, time efficiency) but a human reviewer rated the actual
            artifact <strong>{humanScore!.toFixed(2)}</strong> out of 1.0. This is exactly the failure mode that prompted
            gad-29 (&quot;process metrics do not guarantee output quality&quot;) and the move to weight human review at
            30%.
          </p>
        </div>
      )}

      <RunHeroHumanReviewNote run={run} />
    </>
  );
}

