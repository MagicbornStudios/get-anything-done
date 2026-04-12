import { planningFmtCount } from "./planning-system-format";

export type PlanningSystemBarRowProps = {
  label: string;
  value: number;
  max: number;
  suffix?: string;
};

export function PlanningSystemBarRow({ label, value, max, suffix }: PlanningSystemBarRowProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 truncate text-xs text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/40">
        <div className="h-full rounded-full bg-accent/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 text-right text-xs tabular-nums text-foreground">
        {planningFmtCount(value)}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </div>
  );
}
