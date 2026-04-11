import { WorkflowMermaidDiagram } from "@/components/landing/workflow/WorkflowMermaidDiagram";

type Props = {
  diagram: string;
  mermaidId: string;
  caption: string;
};

export function WorkflowDiagramPanel({ diagram, mermaidId, caption }: Props) {
  return (
    <>
      <div className="rounded-2xl border border-border/70 bg-background/40 p-4 md:p-8">
        <WorkflowMermaidDiagram diagram={diagram} id={mermaidId} />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{caption}</p>
    </>
  );
}
