import { planningFmtCompactCount, planningFmtCount } from "./planning-system-format";

export type PlanningSystemBarRowProps = {
  label: string;
  value: number;
  max: number;
  suffix?: string;
};

export function PlanningSystemBarRow({ label, value, max, suffix }: PlanningSystemBarRowProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const full = `${planningFmtCount(value)}${suffix ? ` ${suffix}` : ""}`;
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={label}>
        {label}
      </span>
      <div className="h-2 min-w-[4rem] flex-[1.5] overflow-hidden rounded-full bg-border/40">
        <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span
        className="shrink-0 text-right text-xs tabular-nums text-foreground"
        title={full}
      >
        {planningFmtCompactCount(value)}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </div>
  );
}
