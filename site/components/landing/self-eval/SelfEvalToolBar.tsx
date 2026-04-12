export function SelfEvalToolBar({ tool, count, max }: { tool: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 truncate text-xs text-muted-foreground">{tool}</span>
      <div className="flex-1 h-2 rounded-full bg-border/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent/60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}
