import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { InsightDataSource } from "@/app/insights/insights-queries";

type Props = {
  sources: readonly InsightDataSource[];
};

export function InsightsDataSourcesCard({ sources }: Props) {
  return (
    <Card className="mt-12 border-accent/40 bg-accent/5 shadow-none">
      <CardHeader className="pb-2">
        <p className="section-kicker !mb-0">Data sources</p>
      </CardHeader>
      <CardContent>
        <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((src) => (
            <li key={src.id} className="space-y-1.5">
              <Badge variant="outline" className="font-mono text-[10px] normal-case tracking-normal">
                {src.label}
              </Badge>
              <p className="text-xs leading-snug text-muted-foreground">{src.caption}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
