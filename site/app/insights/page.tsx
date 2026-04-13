import { Identified } from "@/components/devid/Identified";
import { MarketingShell, SiteMetricCard, SiteSection } from "@/components/site";
import { InsightsDataSourcesCard } from "@/app/insights/InsightsDataSourcesCard";
import { InsightsPageIntro } from "@/app/insights/InsightsPageIntro";
import { buildDataSources, buildInsights } from "@/app/insights/insights-queries";

export const metadata = {
  title: "Insights — structured data from GAD evals + self-evaluation",
  description:
    "Curated queries against eval traces, planning artifacts, and self-evaluation metrics. Every number has a source.",
};

export default function InsightsPage() {
  const insights = buildInsights();
  const dataSources = buildDataSources();

  return (
    <MarketingShell>
      <SiteSection>
        <Identified as="InsightsPageIntro">
          <InsightsPageIntro />
        </Identified>

        <Identified as="InsightsMetricGrid" tag="ul" className="mt-12 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((q, i) => (
            <li key={q.label}>
              <Identified as={`InsightsMetricCard-${i}`}>
                <SiteMetricCard label={q.label} value={q.result} />
              </Identified>
            </li>
          ))}
        </Identified>

        <Identified as="InsightsDataSourcesCard">
          <InsightsDataSourcesCard sources={dataSources} />
        </Identified>
      </SiteSection>
    </MarketingShell>
  );
}
