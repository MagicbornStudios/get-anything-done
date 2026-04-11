import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  PROJECT_LABELS,
  WORKFLOW_LABELS,
  type EvalProjectMeta,
  type Workflow,
} from "@/lib/eval-data";
import { formatBytes, REPO } from "@/app/projects/[id]/project-detail-shared";

type PlanningZip = { zipPath: string; bytes: number } | undefined;
type TemplateZip = { zipPath: string; bytes: number } | undefined;

export function ProjectHeroSection({
  project,
  planning,
  template,
}: {
  project: EvalProjectMeta;
  planning: PlanningZip;
  template: TemplateZip;
}) {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <Link
          href="/#projects"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden />
          Back to projects
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="default">eval project</Badge>
          {project.workflow && (
            <Badge variant="outline">
              {WORKFLOW_LABELS[project.workflow as Workflow] ?? project.workflow}
            </Badge>
          )}
          {project.evalMode && <Badge variant="outline">{project.evalMode}</Badge>}
          {project.baseline && (
            <Badge variant="outline">
              baseline:{" "}
              {typeof project.baseline === "string"
                ? project.baseline
                : `${project.baseline.project ?? "?"}/${project.baseline.version ?? "?"}`}
            </Badge>
          )}
        </div>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
          {PROJECT_LABELS[project.id] ?? project.name}
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">{project.id}</p>
        {project.description && (
          <p className="mt-5 max-w-3xl text-lg leading-8 text-foreground">{project.description}</p>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          {planning && (
            <a
              href={planning.zipPath}
              download
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold text-accent-foreground hover:-translate-y-0.5 transition-transform"
            >
              <Download size={14} aria-hidden />
              planning.zip ({formatBytes(planning.bytes)})
            </a>
          )}
          {template && (
            <a
              href={template.zipPath}
              download
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-5 py-2.5 text-xs font-semibold text-foreground hover:border-accent hover:text-accent transition-colors"
            >
              <Package size={14} aria-hidden />
              template.zip ({formatBytes(template.bytes)})
            </a>
          )}
          <a
            href={`${REPO}/tree/main/evals/${project.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-5 py-2.5 text-xs font-semibold text-foreground hover:border-accent hover:text-accent transition-colors"
          >
            <ExternalLink size={12} aria-hidden />
            Source on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
