import { HypothesisTracksChart, type HypothesisTrackPoint } from "@/components/charts/HypothesisTracksChart";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export default function RoadmapHypothesisTracksSection({
  trackData,
}: {
  trackData: HypothesisTrackPoint[];
}) {
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Hypothesis tracks across rounds"
        className="mb-6"
      />
      <Card className="border-border/60 bg-card/30">
        <CardHeader className="pb-2">
          <CardDescription className="text-sm leading-relaxed text-muted-foreground">
            One line per hypothesis track. Freedom = bare condition. CSH = emergent
            (compound-skills). GAD = full-framework condition. Content-driven and Codex runtime are
            planned tracks with no scored runs yet — shown as dashed lines to make the research plan
            visible. Evolution 5 is queued pending the HTTP 529 investigation.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <HypothesisTracksChart data={trackData} />
        </CardContent>
      </Card>
    </SiteSection>
  );
}
