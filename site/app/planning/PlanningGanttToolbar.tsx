"use client";

import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { Button } from "@/components/ui/button";
import { SiteSectionHeading } from "@/components/site";

type PlanningGanttToolbarProps = {
  currentSprintNum: number;
  totalSprints: number;
  sprintSize: number;
  onSprintSizeDelta: (delta: number) => void;
  sprintOffset: number;
  phasesLength: number;
  onPrevSprint: () => void;
  onNextSprint: () => void;
};

export function PlanningGanttToolbar({
  currentSprintNum,
  totalSprints,
  sprintSize,
  onSprintSizeDelta,
  sprintOffset,
  phasesLength,
  onPrevSprint,
  onNextSprint,
}: PlanningGanttToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Identified as="PlanningGanttToolbarHeading" className="min-w-0 flex-1">
        <SiteSectionHeading
          kicker="Phase timeline"
          title={`Sprint ${currentSprintNum} of ${totalSprints}`}
          preset="section"
          className="min-w-0 flex-1"
        />
      </Identified>

      <Identified as="PlanningGanttToolbarControls" className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/40 px-1 py-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => onSprintSizeDelta(-1)}
            title="Fewer phases per sprint"
          >
            <Minus className="size-3" />
          </Button>
          <span className="px-1 text-xs tabular-nums text-muted-foreground">{sprintSize} phases</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => onSprintSizeDelta(1)}
            title="More phases per sprint"
          >
            <Plus className="size-3" />
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full border-border/70 bg-card/40 text-xs font-semibold text-muted-foreground hover:border-accent hover:text-accent"
          onClick={onPrevSprint}
          disabled={sprintOffset === 0}
        >
          <ChevronLeft className="size-3" />
          Prev
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full border-border/70 bg-card/40 text-xs font-semibold text-muted-foreground hover:border-accent hover:text-accent"
          onClick={onNextSprint}
          disabled={sprintOffset + sprintSize >= phasesLength}
        >
          Next
          <ChevronRight className="size-3" />
        </Button>
      </Identified>
    </div>
  );
}
