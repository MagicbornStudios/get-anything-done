import type { Workflow } from "@/lib/catalog.generated";
import { Badge } from "@/components/ui/badge";
import { WorkflowMermaidDiagram } from "./WorkflowMermaidDiagram";
import { WorkflowLiveDiagram, type LiveWorkflow } from "./WorkflowLiveDiagram";

interface Props {
  workflow: Workflow;
  depth?: number;
  /** Compact mode: smaller diagrams, tighter padding, condensed header. Used for emergent grid. */
  compact?: boolean;
}

/**
 * One workflow card. Two shapes:
 *
 * - **Authored** (origin="authored"): full card with metadata, participant
 *   badges, and side-by-side Mermaid (expected) + React Flow (live/actual).
 *   Authored workflows are the ones we designed, so they have an expected
 *   shape worth diffing against. Mermaid renders that expected shape crisply
 *   and cheaply; React Flow renders the actual observed run from trace data.
 *
 * - **Emergent** (origin="emergent"): single-column React-Flow-only card.
 *   Emergent workflows were discovered by the trace-mining detector — they
 *   have no expected shape because nobody authored them, so there is no
 *   Mermaid pane. The React Flow graph IS the workflow. Compact mode
 *   further shrinks the card for the emergent grid layout on /planning.
 */
export function WorkflowCard({ workflow, depth = 0, compact = false }: Props) {
  const indent = depth > 0 ? "ml-4 border-l border-border/40 pl-4 md:ml-6 md:pl-6" : "";
  const isEmergent = workflow.origin === "emergent";

  const liveWorkflow: LiveWorkflow | null = workflow.liveGraph
    ? {
        slug: workflow.slug,
        nodes: workflow.liveGraph.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: { label: n.data.label, kind: n.data.kind, count: n.data.count },
        })),
        edges: workflow.liveGraph.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          animated: e.animated,
        })),
      }
    : null;

  const conformance = workflow.conformance;
  const support = workflow.support;

  if (isEmergent) {
    return (
      <article
        id={`workflow-${workflow.slug}`}
        className={`rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 ${compact ? "" : "p-5"}`}
        aria-labelledby={`workflow-${workflow.slug}-title`}
      >
        <header className={compact ? "mb-2" : "mb-3"}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">emergent</Badge>
            {support && (
              <Badge variant="outline" className="text-[10px]">
                {support.phases}× support
              </Badge>
            )}
            {workflow.detector && (
              <Badge
                variant="outline"
                className={`text-[9px] ${workflow.detector.startsWith("skill") ? "border-sky-500/40" : "border-amber-500/40 text-amber-200/80"}`}
                title={workflow.detector.startsWith("skill") ? "Mined from trigger_skill-tagged events" : "v1 fallback — raw tool-name mining; will be replaced once skills tag via --skill"}
              >
                {workflow.detector}
              </Badge>
            )}
          </div>
          <h3
            id={`workflow-${workflow.slug}-title`}
            className={`mt-1.5 font-semibold text-foreground ${compact ? "text-sm" : "text-base"}`}
          >
            {workflow.name}
          </h3>
          {!compact && (
            <p className="mt-1 text-xs text-muted-foreground">{workflow.description}</p>
          )}
        </header>
        <WorkflowLiveDiagram
          workflow={liveWorkflow}
          compact={compact}
          emptyMessage="Detector is still mining this pattern."
        />
      </article>
    );
  }

  // Authored layout
  const participants = workflow.participants;
  const allParticipants = [
    ...participants.skills.map((v) => ({ kind: "skill" as const, value: v })),
    ...participants.agents.map((v) => ({ kind: "agent" as const, value: v })),
    ...participants.cli.map((v) => ({ kind: "cli" as const, value: v })),
  ];

  return (
    <article
      id={`workflow-${workflow.slug}`}
      className={`${indent} rounded-lg border border-sky-500/30 bg-card/40 p-5`}
      aria-labelledby={`workflow-${workflow.slug}-title`}
    >
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">authored</Badge>
          {conformance && (
            <Badge
              variant="outline"
              className="text-[10px]"
              title={`matched=${conformance.matched}, extra=${conformance.extra}, out_of_order=${conformance.out_of_order}, expected=${conformance.expected}`}
            >
              conformance {(conformance.score * 100).toFixed(0)}%
            </Badge>
          )}
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
          {workflow.mermaidBody ? (
            <WorkflowMermaidDiagram source={workflow.mermaidBody} slug={workflow.slug} />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/10 text-xs text-muted-foreground">
              No authored diagram
            </div>
          )}
        </section>
        <section aria-label="Live graph (React Flow)">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Live (actual)</span>
            <span className="text-[10px] opacity-60">react flow</span>
          </div>
          <WorkflowLiveDiagram workflow={liveWorkflow} />
        </section>
      </div>
    </article>
  );
}
