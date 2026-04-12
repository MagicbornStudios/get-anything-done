import { Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import type { DataSource } from "./data-shared";
import DataSourceCard from "./DataSourceCard";

export default function DataSurfaceSection({
  surface,
  sources,
}: {
  surface: string;
  sources: DataSource[];
}) {
  return (
    <SiteSection
      id={`surface-${surface.toLowerCase().replace(/\s+/g, "-")}`}
      className="last:bg-background"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SiteSectionHeading
          icon={Database}
          kicker={surface}
          kickerRowClassName="mb-0 flex-1 gap-3"
          className="min-w-0 flex-1"
        />
        <Badge variant="outline" className="shrink-0">
          {sources.length}
        </Badge>
      </div>
      <div className="space-y-3">
        {sources.map((s) => (
          <DataSourceCard key={s.id} source={s} />
        ))}
      </div>
    </SiteSection>
  );
}
