import type { EvalRunRecord } from "@/lib/eval-data";

export function freedomRunKey(r: EvalRunRecord): string {
  return `${r.project}/${r.version}`;
}

export function freedomRunScore(r: EvalRunRecord): number {
  return r.humanReviewNormalized?.aggregate_score ?? r.humanReview?.score ?? 0;
}

export function FreedomScoreRow({ run: r }: { run: EvalRunRecord }) {
  const s = freedomRunScore(r);
  const pct = Math.round(s * 100);

  return (
    <div className="grid grid-cols-[60px_1fr_80px] items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 md:grid-cols-[80px_1fr_100px]">
      <div>
        <div className="font-mono text-xs text-foreground">{r.version}</div>
        <div className="text-[10px] text-muted-foreground">{r.date}</div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-background/60">
        <div
          className="h-full rounded-full bg-emerald-500/70"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <div className="text-right font-mono text-sm tabular-nums text-foreground">{s.toFixed(3)}</div>
    </div>
  );
}
