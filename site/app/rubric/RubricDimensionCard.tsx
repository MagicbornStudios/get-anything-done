import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RubricDimension = {
  key: string;
  label: string;
  weight: number;
  description: string;
};

export function RubricDimensionCard({ dim }: { dim: RubricDimension }) {
  const pct = Math.round(dim.weight * 100);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-tight">{dim.label}</CardTitle>
          <span className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-accent">
            {dim.weight.toFixed(2)}
          </span>
        </div>
        <code className="block text-[11px] text-muted-foreground">{dim.key}</code>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-card/60">
          <div
            className="h-full rounded-full bg-accent/80"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{dim.description}</p>
      </CardContent>
    </Card>
  );
}
