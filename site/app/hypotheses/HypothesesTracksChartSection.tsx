import Link from "next/link";
import { HypothesisTracksChart, type HypothesisTrackPoint } from "@/components/charts/HypothesisTracksChart";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function HypothesesTracksChartSection({ data }: { data: HypothesisTrackPoint[] }) {
  return (
    <SiteSection>
      <SiteSectionHeading kicker="All tracks, one chart" className="mb-4" />
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Highest human-review score per round, per hypothesis track. Solid lines have real data. Dashed lines are
        planned tracks — content-driven (gad-66) and codex runtime (task 89) — with no runs yet. Read{" "}
        <Link href="/skeptic" className="text-rose-300 underline decoration-dotted">
          /skeptic
        </Link>{" "}
        before trusting any individual point: N=2-5 runs per condition, one human reviewer, one task domain so far.
      </p>
      <HypothesisTracksChart data={data} />
    </SiteSection>
  );
}
