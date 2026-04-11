"use client";

import { useState } from "react";
import { PLAYABLE_INDEX } from "@/lib/eval-data";
import type { EvalRunRecord } from "@/lib/eval-data";
import { PlayableEmbed } from "@/components/landing/playable/PlayableEmbed";
import { PlayableSelectedPanel } from "@/components/landing/playable/PlayableSelectedPanel";
import { PlayableDocModal } from "@/components/landing/playable/PlayableDocModal";
import { PlayableReviewLegend } from "@/components/landing/playable/PlayableReviewLegend";
import { PlayableRunGroups } from "@/components/landing/playable/PlayableRunGroups";
import { runKey, PROJECT_FAMILIES } from "@/components/landing/playable/playable-shared";
import { domainForProject, type ProjectDomain } from "@/components/project-market/project-market-shared";

type Props = {
  runs: EvalRunRecord[];
  selected: EvalRunRecord | null;
  domainFilter: ProjectDomain | null;
  onSelectRun: (key: string) => void;
};

export function ProjectMarketRuns({ runs, selected, domainFilter, onSelectRun }: Props) {
  const [modal, setModal] = useState<"requirements" | "skill" | null>(null);

  if (runs.length === 0) {
    return null;
  }

  // Build grouped runs using PROJECT_FAMILIES, filtered by domain
  const families = domainFilter
    ? PROJECT_FAMILIES.filter((f) => {
        // Check if any of the family's projects match the domain filter
        return f.projects.some((pid) => domainForProject(pid) === domainFilter);
      })
    : PROJECT_FAMILIES;

  const groupedRuns = families.map((family) => {
    const familyRuns = runs.filter((r) => family.projects.includes(r.project));
    return { ...family, runs: familyRuns };
  });

  // Also gather runs not in any family
  const familyProjectIds = new Set(PROJECT_FAMILIES.flatMap((f) => f.projects));
  const ungroupedRuns = runs.filter((r) => !familyProjectIds.has(r.project));

  const allGroups = [
    ...groupedRuns,
    ...(ungroupedRuns.length > 0
      ? [{ id: "other", label: "Other projects", description: "Additional eval runs", runs: ungroupedRuns }]
      : []),
  ];

  const iframeSrc = selected ? PLAYABLE_INDEX[runKey(selected)] : null;

  return (
    <div className="mt-10">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Playable builds
      </h2>
      <p className="mb-6 text-xs text-muted-foreground">
        Click any build badge to play it in-browser. Hover for details.
      </p>

      <PlayableReviewLegend />

      <PlayableRunGroups
        groupedRuns={allGroups}
        selected={selected}
        onSelectRun={onSelectRun}
      />

      {selected && iframeSrc && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
          <PlayableEmbed
            project={selected.project}
            version={selected.version}
            iframeSrc={iframeSrc}
          />
          <PlayableSelectedPanel
            selected={selected}
            onOpenRequirements={() => setModal("requirements")}
            onOpenSkill={() => setModal("skill")}
          />
        </div>
      )}

      <PlayableDocModal
        modal={modal}
        selected={selected}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      />
    </div>
  );
}
