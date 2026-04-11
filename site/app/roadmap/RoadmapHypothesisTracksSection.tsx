import { HypothesisTracksChart, type HypothesisTrackPoint } from "@/components/charts/HypothesisTracksChart";

export default function RoadmapHypothesisTracksSection({
  trackData,
}: {
  trackData: HypothesisTrackPoint[];
}) {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <div className="mb-6 flex items-center gap-3">
          <p className="section-kicker !mb-0">Hypothesis tracks across rounds</p>
        </div>
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          One line per hypothesis track. Freedom = bare condition.
          CSH = emergent (compound-skills). GAD = full-framework condition.
          Content-driven and Codex runtime are planned tracks with no scored
          runs yet — shown as dashed lines to make the research plan visible.
          Round 5 is queued pending the HTTP 529 investigation.
        </p>
        <HypothesisTracksChart data={trackData} />
      </div>
    </section>
  );
}
