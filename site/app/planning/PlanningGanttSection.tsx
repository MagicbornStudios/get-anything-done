"use client";

import { useMemo, useState } from "react";
import { GanttChart, type GanttItem } from "@/components/charts/GanttChart";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";
import { usePlanningGanttSprint } from "./PlanningGanttSprintContext";
import { PlanningGanttToolbar } from "./PlanningGanttToolbar";
import { SiteSectionHeading } from "@/components/site";

function PlanningGanttSection() {
  const { phases, sprintSize, sprintOffset, currentSprintNum, totalSprints, onSprintSizeDelta, onPrevSprint, onNextSprint } = usePlanningGanttSprint();
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

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

  return (
    <SiteSection
      cid="planning-gantt-section-site-section"
      className="border-b-0"
      sectionShell={false}
      shellClassName="w-full px-4 py-10 md:px-8 md:py-12 xl:px-10"
      allowContextPanel={false}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Identified as="PlanningGanttToolbarHeading" register={false} className="min-w-0 flex-1">
          <SiteSectionHeading
            kicker="Phase timeline"
            title={`Sprint ${currentSprintNum} of ${totalSprints}`}
            preset="section"
            className="min-w-0"
          />
        </Identified>
        <Identified as="PlanningGanttToolbar">
          <PlanningGanttToolbar
            sprintSize={sprintSize}
            onSprintSizeDelta={onSprintSizeDelta}
            sprintOffset={sprintOffset}
            phasesLength={phases.length}
            onPrevSprint={onPrevSprint}
            onNextSprint={onNextSprint}
          />
        </Identified>
      </div>
      <Identified as="PlanningGanttSection">
        <Identified as="PlanningGanttChart" className="mt-0">
          <GanttChart
            items={items}
            columns={columns}
            onItemClick={(item) => setSelectedPhaseId(item.id === selectedPhaseId ? null : item.id)}
            selectedId={selectedPhaseId}
          />
        </Identified>
      </Identified>
    </SiteSection>
  );
}

export { PlanningGanttSection };
