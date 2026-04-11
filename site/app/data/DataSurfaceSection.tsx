import { Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <section
      id={`surface-${surface.toLowerCase().replace(/\s+/g, "-")}`}
      className="border-b border-border/60 last:bg-background"
    >
      <div className="section-shell">
        <div className="mb-6 flex items-center gap-3">
          <Database size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">{surface}</p>
          <Badge variant="outline">{sources.length}</Badge>
        </div>
        <div className="space-y-3">
          {sources.map((s) => (
            <DataSourceCard key={s.id} source={s} />
          ))}
        </div>
      </div>
    </section>
  );
}
