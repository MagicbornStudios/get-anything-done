import { Badge } from "@/components/ui/badge";
import { Identified } from "@/components/devid/Identified";
import type { RequirementsVersion } from "@/lib/catalog.generated";

export function PlanningRequirementsTab({ versions }: { versions: RequirementsVersion[] }) {
  if (versions.length === 0) {
    return (
      <Identified as="PlanningRequirementsTabEmpty">
        <p className="text-sm text-muted-foreground">No requirements versions found.</p>
      </Identified>
    );
  }

  return (
    <div className="space-y-4">
      {versions.map((v) => (
        <Identified key={v.version} as={`PlanningRequirementsTabVersion-${v.version}`} className="rounded-xl border border-border/60 bg-card/40 p-5">
          <div className="mb-3 flex items-center gap-3">
            <Badge variant="default">{v.version}</Badge>
            {v.date && <span className="text-xs text-muted-foreground">{v.date}</span>}
          </div>
          {v.sections &&
            Object.entries(v.sections).map(([key, value]) => (
              <div key={key} className="mt-3">
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {key.replace(/_/g, " ")}
                </h4>
                <p className="whitespace-pre-line text-xs leading-5 text-foreground">{value}</p>
              </div>
            ))}
        </Identified>
      ))}
    </div>
  );
}
