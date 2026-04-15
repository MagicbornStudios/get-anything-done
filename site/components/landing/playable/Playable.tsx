"use client";

import { useState } from "react";
import { PLAYABLE_INDEX } from "@/lib/eval-data";
import { PlayableDocModal } from "@/components/landing/playable/PlayableDocModal";
import { PlayableEmbedBlock } from "@/components/landing/playable/PlayableEmbedBlock";
import { PlayableFilterBar } from "@/components/landing/playable/PlayableFilterBar";
import { PlayableIntro } from "@/components/landing/playable/PlayableIntro";
import { PlayableNoResults } from "@/components/landing/playable/PlayableNoResults";
import { PlayableReviewLegend } from "@/components/landing/playable/PlayableReviewLegend";
import { PlayableRunGroups } from "@/components/landing/playable/PlayableRunGroups";
import { runKey } from "@/components/landing/playable/playable-shared";
import { usePlayableArchive } from "@/components/landing/playable/use-playable-archive";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

export default function Playable() {
  const {
    allRuns,
    runs,
    groupedRuns,
    selected,
    hasActiveFilters,
    clearAllFilters,
    roundFilter,
    domainFilter,
    statusFilter,
    hypothesisFilter,
    searchQuery,
    setRoundFilter,
    setDomainFilter,
    setStatusFilter,
    setHypothesisFilter,
    setSearchQuery,
    setSelectedRunKey,
  } = usePlayableArchive();

  const [modal, setModal] = useState<"requirements" | "skill" | null>(null);

  if (allRuns.length === 0) {
    return null;
  }

  const iframeSrc = selected ? PLAYABLE_INDEX[runKey(selected)] : null;

  return (
    <SiteSection id="play" cid="play-site-section" tone="muted" className="border-t border-border/60">
      <Identified as="PlayableIntro">
        <PlayableIntro />
      </Identified>

      <Identified as="PlayableFilterBar">
        <PlayableFilterBar
          roundFilter={roundFilter}
          domainFilter={domainFilter}
          statusFilter={statusFilter}
          hypothesisFilter={hypothesisFilter}
          searchQuery={searchQuery}
          runsLength={runs.length}
          allRunsLength={allRuns.length}
          hasActiveFilters={hasActiveFilters}
          onRoundChange={setRoundFilter}
          onDomainChange={setDomainFilter}
          onStatusChange={setStatusFilter}
          onHypothesisChange={setHypothesisFilter}
          onSearchChange={setSearchQuery}
          onClearAllFilters={clearAllFilters}
        />
      </Identified>

      <Identified as="PlayableRunsPicker">
        <PlayableReviewLegend />
        <PlayableRunGroups
          groupedRuns={groupedRuns}
          selected={selected}
          onSelectRun={setSelectedRunKey}
        />
      </Identified>

      {runs.length === 0 ? (
        <Identified as="PlayableNoResults">
          <PlayableNoResults roundFilter={roundFilter} onClearAllFilters={clearAllFilters} />
        </Identified>
      ) : null}

      {selected && iframeSrc ? (
        <Identified as="PlayableEmbedBlock">
          <PlayableEmbedBlock
            selected={selected}
            iframeSrc={iframeSrc}
            onOpenRequirements={() => setModal("requirements")}
            onOpenSkill={() => setModal("skill")}
          />
        </Identified>
      ) : null}

      <Identified as="PlayableDocModal">
        <PlayableDocModal
          modal={modal}
          selected={selected}
          onOpenChange={(open) => {
            if (!open) setModal(null);
          }}
        />
      </Identified>
    </SiteSection>
  );
}

