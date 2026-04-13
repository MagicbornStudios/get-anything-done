"use client";

import { ExperimentLogEmptyState } from "@/components/landing/experiment-log/ExperimentLogEmptyState";
import { ExperimentLogFilterBar } from "@/components/landing/experiment-log/ExperimentLogFilterBar";
import { ExperimentLogIntro } from "@/components/landing/experiment-log/ExperimentLogIntro";
import { ExperimentLogPagination } from "@/components/landing/experiment-log/ExperimentLogPagination";
import { ExperimentLogRoundCard } from "@/components/landing/experiment-log/ExperimentLogRoundCard";
import { useExperimentLog } from "@/components/landing/experiment-log/use-experiment-log";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

export default function ExperimentLog() {
  const {
    total,
    globalRoundFilter,
    filteredSummaries,
    effectiveIndex,
    setCurrentIndex,
    projectFilter,
    setProjectFilter,
    localHypothesisFilter,
    setLocalHypothesisFilter,
    localSearchQuery,
    setLocalSearchQuery,
    hasActiveFilters,
    clearLocalFilters,
    currentSummary,
  } = useExperimentLog();

  if (total === 0) return null;

  return (
    <SiteSection id="experiment-log" tone="muted" className="border-t border-border/60">
      <Identified as="ExperimentLogIntro">
        <ExperimentLogIntro />
      </Identified>

      <Identified as="ExperimentLogFilterBar">
        <ExperimentLogFilterBar
          filteredSummaries={filteredSummaries}
          activeRound={currentSummary?.round}
          onSelectRoundIndex={setCurrentIndex}
          projectFilter={projectFilter}
          onProjectChange={setProjectFilter}
          localHypothesisFilter={localHypothesisFilter}
          onHypothesisChange={setLocalHypothesisFilter}
          localSearchQuery={localSearchQuery}
          onSearchChange={setLocalSearchQuery}
          total={total}
          globalRoundFilter={globalRoundFilter}
          hasActiveFilters={hasActiveFilters}
          onClearLocalFilters={clearLocalFilters}
        />
      </Identified>

      {filteredSummaries.length > 0 && (
        <>
          <Identified as="ExperimentLogPagination">
            <ExperimentLogPagination
              effectiveIndex={effectiveIndex}
              filteredLength={filteredSummaries.length}
              onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              onNext={() =>
                setCurrentIndex((i) => Math.min(filteredSummaries.length - 1, i + 1))
              }
            />
          </Identified>

          {currentSummary && (
            <Identified as="ExperimentLogRoundCard">
              <ExperimentLogRoundCard round={currentSummary} />
            </Identified>
          )}
        </>
      )}

      {filteredSummaries.length === 0 && (
        <Identified as="ExperimentLogEmptyState">
          <ExperimentLogEmptyState onClearLocalFilters={clearLocalFilters} />
        </Identified>
      )}
    </SiteSection>
  );
}
