import type { HumanWorkflow } from "@/lib/catalog.generated";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";
import { WorkflowMermaidDiagram } from "@/components/workflow/WorkflowMermaidDiagram";

interface Props {
  workflows: readonly HumanWorkflow[];
}

/**
 * /planning -> Workflows tab → Human workflows band (task 44-22). Hand-authored operator
 * routines that are a deliberately separate surface from the authored
 * agent workflows on the Workflows tab:
 *  - no trace matching, no conformance score
 *  - frontmatter shape is different (operator / frequency / triggers /
 *    projects-touched)
 *  - Mermaid is optional (body is mostly prose)
 *
 * Lives under .planning/human-workflows/*.md. See that dir's README.md
 * for the authoring contract.
 */
export function PlanningTabHumanWorkflows({ workflows }: Props) {
  return (
    <SiteSection cid="planning-human-workflows-site-section">
      <Identified as="PlanningTabHumanWorkflows">
        <div className="space-y-8">
          <MethodologyCallout />

          <header className="border-l-4 border-violet-500/40 pl-4">
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Human workflows
              </h2>
              <span className="tabular-nums text-sm text-muted-foreground">
                {workflows.length}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Hand-authored operator routines. What the human at the keyboard
              is expected to do — distinct from the agent workflows trace
              pipeline matches against.
            </p>
          </header>

          {workflows.length === 0 ? (
            <EmptyState message="No human workflows. Add files under .planning/human-workflows/." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {workflows.map((w) => (
                <HumanWorkflowCard key={w.slug} workflow={w} />
              ))}
            </div>
          )}
        </div>
      </Identified>
    </SiteSection>
  );
}

function HumanWorkflowCard({ workflow }: { workflow: HumanWorkflow }) {
  const firstPara = extractFirstParagraph(workflow.bodyRaw);
  return (
    <article
      id={`human-workflow-${workflow.slug}`}
      className="rounded-md border border-border/60 bg-muted/10 p-4 space-y-3"
    >
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            {workflow.name}
          </h3>
          <span className="shrink-0 rounded-sm border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-violet-300">
            {workflow.operator}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {workflow.frequency && (
            <span className="rounded-sm border border-border/60 bg-background/50 px-1.5 py-0.5 text-muted-foreground">
              {workflow.frequency}
            </span>
          )}
          {workflow.triggers.map((t) => (
            <Chip key={`trig-${t}`} tone="trigger">
              {t}
            </Chip>
          ))}
        </div>
        {workflow.projectsTouched.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              touches
            </span>
            {workflow.projectsTouched.map((p) => (
              <Chip key={`proj-${p}`} tone="project">
                {p}
              </Chip>
            ))}
          </div>
        )}
      </header>

      {firstPara && (
        <p className="text-sm leading-6 text-muted-foreground">{firstPara}</p>
      )}

      {workflow.mermaidBody && (
        <WorkflowMermaidDiagram source={workflow.mermaidBody} slug={workflow.slug} />
      )}
    </article>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "trigger" | "project";
}) {
  const cls =
    tone === "trigger"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : "border-sky-500/40 bg-sky-500/10 text-sky-200";
  return (
    <span className={`rounded-sm border px-1.5 py-0.5 ${cls}`}>{children}</span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

function MethodologyCallout() {
  return (
    <details className="rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-foreground/90">
        What this tab is
      </summary>
      <div className="mt-2 space-y-2 leading-6">
        <p>
          Hand-authored operator routines live under
          {" "}
          <code className="text-foreground/80">.planning/human-workflows/*.md</code>.
          Unlike the Workflows tab, there is no trace pipeline matching these
          against observed sessions — they describe what the human is supposed
          to do, not what an agent is expected to do.
        </p>
        <p>
          Eventually cross-referenced with trace data (task 44-21) to flag
          when an observed session diverges from the expected routine.
        </p>
      </div>
    </details>
  );
}

function extractFirstParagraph(src: string): string {
  // Strip leading H1 if present, then grab the first non-empty paragraph
  // that isn't a fenced code block.
  const lines = src.split(/\r?\n/);
  const paras: string[] = [];
  let buf: string[] = [];
  let inFence = false;
  for (const raw of lines) {
    const line = raw;
    if (line.startsWith("```")) {
      inFence = !inFence;
      if (buf.length > 0) {
        paras.push(buf.join(" ").trim());
        buf = [];
      }
      continue;
    }
    if (inFence) continue;
    if (line.trim() === "") {
      if (buf.length > 0) {
        paras.push(buf.join(" ").trim());
        buf = [];
      }
    } else {
      buf.push(line.trim());
    }
  }
  if (buf.length > 0) paras.push(buf.join(" ").trim());
  const firstProse = paras.find((p) => p && !p.startsWith("#"));
  return firstProse || "";
}
