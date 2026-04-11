import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { InsightMetricCard } from "@/app/insights/InsightMetricCard";
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
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="section-shell">
        <InsightsPageIntro />

        <ul className="mt-12 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((q) => (
            <li key={q.label}>
              <InsightMetricCard label={q.label} value={q.result} />
            </li>
          ))}
        </ul>

        <InsightsDataSourcesCard sources={dataSources} />
      </div>
      <Footer />
    </main>
  );
}
