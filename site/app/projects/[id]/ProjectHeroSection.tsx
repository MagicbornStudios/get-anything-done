import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        <Button
          variant="ghost"
          className="mb-6 h-auto gap-2 px-0 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
          asChild
        >
          <Link href="/#projects">
            <ArrowLeft size={14} aria-hidden />
            Back to projects
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="default">eval project</Badge>
          {project.domain && (
            <Badge variant="secondary">{project.domain}</Badge>
          )}
          {project.techStack && (
            <Badge variant="secondary">{project.techStack}</Badge>
          )}
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
            <Button
              size="sm"
              className="gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5 hover:bg-accent/90 [&_svg]:size-3.5"
              asChild
            >
              <a href={planning.zipPath} download>
                <Download size={14} aria-hidden />
                planning.zip ({formatBytes(planning.bytes)})
              </a>
            </Button>
          )}
          {template && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full border-border/70 bg-card/40 px-5 py-2.5 text-xs font-semibold hover:border-accent hover:text-accent [&_svg]:size-3.5"
              asChild
            >
              <a href={template.zipPath} download>
                <Package size={14} aria-hidden />
                template.zip ({formatBytes(template.bytes)})
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-full border-border/70 bg-card/40 px-5 py-2.5 text-xs font-semibold hover:border-accent hover:text-accent [&_svg]:size-3"
            asChild
          >
            <a href={`${REPO}/tree/main/evals/${project.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} aria-hidden />
              Source on GitHub
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
