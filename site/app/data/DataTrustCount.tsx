import { Badge } from "@/components/ui/badge";

export default function DataTrustCount({
  label,
  count,
  tint,
}: {
  label: string;
  count: number;
  tint: "success" | "default" | "outline" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <Badge variant={tint}>{label}</Badge>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{count}</p>
    </div>
  );
}
