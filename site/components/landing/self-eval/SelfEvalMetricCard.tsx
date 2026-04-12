import { Card, CardContent } from "@/components/ui/card";

export function SelfEvalMetricCard({
  label,
  value,
  subtext,
  score,
}: {
  label: string;
  value: string;
  subtext?: string;
  score?: number;
}) {
  const scoreColor =
    score == null
      ? ""
      : score >= 0.7
        ? "text-emerald-400"
        : score >= 0.4
          ? "text-amber-400"
          : "text-red-400";

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        {subtext && <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>}
        {score != null && (
          <p className={`mt-1 text-xs font-semibold tabular-nums ${scoreColor}`}>
            Score: {score.toFixed(2)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
