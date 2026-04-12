export type SiteInlineMetricProps = {
  label: string;
  value: string;
};

/** Compact label + large number row (hero sections, hypothesis rollups). */
export function SiteInlineMetric({ label, value }: SiteInlineMetricProps) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
