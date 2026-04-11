"use client";

import { ALL_PROJECTS } from "@/components/landing/experiment-log/experiment-log-shared";

type Props = {
  projectFilter: string | null;
  onProjectChange: (value: string | null) => void;
};

export function ExperimentLogProjectSelect({ projectFilter, onProjectChange }: Props) {
  return (
    <div className="relative">
      <select
        value={projectFilter ?? ""}
        onChange={(e) => onProjectChange(e.target.value || null)}
        className="appearance-none rounded-lg border border-border/70 bg-background/60 py-2 pl-3 pr-8 text-xs font-medium text-foreground transition-colors hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
      >
        <option value="">All projects</option>
        {ALL_PROJECTS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  );
}
