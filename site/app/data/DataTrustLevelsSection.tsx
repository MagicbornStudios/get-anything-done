import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { TRUST_DESCRIPTION, TRUST_TINT } from "./data-shared";

export default function DataTrustLevelsSection() {
  return (
    <SiteSection tone="muted">
      <Identified as="DataTrustLevelsHeading">
        <SiteSectionHeading kicker="Trust levels explained" />
      </Identified>
      <div className="grid gap-3 md:grid-cols-2">
        {(["deterministic", "human", "authored", "self-report"] as const).map((t) => (
          <Identified key={t} as={`DataTrustLevelCard-${t}`}>
            <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Badge variant={TRUST_TINT[t]}>{t}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 text-xs leading-5 text-muted-foreground">
              {TRUST_DESCRIPTION[t]}
            </CardContent>
          </Card>
          </Identified>
        ))}
      </div>
    </SiteSection>
  );
}
