import { buildDataSources } from "./data-shared";
import { Identified } from "@/components/devid/Identified";
import { MarketingShell } from "@/components/site";
import DataHeroSection from "./DataHeroSection";

export const metadata = {
  title: "Local DB — GAD",
  description:
    "Indexed site data sources and field lineage: where each number comes from, how it is derived, and trust level. Aligns with the `gad data` /data JSON catalog.",
};

export default function DataPage() {
  const sources = buildDataSources();

  return (
    <MarketingShell>
      <Identified as="DataHeroSection">
        <DataHeroSection sources={sources} />
      </Identified>
    </MarketingShell>
  );
}
