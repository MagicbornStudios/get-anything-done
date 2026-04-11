"use client";

import { ALL_PROJECTS } from "@/components/landing/experiment-log/experiment-log-shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_KEY = "__all";

type Props = {
  projectFilter: string | null;
  onProjectChange: (value: string | null) => void;
};

export function ExperimentLogProjectSelect({ projectFilter, onProjectChange }: Props) {
  return (
    <Select
      value={projectFilter ?? ALL_KEY}
      onValueChange={(v) => onProjectChange(v === ALL_KEY ? null : v)}
    >
      <SelectTrigger className="h-9 w-[min(12rem,42vw)] rounded-lg border-border/70 bg-background/60 text-xs font-medium shadow-none focus:ring-accent/40">
        <SelectValue placeholder="All projects" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_KEY} className="text-xs">
          All projects
        </SelectItem>
        {ALL_PROJECTS.map((p) => (
          <SelectItem key={p} value={p} className="font-mono text-xs">
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
