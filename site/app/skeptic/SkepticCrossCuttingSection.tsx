import { AlertOctagon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { CROSS_CUTTING } from "./skeptic-shared";

export default function SkepticCrossCuttingSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={AlertOctagon}
        kicker="Critiques that hit every claim"
        iconClassName="text-rose-400"
        kickerRowClassName="mb-6 gap-3"
      />
      <SiteProse size="sm" className="mb-6">
        These problems apply to <strong>every</strong> hypothesis below. They&apos;re the structural
        weaknesses of a one-person research project at low N.
      </SiteProse>
      <div className="grid gap-4 md:grid-cols-2">
        {CROSS_CUTTING.map((c, i) => (
          <Card key={i} className="border-l-4 border-rose-500/60">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="danger" className="font-mono text-[10px]">
                  #{i + 1}
                </Badge>
                <CardTitle className="text-base leading-tight">{c.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">{c.body}</CardContent>
          </Card>
        ))}
      </div>
    </SiteSection>
  );
}
