import { SiteSection, SiteSectionHeading } from "@/components/site";
import { BUGS } from "@/lib/eval-data";
import { ProjectBugRow } from "./ProjectBugRow";

export function ProjectBugsSection({ projectId }: { projectId: string }) {
  // Match bugs to this project or any in its family (e.g., escape-the-dungeon-bare matches escape-the-dungeon)
  const bugs = BUGS.filter(
    (b) => b.project === projectId || projectId.startsWith(b.project + "-") || b.project?.startsWith(projectId)
  );

  if (bugs.length === 0) return null;

  // Task 44-16: SiteSection cid is the canonical handle; the outer Identified
  // wrapper that just restated "ProjectBugs" was removed.
  return (
    <SiteSection cid="project-bugs-section-site-section" className="border-b-0 border-t border-border/60">
      <SiteSectionHeading
        kicker="Known bugs"
        preset="section"
        titleClassName="text-2xl font-semibold tracking-tight"
        title={`${bugs.length} bug${bugs.length !== 1 ? "s" : ""} reported`}
      />
      <div className="mt-6 space-y-3">
        {bugs.map((b) => (
          <ProjectBugRow key={b.id} bug={b} />
        ))}
      </div>
    </SiteSection>
  );
}
