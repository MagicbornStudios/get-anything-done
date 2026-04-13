import { Identified } from "@/components/devid/Identified";
import { WORKFLOW_LABELS, type EvalRunRecord } from "@/lib/eval-data";
import { Badge } from "@/components/ui/badge";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";
import {
  fmtDuration,
  fmtTimestamp,
  fmtTokensLong,
  reviewStateFor,
  REVIEW_STATE_DOT,
  REVIEW_STATE_LABEL,
  WORKFLOW_HYPOTHESIS,
} from "@/components/landing/playable/playable-shared";

/** HoverCard panel content for a run */
export function RunInfoPanel({ r }: { r: EvalRunRecord }) {
  const round = roundForRun(r);
  const state = reviewStateFor(r);
  const human = r.humanReview?.score;
  const composite = r.scores.composite;
  const started = typeof r.timing?.started === "string" ? r.timing.started : null;
  const ended = typeof r.timing?.ended === "string" ? r.timing.ended : null;

  return (
    <div className="space-y-3">
      <Identified as="RunInfoPanelState">
        <Badge variant="outline" className="inline-flex w-fit items-center gap-2 border-border/70 bg-card/50 py-1 text-xs font-semibold normal-case">
          <span className={`size-2 rounded-full ${REVIEW_STATE_DOT[state]}`} />
          {REVIEW_STATE_LABEL[state]}
        </Badge>
      </Identified>

      <Identified as="RunInfoPanelTitle" className="text-xs font-semibold text-foreground">
        {r.project} · {r.version}
      </Identified>

      <Identified as="RunInfoPanelStats">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Hypothesis</dt>
          <dd className="font-medium text-foreground">{WORKFLOW_HYPOTHESIS[r.workflow] ?? r.workflow}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Condition</dt>
          <dd className="font-medium text-foreground">{WORKFLOW_LABELS[r.workflow]}</dd>
        </div>
        {round && (
          <div>
            <dt className="text-muted-foreground/70 uppercase tracking-wider">Round</dt>
            <dd className="font-medium text-foreground">{round}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Reqs</dt>
          <dd className="font-medium text-foreground">{r.requirementsVersion}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Tokens</dt>
          <dd className="font-medium tabular-nums text-foreground">{fmtTokensLong(r.tokenUsage?.total_tokens)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Duration</dt>
          <dd className="font-medium tabular-nums text-foreground">{fmtDuration(r.timing?.duration_minutes)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Runtime</dt>
          <dd className="font-medium text-foreground">
            {typeof r.runtimeIdentity?.id === "string" && r.runtimeIdentity.id ? r.runtimeIdentity.id : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Started</dt>
          <dd className="font-medium text-foreground">{fmtTimestamp(started)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Composite</dt>
          <dd className="font-semibold tabular-nums text-foreground">{composite != null ? composite.toFixed(3) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Human</dt>
          <dd className="font-semibold tabular-nums text-foreground">{human != null ? human.toFixed(2) : "TBD"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Commits</dt>
          <dd className="font-medium tabular-nums text-foreground">{r.gitAnalysis?.total_commits ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Ended</dt>
          <dd className="font-medium text-foreground">{fmtTimestamp(ended)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70 uppercase tracking-wider">Gate</dt>
          <dd className="font-medium text-foreground">
            {r.requirementCoverage?.gate_failed
              ? <span className="text-red-400">Failed</span>
              : <span className="text-emerald-400">Passed</span>}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground/70 uppercase tracking-wider">GAD version</dt>
          <dd className="font-mono text-[10px] text-foreground">
            {r.gadVersion ? `v${r.gadVersion}` : "—"}
            {r.frameworkVersion && r.frameworkVersion !== r.gadVersion ? ` · framework ${r.frameworkVersion}` : ""}
          </dd>
        </div>
      </dl>
      </Identified>

      {r.humanReview?.notes ? (
        <Identified
          as="RunInfoPanelNotes"
          className="border-t border-border/60 pt-2 text-[11px] leading-4 text-muted-foreground line-clamp-3"
          tag="p"
        >
          {r.humanReview.notes}
        </Identified>
      ) : null}
    </div>
  );
}
