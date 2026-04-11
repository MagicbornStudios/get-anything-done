import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EvalProjectMeta, Workflow } from "@/lib/eval-data";
import { RubricDimensionCard } from "@/app/rubric/RubricDimensionCard";
import {
  buildRubricExampleJson,
  WORKFLOW_LABELS,
  WORKFLOW_TINT,
} from "@/app/rubric/rubric-shared";

export function RubricProjectSection({ project }: { project: EvalProjectMeta }) {
  const rubric = project.humanReviewRubric!;
  const workflow = (project.workflow ?? "gad") as Workflow;
  const totalWeight = rubric.dimensions.reduce((acc, d) => acc + d.weight, 0);
  const exampleJson = buildRubricExampleJson(rubric.dimensions);

  return (
    <section id={project.id} className="border-b border-border/60">
      <div className="section-shell">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${WORKFLOW_TINT[workflow]}`}
          >
            {WORKFLOW_LABELS[workflow]}
          </span>
          <Badge variant="outline">rubric {rubric.version}</Badge>
          <Badge variant="outline">
            {rubric.dimensions.length} dimensions · Σ {totalWeight.toFixed(2)}
          </Badge>
        </div>

        <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{project.name}</h2>
        {project.description && (
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            {project.description}
          </p>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {rubric.dimensions.map((dim) => (
            <RubricDimensionCard key={dim.key} dim={dim} />
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-border/70 bg-card/40 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Terminal size={14} className="text-accent" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Submit a review
            </p>
          </div>
          <pre className="overflow-x-auto whitespace-pre font-mono text-xs leading-6 text-muted-foreground">
            {`gad eval review ${project.id} v<N> \\
  --rubric '${exampleJson}' \\
  --notes "what landed, what broke, what surprised you"`}
          </pre>
          <p className="mt-3 text-xs text-muted-foreground">
            Replace each <code className="rounded bg-background/60 px-1 py-0.5">0.80</code> with your
            real score. The CLI computes the weighted aggregate and writes it to that run&apos;s{" "}
            <code className="rounded bg-background/60 px-1 py-0.5">TRACE.json</code>.
          </p>
          <Link
            href={`/projects/${project.id}`}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            See every run for this project
            <ArrowRight size={11} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
