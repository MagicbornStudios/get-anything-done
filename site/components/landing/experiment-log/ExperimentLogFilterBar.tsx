"use client";

import type { RoundSummary } from "@/lib/eval-data";
import { ExperimentLogHypothesisChips } from "@/components/landing/experiment-log/ExperimentLogHypothesisChips";
import { ExperimentLogKeywordSearch } from "@/components/landing/experiment-log/ExperimentLogKeywordSearch";
import { ExperimentLogFilterSummary } from "@/components/landing/experiment-log/ExperimentLogFilterSummary";
import { ExperimentLogProjectSelect } from "@/components/landing/experiment-log/ExperimentLogProjectSelect";
import { ExperimentLogRoundPills } from "@/components/landing/experiment-log/ExperimentLogRoundPills";

type Props = {
  filteredSummaries: RoundSummary[];
  activeRound: string | undefined;
  onSelectRoundIndex: (index: number) => void;
  projectFilter: string | null;
  onProjectChange: (value: string | null) => void;
  localHypothesisFilter: string | null;
  onHypothesisChange: (value: string | null) => void;
  localSearchQuery: string;
  onSearchChange: (value: string) => void;
  total: number;
  globalRoundFilter: string | null;
  hasActiveFilters: boolean;
  onClearLocalFilters: () => void;
};

export function ExperimentLogFilterBar({
  filteredSummaries,
  activeRound,
  onSelectRoundIndex,
  projectFilter,
  onProjectChange,
  localHypothesisFilter,
  onHypothesisChange,
  localSearchQuery,
  onSearchChange,
  total,
  globalRoundFilter,
  hasActiveFilters,
  onClearLocalFilters,
}: Props) {
  return (
    <div className="mt-8 rounded-xl border border-border/60 bg-card/30 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <ExperimentLogRoundPills
          filteredSummaries={filteredSummaries}
          activeRound={activeRound}
          onSelectRound={onSelectRoundIndex}
        />

        <div className="hidden h-6 w-px bg-border/60 sm:block" />

        <ExperimentLogProjectSelect projectFilter={projectFilter} onProjectChange={onProjectChange} />

        <ExperimentLogHypothesisChips
          localHypothesisFilter={localHypothesisFilter}
          onHypothesisChange={onHypothesisChange}
        />

        <div className="hidden h-6 w-px bg-border/60 sm:block" />

        <ExperimentLogKeywordSearch localSearchQuery={localSearchQuery} onSearchChange={onSearchChange} />
      </div>

      <ExperimentLogFilterSummary
        filteredCount={filteredSummaries.length}
        total={total}
        globalRoundFilter={globalRoundFilter}
        hasActiveFilters={hasActiveFilters}
        onClearLocalFilters={onClearLocalFilters}
      />
    </div>
  );
}
