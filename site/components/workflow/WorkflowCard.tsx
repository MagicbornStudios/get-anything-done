import type { Workflow } from "@/lib/catalog.generated";
import { Badge } from "@/components/ui/badge";
import { WorkflowMermaidDiagram } from "./WorkflowMermaidDiagram";
import { WorkflowLiveDiagram } from "./WorkflowLiveDiagram";

interface Props {
  workflow: Workflow;
  depth?: number;
}

/**
 * One expandable workflow card — title, trigger, participants badge row,
 * side-by-side authored (Mermaid) and live (React Flow) diagrams.
 *
 * Authored diagrams render from the hand-authored mermaid body in the
 * workflow's .planning/workflows/<slug>.md file. Live diagrams are empty
 * until trace synthesis (42.3-04) lands real data.
 */
export function WorkflowCard({ workflow, depth = 0 }: Props) {
  const indent = depth > 0 ? "ml-4 border-l border-border/40 pl-4 md:ml-6 md:pl-6" : "";
  const participants = workflow.participants;
  const allParticipants = [
    ...participants.skills.map((v) => ({ kind: "skill" as const, value: v })),
    ...participants.agents.map((v) => ({ kind: "agent" as const, value: v })),
    ...participants.cli.map((v) => ({ kind: "cli" as const, value: v })),
  ];

  return (
    <article
      id={`workflow-${workflow.slug}`}
      className={`${indent} rounded-lg border border-border/60 bg-card/40 p-5`}
      aria-labelledby={`workflow-${workflow.slug}-title`}
    >
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={workflow.origin === "emergent" ? "secondary" : "outline"}>
            {workflow.origin}
          </Badge>
          {workflow.parentWorkflow && (
            <span className="text-[11px] text-muted-foreground">
              nested under <code className="text-foreground/80">{workflow.parentWorkflow}</code>
            </span>
          )}
          {workflow.relatedPhases.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              · phase {workflow.relatedPhases.join(", ")}
            </span>
          )}
        </div>
        <h3
          id={`workflow-${workflow.slug}-title`}
          className="mt-2 text-lg font-semibold text-foreground"
        >
          {workflow.name}
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{workflow.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">Trigger:</span> {workflow.trigger}
        </p>
        {allParticipants.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {allParticipants.map((p, i) => (
              <Badge key={`${p.kind}-${p.value}-${i}`} variant="outline" className="text-[10px]">
                <span className="mr-1 opacity-60">{p.kind}</span>
                {p.value}
              </Badge>
            ))}
          </div>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Authored graph (Mermaid)">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Authored (expected)</span>
            <span className="text-[10px] opacity-60">mermaid</span>
          </div>
          <WorkflowMermaidDiagram source={workflow.mermaidBody} slug={workflow.slug} />
        </section>
        <section aria-label="Live graph (React Flow)">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Live (actual)</span>
            <span className="text-[10px] opacity-60">react flow</span>
          </div>
          <WorkflowLiveDiagram workflow={null} />
        </section>
      </div>
    </article>
  );
}
