"use client";

import { useState, useMemo } from "react";
import { GanttChart, type GanttItem } from "@/components/charts/GanttChart";
import type { PlanningPhase } from "@/lib/catalog.generated";
import { ALL_TASKS } from "@/lib/eval-data";
import { SiteSection } from "@/components/site";
import { PlanningGanttSelectedPhasePanel } from "./PlanningGanttSelectedPhasePanel";
import { PlanningGanttToolbar } from "./PlanningGanttToolbar";

const DEFAULT_SPRINT_SIZE = 5;

export function PlanningGanttSection({ phases }: { phases: PlanningPhase[] }) {
  const [sprintSize, setSprintSize] = useState(DEFAULT_SPRINT_SIZE);
  const [sprintOffset, setSprintOffset] = useState(() => {
    const activeIdx = phases.findIndex((p) => p.status === "active");
    const idx = activeIdx >= 0 ? activeIdx : phases.length - 1;
    return Math.floor(idx / DEFAULT_SPRINT_SIZE) * DEFAULT_SPRINT_SIZE;
  });
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  const totalSprints = Math.ceil(phases.length / sprintSize);
  const currentSprintNum = Math.floor(sprintOffset / sprintSize) + 1;

  const visiblePhases = useMemo(
    () => phases.slice(sprintOffset, sprintOffset + sprintSize),
    [phases, sprintOffset, sprintSize],
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

  const selectedPhase = phases.find((p) => p.id === selectedPhaseId);
  const selectedTasks = useMemo(
    () => (selectedPhaseId ? ALL_TASKS.filter((t) => t.phaseId === selectedPhaseId) : []),
    [selectedPhaseId],
  );

  function onSprintSizeDelta(delta: number) {
    setSprintSize((s) => Math.min(15, Math.max(3, s + delta)));
  }

  function prevSprint() {
    setSprintOffset((o) => Math.max(0, o - sprintSize));
  }

  function nextSprint() {
    setSprintOffset((o) => Math.min((totalSprints - 1) * sprintSize, o + sprintSize));
  }

  return (
    <SiteSection>
      <PlanningGanttToolbar
        currentSprintNum={currentSprintNum}
        totalSprints={totalSprints}
        sprintSize={sprintSize}
        onSprintSizeDelta={onSprintSizeDelta}
        sprintOffset={sprintOffset}
        phasesLength={phases.length}
        onPrevSprint={prevSprint}
        onNextSprint={nextSprint}
      />

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

      <PlanningGanttSelectedPhasePanel selectedPhase={selectedPhase} selectedTasks={selectedTasks} />
    </SiteSection>
  );
}
