import { Identified } from "@portfolio/visual-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";

type TokenUsage = NonNullable<EvalRunRecord["tokenUsage"]>;

export function RunProcessMetricsToolUsesCard({ tokenUsage }: { tokenUsage: TokenUsage }) {
  return (
    <Identified as="RunProcessMetricsToolUsesCard" className="contents">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Tool uses</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{tokenUsage.tool_uses ?? "—"}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {tokenUsage.total_tokens != null ? `${tokenUsage.total_tokens.toLocaleString()} tokens` : ""}
          {tokenUsage.note ? ` · ${tokenUsage.note}` : ""}
        </CardContent>
      </Card>
    </Identified>
  );
}
