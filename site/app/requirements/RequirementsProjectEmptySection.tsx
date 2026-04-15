import { PROJECT_LABELS } from "@/app/requirements/requirements-shared";
import { SiteSection } from "@/components/site";

export function RequirementsProjectEmptySection({ project }: { project: string }) {
  return (
    <SiteSection id={project} cid={`${project}-site-section`} tone="muted">
      <h2 className="text-2xl font-semibold tracking-tight">
        {PROJECT_LABELS[project] ?? project}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">No REQUIREMENTS.xml content loaded.</p>
    </SiteSection>
  );
}

