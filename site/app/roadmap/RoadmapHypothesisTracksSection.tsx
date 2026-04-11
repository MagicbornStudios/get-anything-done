import { HypothesisTracksChart, type HypothesisTrackPoint } from "@/components/charts/HypothesisTracksChart";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export default function RoadmapHypothesisTracksSection({
  trackData,
}: {
  trackData: HypothesisTrackPoint[];
}) {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <Card className="border-border/60 bg-card/30">
          <CardHeader className="pb-2">
            <p className="section-kicker !mb-0">Hypothesis tracks across rounds</p>
            <CardDescription className="pt-3 text-sm leading-relaxed text-muted-foreground">
              One line per hypothesis track. Freedom = bare condition.
              CSH = emergent (compound-skills). GAD = full-framework condition.
              Content-driven and Codex runtime are planned tracks with no scored
              runs yet — shown as dashed lines to make the research plan visible.
              Round 5 is queued pending the HTTP 529 investigation.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <HypothesisTracksChart data={trackData} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
