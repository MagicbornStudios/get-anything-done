import { Sparkles } from "lucide-react";
import type { EvalRunRecord } from "@/lib/eval-data";

export function emergentRunKey(r: EvalRunRecord): string {
  return `${r.project}/${r.version}`;
}

export function EmergentScoredRunRow({ run: r }: { run: EvalRunRecord }) {
  const score = r.humanReviewNormalized?.aggregate_score ?? 0;
  const pct = Math.round(score * 100);
  const inheritanceScore =
    r.humanReviewNormalized?.dimensions?.skill_inheritance_effectiveness?.score ?? null;

  return (
    <div className="grid grid-cols-[60px_1fr_60px_100px] items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 md:grid-cols-[80px_1fr_80px_140px]">
      <div>
        <div className="font-mono text-xs text-foreground">{r.version}</div>
        <div className="text-[10px] text-muted-foreground">{r.date}</div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-background/60">
        <div
          className="h-full rounded-full bg-amber-500/70"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <div className="text-right font-mono text-sm tabular-nums text-foreground">{score.toFixed(3)}</div>
      <div className="text-right text-[10px] text-muted-foreground">
        {inheritanceScore != null ? (
          <>
            <Sparkles size={9} className="mr-1 inline text-amber-400" aria-hidden />
            inherit {inheritanceScore.toFixed(2)}
          </>
        ) : (
          <span className="opacity-60">no 6th dim</span>
        )}
      </div>
    </div>
  );
}
