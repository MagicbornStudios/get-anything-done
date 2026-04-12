import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SecurityAttackCard({
  title,
  severity,
  description,
  mitigation,
  examples,
}: {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  mitigation: string;
  examples?: string[];
}) {
  const sevTint =
    severity === "critical" || severity === "high"
      ? "danger"
      : severity === "medium"
        ? "default"
        : "outline";
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="mb-1 flex items-center gap-2">
          <Badge variant={sevTint}>{severity}</Badge>
        </div>
        <CardTitle className="text-base leading-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
        <p>{description}</p>
        {examples && examples.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1 text-[11px]">
            <span className="text-muted-foreground/70">examples:</span>
            {examples.map((e) => (
              <code
                key={e}
                className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-rose-300"
              >
                {e}
              </code>
            ))}
          </p>
        )}
        <p className="mt-3 border-l-2 border-emerald-500/60 pl-3 text-xs leading-5 text-muted-foreground">
          <strong className="text-emerald-300">Mitigation:</strong> {mitigation}
        </p>
      </CardContent>
    </Card>
  );
}
