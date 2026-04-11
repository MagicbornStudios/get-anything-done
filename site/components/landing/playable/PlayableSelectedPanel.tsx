"use client";

import { ExternalLink, FileText, Sparkles, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";
import {
  fmtDuration,
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

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
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
      <h3 className="mt-3 text-lg font-semibold leading-tight">{selected.project}</h3>
      <p className="text-xs text-muted-foreground">
        requirements {selected.requirementsVersion} · {selected.date}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
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
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Commits</dt>
          <dd className="text-sm font-medium tabular-nums text-foreground">
            {selected.gitAnalysis?.total_commits ?? "—"}
          </dd>
        </div>
      </dl>

      {selected.humanReview?.notes && (
        <p className="mt-5 border-t border-border/60 pt-5 text-sm leading-6 text-muted-foreground">
          {selected.humanReview.notes}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <Link
          href={`/runs/${selected.project}/${selected.version}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          <BarChart3 size={11} aria-hidden />
          Full breakdown
        </Link>
        <a
          href={`${REPO}/tree/main/evals/${selected.project}/${selected.version}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          Source on GitHub
          <ExternalLink size={11} aria-hidden />
        </a>
        {selected.requirementsDoc && (
          <button
            type="button"
            onClick={onOpenRequirements}
            className="inline-flex items-center gap-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            <FileText size={11} aria-hidden />
            <span className="underline decoration-dotted underline-offset-2">
              {selected.requirementsDoc.filename}
            </span>
          </button>
        )}
        {selected.topSkill && (
          <button
            type="button"
            onClick={onOpenSkill}
            disabled={!selected.topSkill.content}
            className="inline-flex items-center gap-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-accent disabled:opacity-60 disabled:hover:text-muted-foreground"
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
          </button>
        )}
      </div>
    </div>
  );
}
