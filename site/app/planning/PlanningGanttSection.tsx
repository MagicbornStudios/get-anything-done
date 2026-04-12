"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { GanttChart, type GanttItem } from "@/components/charts/GanttChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ref } from "@/components/refs/Ref";
import type { PlanningPhase } from "@/lib/catalog.generated";
import { ALL_TASKS } from "@/lib/eval-data";
import { RichText } from "@/components/refs/RichText";
import { SiteSection, SiteSectionHeading } from "@/components/site";

const DEFAULT_SPRINT_SIZE = 5;

export function PlanningGanttSection({ phases }: { phases: PlanningPhase[] }) {
  const [sprintSize, setSprintSize] = useState(DEFAULT_SPRINT_SIZE);
  const [sprintOffset, setSprintOffset] = useState(() => {
    // Default to the sprint containing the current active/latest phase
    const activeIdx = phases.findIndex((p) => p.status === "active");
    const idx = activeIdx >= 0 ? activeIdx : phases.length - 1;
    return Math.floor(idx / sprintSize) * sprintSize;
  });
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  const totalSprints = Math.ceil(phases.length / sprintSize);
  const currentSprintNum = Math.floor(sprintOffset / sprintSize) + 1;

  // Visible phases in current sprint window
  const visiblePhases = useMemo(
    () => phases.slice(sprintOffset, sprintOffset + sprintSize),
    [phases, sprintOffset, sprintSize]
  );

  const columns = visiblePhases.map((p) => p.id);
  const items: GanttItem[] = visiblePhases.map((phase, idx) => ({
    id: phase.id,
    label: `${phase.id} — ${phase.title}`,
    start: idx,
    duration: 1,
    status: phase.status,
    stats: {
      Phase: phase.id,
      Status: phase.status,
      Title: phase.title,
    },
  }));

  // Tasks for selected phase
  const selectedPhase = phases.find((p) => p.id === selectedPhaseId);
  const selectedTasks = useMemo(
    () => selectedPhaseId ? ALL_TASKS.filter((t) => t.phaseId === selectedPhaseId) : [],
    [selectedPhaseId]
  );

  function prevSprint() {
    setSprintOffset((o) => Math.max(0, o - sprintSize));
  }
  function nextSprint() {
    setSprintOffset((o) => Math.min((totalSprints - 1) * sprintSize, o + sprintSize));
  }

  return (
    <SiteSection>
      <div className="flex flex-wrap items-center justify-between gap-4">
          <SiteSectionHeading
            kicker="Phase timeline"
            title={`Sprint ${currentSprintNum} of ${totalSprints}`}
            preset="section"
            className="min-w-0 flex-1"
          />

          {/* Sprint controls */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Sprint size controls */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/40 px-1 py-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => setSprintSize((s) => Math.max(3, s - 1))}
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
                onClick={() => setSprintSize((s) => Math.min(15, s + 1))}
                title="More phases per sprint"
              >
                <Plus className="size-3" />
              </Button>
            </div>

            {/* Sprint navigation */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-border/70 bg-card/40 text-xs font-semibold text-muted-foreground hover:border-accent hover:text-accent"
              onClick={prevSprint}
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
              onClick={nextSprint}
              disabled={sprintOffset + sprintSize >= phases.length}
            >
              Next
              <ChevronRight className="size-3" />
            </Button>
          </div>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Click a phase for tasks. Hover for stats. Resize sprint window with +/- controls.
        </p>

        <div className="mt-6">
          <GanttChart
            items={items}
            columns={columns}
            onItemClick={(item) => setSelectedPhaseId(item.id === selectedPhaseId ? null : item.id)}
            selectedId={selectedPhaseId}
          />
        </div>

        {/* Selected phase tasks */}
        {selectedPhase && (
          <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-semibold text-accent">Phase {selectedPhase.id}</span>
              <Badge
                variant={selectedPhase.status === "done" ? "success" : selectedPhase.status === "active" ? "default" : "outline"}
              >
                {selectedPhase.status}
              </Badge>
              <span className="text-sm text-foreground">{selectedPhase.title}</span>
            </div>

            {selectedTasks.length > 0 ? (
              <div className="space-y-2">
                {selectedTasks.map((t) => (
                  <div key={t.id} className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/30 p-3">
                    <Ref id={t.id} />
                    <div className="min-w-0 flex-1">
                      <RichText text={t.goal} className="text-xs text-foreground line-clamp-3" />
                    </div>
                    <Badge
                      variant={t.status === "done" ? "success" : t.status === "in-progress" ? "default" : t.status === "cancelled" ? "outline" : "outline"}
                      className="shrink-0 text-[10px]"
                    >
                      {t.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No tasks found for this phase.</p>
            )}
          </div>
        )}
    </SiteSection>
  );
}
