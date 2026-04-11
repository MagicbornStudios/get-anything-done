"use client";

import { ExperimentLogEmptyState } from "@/components/landing/experiment-log/ExperimentLogEmptyState";
import { ExperimentLogFilterBar } from "@/components/landing/experiment-log/ExperimentLogFilterBar";
import { ExperimentLogIntro } from "@/components/landing/experiment-log/ExperimentLogIntro";
import { ExperimentLogPagination } from "@/components/landing/experiment-log/ExperimentLogPagination";
import { ExperimentLogRoundCard } from "@/components/landing/experiment-log/ExperimentLogRoundCard";
import { useExperimentLog } from "@/components/landing/experiment-log/use-experiment-log";

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
    <section id="experiment-log" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <ExperimentLogIntro />

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

        {filteredSummaries.length > 0 && (
          <>
            <ExperimentLogPagination
              effectiveIndex={effectiveIndex}
              filteredLength={filteredSummaries.length}
              onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              onNext={() =>
                setCurrentIndex((i) => Math.min(filteredSummaries.length - 1, i + 1))
              }
            />

            {currentSummary && <ExperimentLogRoundCard round={currentSummary} />}
          </>
        )}

        {filteredSummaries.length === 0 && (
          <ExperimentLogEmptyState onClearLocalFilters={clearLocalFilters} />
        )}
      </div>
    </section>
  );
}
