"use client";

import { useCallback, useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import { useCommandBridge } from "./use-command-bridge";

type GeneState = "integrated" | "expressed" | "mutations" | "shed";

type Action = {
  label: string;
  subcommand: string;
  args: string[];
  variant: "default" | "accent" | "danger";
};

const ACTIONS_BY_STATE: Record<GeneState, (slug: string) => Action[]> = {
  integrated: (slug) => [
    { label: "Show", subcommand: "skill", args: ["show", slug], variant: "default" },
    { label: "Show body", subcommand: "skill", args: ["show", slug, "--body"], variant: "default" },
  ],
  expressed: (slug) => [
    { label: "Status", subcommand: "try", args: ["status"], variant: "default" },
    { label: "Cleanup", subcommand: "try", args: ["cleanup", slug], variant: "danger" },
  ],
  mutations: (slug) => [
    { label: "Validate", subcommand: "evolution", args: ["validate", slug], variant: "default" },
    { label: "Promote", subcommand: "evolution", args: ["promote", slug], variant: "accent" },
  ],
  shed: (slug) => [
    { label: "Review", subcommand: "skill", args: ["show", slug], variant: "default" },
  ],
};

type Props = {
  slug: string;
  geneState: GeneState;
  onOutput?: (lines: string[]) => void;
};

export function DnaActionRow({ slug, geneState, onOutput }: Props) {
  const { state, run } = useCommandBridge();
  const [lastAction, setLastAction] = useState<string | null>(null);
  const actions = ACTIONS_BY_STATE[geneState](slug);

  const handleAction = useCallback(
    async (action: Action) => {
      setLastAction(action.label);
      await run({ subcommand: action.subcommand, args: action.args });
    },
    [run],
  );

  // Collect output lines for the parent
  const outputLines =
    state.kind === "done" || state.kind === "running"
      ? state.lines.filter((l) => l.stream === "stdout").map((l) => l.text)
      : [];

  return (
    // cid prototype: dna-action-row-<slug>-site-section
    <SiteSection
      cid={`dna-action-row-${slug}-site-section` as const}
      sectionShell={false}
      className="border-b-0"
      allowContextPanel={false}
    >
      <div className="flex items-center gap-1 mt-1">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => handleAction(action)}
            disabled={state.kind === "running"}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              "border disabled:opacity-50",
              action.variant === "accent" &&
                "border-accent/40 text-accent hover:bg-accent/10",
              action.variant === "danger" &&
                "border-red-400/40 text-red-400 hover:bg-red-400/10",
              action.variant === "default" &&
                "border-border/40 text-muted-foreground hover:text-foreground hover:bg-card/50",
            )}
          >
            {action.label}
          </button>
        ))}
        {state.kind === "running" && lastAction && (
          <span className="text-[9px] text-muted-foreground animate-pulse ml-1">
            {lastAction}...
          </span>
        )}
      </div>

      {/* Inline output */}
      {(state.kind === "done" || state.kind === "error") && outputLines.length > 0 && (
        <pre className="mt-1 max-h-24 overflow-y-auto rounded bg-black/30 p-1.5 text-[10px] font-mono text-foreground/70 leading-tight">
          {outputLines.join("\n")}
        </pre>
      )}
    </SiteSection>
  );
}
