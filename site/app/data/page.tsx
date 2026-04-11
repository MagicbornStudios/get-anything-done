import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { buildDataSources, groupBySurface } from "./data-shared";
import DataHeroSection from "./DataHeroSection";
import DataTrustLevelsSection from "./DataTrustLevelsSection";
import DataSurfaceSection from "./DataSurfaceSection";

export const metadata = {
  title: "Data provenance — GAD",
  description:
    "Every chart and number on this site, with its source field, derivation formula, and trust level. Inline + indexed transparency.",
};

export default function DataPage() {
  const sources = buildDataSources();
  const grouped = groupBySurface(sources);
  const totals = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.trust] = (acc[s.trust] || 0) + 1;
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <DataHeroSection totals={totals} />
      <DataTrustLevelsSection />
      {grouped.map(([surface, surfaceSources]) => (
        <DataSurfaceSection key={surface} surface={surface} sources={surfaceSources} />
      ))}

      <Footer />
    </main>
  );
}
