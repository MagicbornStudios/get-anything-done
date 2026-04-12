"use client";

import { ExternalLink, FileText, Sparkles, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";
import {
  fmtDuration,
  fmtTimestamp,
  fmtTokensLong,
  REPO,
  reviewStateFor,
  REVIEW_STATE_DOT,
  REVIEW_STATE_LABEL,
} from "@/components/landing/playable/playable-shared";
import { WORKFLOW_LABELS, type EvalRunRecord } from "@/lib/eval-data";

type Props = {
  selected: EvalRunRecord;
  onOpenRequirements: () => void;
  onOpenSkill: () => void;
};

export function PlayableSelectedPanel({ selected, onOpenRequirements, onOpenSkill }: Props) {
  const reviewState = reviewStateFor(selected);
  const reviewBadgeVariant =
    reviewState === "reviewed" ? "success" : reviewState === "excluded" ? "outline" : "danger";
  const round = roundForRun(selected);
  const started = typeof selected.timing?.started === "string" ? selected.timing.started : null;

  return (
    <Card className="border-border/70 bg-card/40 shadow-none">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{WORKFLOW_LABELS[selected.workflow]} · {selected.version}</Badge>
          <Badge variant={reviewBadgeVariant} className="inline-flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${REVIEW_STATE_DOT[reviewState]}`} aria-hidden />
            {REVIEW_STATE_LABEL[reviewState]}
          </Badge>
          {selected.requirementCoverage?.gate_failed ? (
            <Badge variant="danger">Gate failed</Badge>
          ) : (
            <Badge variant="success">Gate passed</Badge>
          )}
          {round && (
            <Badge variant="outline" className="border-purple-500/40 text-purple-300">
              {round}
            </Badge>
          )}
        </div>
        <h3 className="text-lg font-semibold leading-tight">{selected.project}</h3>
        <p className="text-xs text-muted-foreground">
          requirements {selected.requirementsVersion} · {selected.date}
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Composite</dt>
            <dd className="text-xl font-semibold tabular-nums text-foreground">
              {(selected.scores.composite ?? 0).toFixed(3)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Human</dt>
            <dd className="text-xl font-semibold tabular-nums text-foreground">
              {(selected.humanReview?.score ?? 0).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Tokens</dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">
              {fmtTokensLong(selected.tokenUsage?.total_tokens)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Build time</dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">
              {fmtDuration(selected.timing?.duration_minutes)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Runtime</dt>
            <dd className="text-sm font-medium text-foreground">
              {typeof selected.runtimeIdentity?.id === "string" && selected.runtimeIdentity.id
                ? selected.runtimeIdentity.id
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Started</dt>
            <dd className="text-sm font-medium text-foreground">{fmtTimestamp(started)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Commits</dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">
              {selected.gitAnalysis?.total_commits ?? "—"}
            </dd>
          </div>
        </dl>

        {selected.humanReview?.notes && (
          <p className="border-t border-border/60 pt-5 text-sm leading-6 text-muted-foreground">
            {selected.humanReview.notes}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <Button
            variant="link"
            className="h-auto justify-start gap-1 p-0 text-xs font-semibold text-accent"
            asChild
          >
            <Link href={`/runs/${selected.project}/${selected.version}`}>
              <BarChart3 size={11} aria-hidden />
              Full breakdown
            </Link>
          </Button>
          <Button
            variant="link"
            className="h-auto justify-start gap-1 p-0 text-xs font-semibold text-accent"
            asChild
          >
            <a
              href={`${REPO}/tree/main/evals/${selected.project}/${selected.version}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source on GitHub
              <ExternalLink size={11} aria-hidden />
            </a>
          </Button>
          {selected.requirementsDoc && (
            <Button
              type="button"
              variant="ghost"
              onClick={onOpenRequirements}
              className="h-auto justify-start gap-1.5 p-0 text-left text-xs font-medium text-muted-foreground hover:text-accent"
            >
              <FileText size={11} aria-hidden />
              <span className="underline decoration-dotted underline-offset-2">
                {selected.requirementsDoc.filename}
              </span>
            </Button>
          )}
          {selected.topSkill && (
            <Button
              type="button"
              variant="ghost"
              onClick={onOpenSkill}
              disabled={!selected.topSkill.content}
              className="h-auto justify-start gap-1.5 p-0 text-left text-xs font-medium text-muted-foreground hover:text-accent disabled:hover:text-muted-foreground"
              title={
                selected.topSkill.total_skills > 1
                  ? `Top skill — ${selected.topSkill.total_skills} skills authored this run`
                  : "Top skill authored this run"
              }
            >
              <Sparkles size={11} aria-hidden className="text-amber-400" />
              <span className="underline decoration-dotted underline-offset-2">
                {selected.topSkill.filename}
              </span>
              {selected.topSkill.total_skills > 1 && (
                <span className="text-[10px] text-muted-foreground/70">
                  (+{selected.topSkill.total_skills - 1})
                </span>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
