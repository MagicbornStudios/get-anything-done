import { Identified } from "@/components/devid/Identified";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtTimestamp } from "@/components/landing/playable/playable-shared";

export function RunProcessMetricsEndedAtCard({ ended }: { ended: string | null }) {
  return (
    <Identified as="RunProcessMetricsEndedAtCard" className="contents">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Ended</CardDescription>
          <CardTitle className="text-base">{fmtTimestamp(ended)}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          Missing end time usually means the run was scaffolded but never finalized
        </CardContent>
      </Card>
    </Identified>
  );
}
