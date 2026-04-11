import { PROJECT_LABELS } from "@/app/requirements/requirements-shared";

export function RequirementsProjectEmptySection({ project }: { project: string }) {
  return (
    <section id={project} className="border-b border-border/60 bg-card/20">
      <div className="section-shell">
        <h2 className="text-2xl font-semibold tracking-tight">
          {PROJECT_LABELS[project] ?? project}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">No REQUIREMENTS.xml content loaded.</p>
      </div>
    </section>
  );
}
