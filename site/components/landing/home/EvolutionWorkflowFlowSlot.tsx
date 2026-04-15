"use client";

import dynamic from "next/dynamic";

const EvolutionWorkflowFlow = dynamic(
  () => import("./EvolutionWorkflowFlow").then((m) => m.EvolutionWorkflowFlow),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-[360px] max-h-[50vh] min-h-[280px] items-center justify-center rounded-2xl border border-border/60 bg-muted/10 text-xs text-muted-foreground"
        aria-hidden
      >
        Loading workflow…
      </div>
    ),
  },
);

/** Client-only mount for React Flow (`ssr: false` cannot live in a Server Component). */
export function EvolutionWorkflowFlowSlot() {
  return <EvolutionWorkflowFlow />;
}
