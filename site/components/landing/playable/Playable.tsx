"use client";

import { useState } from "react";
import { PLAYABLE_INDEX } from "@/lib/eval-data";
import { PlayableDocModal } from "@/components/landing/playable/PlayableDocModal";
import { PlayableEmbed } from "@/components/landing/playable/PlayableEmbed";
import { PlayableFilterBar } from "@/components/landing/playable/PlayableFilterBar";
import { PlayableIntro } from "@/components/landing/playable/PlayableIntro";
import { PlayableNoResults } from "@/components/landing/playable/PlayableNoResults";
import { PlayableReviewLegend } from "@/components/landing/playable/PlayableReviewLegend";
import { PlayableRunGroups } from "@/components/landing/playable/PlayableRunGroups";
import { PlayableSelectedPanel } from "@/components/landing/playable/PlayableSelectedPanel";
import { runKey } from "@/components/landing/playable/playable-shared";
import { usePlayableArchive } from "@/components/landing/playable/use-playable-archive";

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
    <section id="play" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <PlayableIntro />

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

        <PlayableReviewLegend />

        <PlayableRunGroups
          groupedRuns={groupedRuns}
          selected={selected}
          onSelectRun={setSelectedRunKey}
        />

        {runs.length === 0 && (
          <PlayableNoResults roundFilter={roundFilter} onClearAllFilters={clearAllFilters} />
        )}

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
      </div>

      <PlayableDocModal
        modal={modal}
        selected={selected}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      />
    </section>
  );
}
