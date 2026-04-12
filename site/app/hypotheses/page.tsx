import Link from "next/link";
import { MarketingShell, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { buildTrackData } from "./hypotheses-data";
import { HypothesesTracksChartSection } from "./HypothesesTracksChartSection";
import { HypothesesListSection } from "./HypothesesListSection";

export const metadata = {
  title: "Hypotheses — GAD",
  description:
    "Every research hypothesis GAD is tracking, which eval track tests it, what the data currently says, and links to the dedicated evidence page for each.",
};

export default function HypothesesIndexPage() {
  const chartData = buildTrackData();

  return (
    <MarketingShell>
      <SiteSection>
        <SiteSectionHeading
          kicker="Hypotheses"
          as="h1"
          preset="hero"
          title={
            <>
              Every research hypothesis, <span className="gradient-text">wired to its eval track.</span>
            </>
          }
        />
        <SiteProse className="mt-6">
          Each card below is one hypothesis the project is tracking, the eval track that tests it, the latest evidence,
          and a link to the dedicated page for deeper reading. Every hypothesis also has an entry on{" "}
          <Link href="/skeptic" className="text-accent underline decoration-dotted">
            /skeptic
          </Link>{" "}
          holding it to its strongest critique — read that before trusting any claim here.
        </SiteProse>
        <SiteProse size="sm" className="mt-4">
          Labels: <strong className="text-foreground">preliminary observation</strong> means we have seen a pattern and
          named it, but sample size is too small to call it a finding.{" "}
          <strong className="text-foreground">discussing</strong> means we are still working out what the hypothesis even
          claims. <strong className="text-foreground">operationalized</strong> means it has a concrete computable
          definition. <strong className="text-foreground">not yet tested</strong> means no runs have produced data
          against it.
        </SiteProse>
      </SiteSection>

      <HypothesesTracksChartSection data={chartData} />
      <HypothesesListSection />
    </MarketingShell>
  );
}
