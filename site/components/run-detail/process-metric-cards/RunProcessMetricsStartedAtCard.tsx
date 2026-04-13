import { Identified } from "@/components/devid/Identified";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtTimestamp } from "@/components/landing/playable/playable-shared";

export function RunProcessMetricsStartedAtCard({ started }: { started: string | null }) {
  return (
    <Identified as="RunProcessMetricsStartedAtCard" className="contents">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Started</CardDescription>
          <CardTitle className="text-base">{fmtTimestamp(started)}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          Run start captured in TRACE timing metadata
        </CardContent>
      </Card>
    </Identified>
  );
}
