import type { EvalRunRecord } from "@/lib/eval-data";

export function RunHeroHumanReviewNote({ run }: { run: EvalRunRecord }) {
  if (!run.humanReview?.notes) return null;
  return (
    <div className="mt-6 rounded-2xl border border-border/70 bg-card/40 p-5">
      <p className="text-xs uppercase tracking-wider text-accent">Human review note</p>
      <p className="mt-2 text-base leading-7 text-foreground">{run.humanReview.notes}</p>
      {run.humanReview.reviewed_by && (
        <p className="mt-3 text-xs text-muted-foreground">
          Reviewed by {run.humanReview.reviewed_by}
          {run.humanReview.reviewed_at ? ` · ${String(run.humanReview.reviewed_at).slice(0, 10)}` : ""}
        </p>
      )}
    </div>
  );
}
