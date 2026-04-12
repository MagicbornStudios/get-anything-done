"use client";

import { Info } from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Ref } from "@/components/refs/Ref";
import type { SkillCandidateFilterMode } from "./planning-skill-candidates-types";

type PlanningSkillCandidatesHeaderProps = {
  filter: SkillCandidateFilterMode;
  onFilter: (mode: SkillCandidateFilterMode) => void;
  counts: { unreviewed: number; reviewed: number; all: number };
};

export function PlanningSkillCandidatesHeader({ filter, onFilter, counts }: PlanningSkillCandidatesHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Skill candidates from high-pressure phases
      </h3>
      <HoverCard openDelay={100}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center text-muted-foreground hover:text-accent"
            aria-label="What is a skill candidate?"
          >
            <Info size={14} />
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-96" side="bottom" align="start">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">What is a skill candidate?</p>
            <p className="text-xs leading-5 text-muted-foreground">
              When a phase exceeds the <strong>pressure threshold</strong>, the self-eval pipeline auto-drafts a{" "}
              <code className="rounded bg-card/60 px-1 text-accent">SKILL.md</code> file for review. High pressure
              signals that patterns likely exist in that phase that could become a reusable skill.
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              <strong>Pressure formula:</strong>{" "}
              <code className="rounded bg-card/60 px-1 text-accent">
                pressure = tasks_total + (crosscuts × crosscut_weight)
              </code>
              . A phase is high-pressure when{" "}
              <code className="rounded bg-card/60 px-1 text-accent">pressure &gt; threshold</code>. Weights and
              threshold are configurable in <code className="rounded bg-card/60 px-1 text-accent">site/data/self-eval-config.json</code>.
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Candidates are <strong>quarantined</strong> — they live in{" "}
              <code className="rounded bg-card/60 px-1 text-accent">skills/candidates/</code> with{" "}
              <code className="rounded bg-card/60 px-1 text-accent">status: candidate</code> in their frontmatter,
              excluded from the catalog scan, and unavailable to GAD until promoted.
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              <strong>Review lifecycle:</strong> each candidate has a{" "}
              <code className="rounded bg-card/60 px-1 text-accent">reviewed</code> field. Set it to{" "}
              <code className="rounded bg-card/60 px-1 text-accent">promoted</code>,{" "}
              <code className="rounded bg-card/60 px-1 text-accent">merged</code>, or{" "}
              <code className="rounded bg-card/60 px-1 text-accent">discarded</code> and the pipeline stops
              regenerating the draft. Reviewed candidates stay on the site as history so you can see what you
              already decided.
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              Decisions: <Ref id="gad-115" />, <Ref id="gad-144" />, <Ref id="gad-145" />
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>

      <div className="ml-auto flex items-center gap-1.5">
        {(["unreviewed", "reviewed", "all"] as const).map((mode) => {
          const isActive = filter === mode;
          const count = counts[mode];
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onFilter(mode)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                isActive
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60",
              ].join(" ")}
            >
              {mode}
              <span className="tabular-nums text-muted-foreground/70">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
