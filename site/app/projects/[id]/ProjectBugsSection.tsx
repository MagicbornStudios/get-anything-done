import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { BUGS } from "@/lib/eval-data";

export function ProjectBugsSection({ projectId }: { projectId: string }) {
  // Match bugs to this project or any in its family (e.g., escape-the-dungeon-bare matches escape-the-dungeon)
  const bugs = BUGS.filter(
    (b) => b.project === projectId || projectId.startsWith(b.project + "-") || b.project?.startsWith(projectId)
  );

  if (bugs.length === 0) return null;

  return (
    <SiteSection className="border-b-0 border-t border-border/60">
      <SiteSectionHeading
        kicker="Known bugs"
        preset="section"
        titleClassName="text-2xl font-semibold tracking-tight"
        title={`${bugs.length} bug${bugs.length !== 1 ? "s" : ""} reported`}
      />
      <Identified as="ProjectBugs" className="mt-6 space-y-3">
        {bugs.map((b) => (
          <div
            key={b.id}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
          >
            <Badge
              variant={b.status === "resolved" ? "success" : b.status === "wontfix" ? "outline" : "danger"}
              className="shrink-0"
            >
              {b.status}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{b.title}</p>
              {b.version && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Found in {b.project}/{b.version}
                </p>
              )}
              {b.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{b.description}</p>
              )}
            </div>
          </div>
        ))}
      </Identified>
    </SiteSection>
  );
}
