import Link from "next/link";
import { ExternalLink, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ROUND_RESULTS_REPO,
  ROUND_RESULTS_WORKFLOW_TINT,
} from "@/components/landing/round-results/round-results-shared";
import { ResultsScoreBar } from "@/components/landing/results/ResultsScoreBar";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";
import { WORKFLOW_LABELS, playableUrl, type EvalRunRecord } from "@/lib/eval-data";

type Props = {
  run: EvalRunRecord;
};

export function RoundResultsRunCard({ run }: Props) {
  const playable = playableUrl(run);
  const composite = run.scores.composite ?? 0;
  const human = run.humanReview?.score ?? 0;
  const round = roundForRun(run);

  return (
    <Card
      className={`border-l-4 ${ROUND_RESULTS_WORKFLOW_TINT[run.workflow]} transition-colors hover:border-accent/70`}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline" className="border-border/70">
            {WORKFLOW_LABELS[run.workflow]} · {run.version}
          </Badge>
          {run.requirementCoverage?.gate_failed ? (
            <Badge variant="danger">Gate failed</Badge>
          ) : (
            <Badge variant="success">Gate passed</Badge>
          )}
        </div>
        <CardTitle className="mt-2 truncate text-lg">{run.project}</CardTitle>
        <CardDescription>
          requirements {run.requirementsVersion} · {run.date}
          {round && <span className="ml-2 text-accent/70">{round}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>Composite</span>
            <span className="text-base font-semibold tabular-nums text-foreground">
              {composite.toFixed(3)}
            </span>
          </div>
          <div className="mt-1.5">
            <ResultsScoreBar value={composite} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>Human review</span>
            <span className="text-base font-semibold tabular-nums text-foreground">
              {human.toFixed(2)}
            </span>
          </div>
          <div className="mt-1.5">
            <ResultsScoreBar value={human} />
          </div>
        </div>
        <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">
          {run.humanReview?.notes ?? run.requirementCoverage?.gate_notes ?? ""}
        </p>
        <div className="flex flex-wrap gap-3 pt-1 text-xs font-medium">
          <Link
            href={`/runs/${run.project}/${run.version}`}
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            Full breakdown →
          </Link>
          {playable && (
            <a
              href={playable}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              <Play size={12} aria-hidden />
              Play
            </a>
          )}
          <a
            href={`${ROUND_RESULTS_REPO}/tree/main/evals/${run.project}/${run.version}`}
            rel="noopener noreferrer"
            target="_blank"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-accent"
          >
            TRACE
            <ExternalLink size={12} aria-hidden />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
