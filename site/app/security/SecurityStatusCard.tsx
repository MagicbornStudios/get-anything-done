import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SecurityStatusCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-xs text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}
