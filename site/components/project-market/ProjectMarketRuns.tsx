"use client";

import { useState } from "react";
import { PLAYABLE_INDEX } from "@/lib/eval-data";
import type { EvalRunRecord } from "@/lib/eval-data";
import { PlayableEmbed } from "@/components/landing/playable/PlayableEmbed";
import { PlayableSelectedPanel } from "@/components/landing/playable/PlayableSelectedPanel";
import { PlayableDocModal } from "@/components/landing/playable/PlayableDocModal";
import { PlayableStageGrid } from "@/components/landing/playable/PlayableStageGrid";
import { runKey } from "@/components/landing/playable/playable-shared";
import { buildProjectMarketPlayableGroups } from "@/components/project-market/build-project-market-playable-groups";
import { ProjectMarketPlayableCatalog } from "@/components/project-market/ProjectMarketPlayableCatalog";
import type { ProjectDomain } from "@/components/project-market/project-market-shared";

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

  const allGroups = buildProjectMarketPlayableGroups(runs, domainFilter);
  const iframeSrc = selected ? PLAYABLE_INDEX[runKey(selected)] : null;

  return (
    <div className="mt-10">
      <ProjectMarketPlayableCatalog
        groupedRuns={allGroups}
        selected={selected}
        onSelectRun={onSelectRun}
      />

      {selected && iframeSrc ? (
        <PlayableStageGrid className="mt-8">
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
        </PlayableStageGrid>
      ) : null}

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
