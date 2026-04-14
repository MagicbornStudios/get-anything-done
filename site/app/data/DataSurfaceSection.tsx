import { Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Identified } from "@/components/devid/Identified";
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
      <Identified as={`DataSurfaceHeader-${surface.replace(/[^a-zA-Z0-9]+/g, "-")}`} className="mb-6 flex flex-wrap items-center gap-3">
        <SiteSectionHeading
          icon={Database}
          kicker={surface}
          kickerRowClassName="mb-0 flex-1 gap-3"
          className="min-w-0 flex-1"
        />
        <Badge variant="outline" className="shrink-0">
          {sources.length}
        </Badge>
      </Identified>
      <div className="space-y-3">
        {sources.map((s) => (
          <Identified key={s.id} as={`DataSourceCard-${s.id}`}>
            <DataSourceCard source={s} />
          </Identified>
        ))}
      </div>
    </SiteSection>
  );
}

