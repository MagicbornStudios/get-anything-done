import { buildDataSourcesFromPayload, getDbViewerSourcePathFromPayload } from "./data-shared";
import { Identified } from "@/components/devid/Identified";
import { MarketingShell } from "@/components/site";
import DataHeroSection from "./DataHeroSection";
import { loadDbViewerPayload } from "./db-loader";

export const metadata = {
  title: "Local DB — GAD",
  description:
    "Indexed site data sources and field lineage: where each number comes from, how it is derived, and trust level. Aligns with the `gad data` /data JSON catalog.",
};

export default async function DataPage() {
  const { payload, source, fallback } = await loadDbViewerPayload();
  const sources = buildDataSourcesFromPayload(payload);
  const sourcePath = getDbViewerSourcePathFromPayload(payload);
  const dbSourcePath = source === "mongo" ? `mongo:${process.env.MONGODB_DB || "db"}/db_viewer_payload#latest` : sourcePath;

  return (
    <MarketingShell>
      <Identified as="DataHeroSection">
        <DataHeroSection sources={sources} dbPayload={payload} dbSourcePath={dbSourcePath} />
      </Identified>
      {fallback ? (
        <p className="px-4 py-2 text-xs text-muted-foreground">Mongo fallback: {fallback}</p>
      ) : null}
    </MarketingShell>
  );
}
