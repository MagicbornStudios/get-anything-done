import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  label: string;
  value: unknown;
};

export function InsightMetricCard({ label, value }: Props) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wider">{label}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <CardTitle className="text-2xl font-semibold tabular-nums leading-none">{String(value)}</CardTitle>
      </CardContent>
    </Card>
  );
}
