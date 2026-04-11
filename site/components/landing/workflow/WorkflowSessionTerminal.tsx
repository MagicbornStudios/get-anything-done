import { Terminal } from "lucide-react";
import { WORKFLOW_EXAMPLE_CONVERSATION } from "@/components/landing/workflow/workflow-shared";
import { WorkflowSessionTurn } from "@/components/landing/workflow/WorkflowSessionTurn";

export function WorkflowSessionTerminal() {
  return (
    <>
      <h3 className="mt-16 text-2xl font-semibold tracking-tight">What it looks like in the terminal</h3>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Abbreviated example of a real session — planning phase 19 with the CLI and subagents
        driving the work, the user stays out of the micromanagement.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-background/60">
        <div className="flex items-center gap-2 border-b border-border/60 bg-card/40 px-5 py-3">
          <Terminal size={14} className="text-accent" aria-hidden />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            example session
          </span>
        </div>
        <ul className="divide-y divide-border/40">
          {WORKFLOW_EXAMPLE_CONVERSATION.map((turn, i) => (
            <WorkflowSessionTurn key={i} turn={turn} />
          ))}
        </ul>
      </div>
    </>
  );
}
