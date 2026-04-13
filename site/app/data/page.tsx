import { buildDataSources, groupBySurface } from "./data-shared";
import { Identified } from "@/components/devid/Identified";
import { MarketingShell } from "@/components/site";
import DataHeroSection from "./DataHeroSection";
import DataTrustLevelsSection from "./DataTrustLevelsSection";
import DataSurfaceSection from "./DataSurfaceSection";

export const metadata = {
  title: "Local DB — GAD",
  description:
    "Indexed site data sources and field lineage: where each number comes from, how it is derived, and trust level. Aligns with the `gad data` /data JSON catalog.",
};

export default function DataPage() {
  const sources = buildDataSources();
  const grouped = groupBySurface(sources);
  const totals = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.trust] = (acc[s.trust] || 0) + 1;
    return acc;
  }, {});

  return (
    <MarketingShell>
      <Identified as="DataHeroSection">
        <DataHeroSection totals={totals} />
      </Identified>
      <Identified as="DataTrustLevelsSection">
        <DataTrustLevelsSection />
      </Identified>
      {grouped.map(([surface, surfaceSources]) => {
        const surfaceSlug = surface.replace(/[^a-zA-Z0-9]+/g, "-");
        return (
          <Identified key={surface} as={`DataSurfaceSection-${surfaceSlug}`}>
            <DataSurfaceSection surface={surface} sources={surfaceSources} />
          </Identified>
        );
      })}
    </MarketingShell>
  );
}
