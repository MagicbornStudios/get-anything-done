import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Identified } from "@/components/devid/Identified";
import { EVAL_PROJECTS, WORKFLOW_LABELS, type Workflow } from "@/lib/eval-data";
import { SiteSection } from "@/components/site";

const WORKFLOW_TINT: Record<Workflow, string> = {
  gad: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  bare: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  emergent: "bg-amber-500/15 text-amber-300 border-amber-500/40",
};

function buildExampleJson(dimensions: Array<{ key: string; weight: number }>): string {
  return `{${dimensions.map((d) => `"${d.key}": 0.80`).join(", ")}}`;
}

export function MethodologyCliReviewSection() {
  const projects = EVAL_PROJECTS.filter(
    (p) => p.humanReviewRubric && p.humanReviewRubric.dimensions.length > 0,
  );
  if (projects.length === 0) return null;

  return (
    <SiteSection id="cli-review" className="border-t border-border/60">
      <Identified as="MethodologyCliReviewSection">
      <Identified as="MethodologyCliReviewIntro">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Submit a review</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          Each project ships with a rubric. Score a run against it with the{" "}
          <code className="rounded bg-background/60 px-1 py-0.5">gad eval review</code> CLI — the
          weighted aggregate lands in that run&apos;s{" "}
          <code className="rounded bg-background/60 px-1 py-0.5">TRACE.json</code> automatically.
        </p>
      </Identified>

      <div className="mt-8 space-y-6">
        {projects.map((project) => {
          const rubric = project.humanReviewRubric!;
          const workflow = (project.workflow ?? "gad") as Workflow;
          const exampleJson = buildExampleJson(rubric.dimensions);
          return (
            <Identified
              key={project.id}
              as={`MethodologyCliReviewProject-${project.id}`}
              className="rounded-2xl border border-border/70 bg-card/40 p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${WORKFLOW_TINT[workflow]}`}
                >
                  {WORKFLOW_LABELS[workflow]}
                </span>
                <span className="text-sm font-semibold text-foreground">{project.name}</span>
                <Badge variant="outline">rubric {rubric.version}</Badge>
                <Badge variant="outline">{rubric.dimensions.length} dimensions</Badge>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Terminal size={14} className="text-accent" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  CLI
                </p>
              </div>
              <pre className="mt-2 overflow-x-auto whitespace-pre rounded-md bg-background/60 p-3 font-mono text-xs leading-6 text-muted-foreground">
                {`gad eval review ${project.id} v<N> \\
  --rubric '${exampleJson}' \\
  --notes "what landed, what broke, what surprised you"`}
              </pre>
              <Link
                href={`/projects/${project.id}`}
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                See every run for this project
                <ArrowRight size={11} aria-hidden />
              </Link>
            </Identified>
          );
        })}
      </div>
      </Identified>
    </SiteSection>
  );
}
