"use client";

import { useMemo, useState } from "react";
import { ROUND_SUMMARIES } from "@/lib/eval-data";
import { useFilterStore } from "@/lib/filter-store";
import { filterExperimentLogSummaries } from "@/components/landing/experiment-log/experiment-log-shared";

export function useExperimentLog() {
  const total = ROUND_SUMMARIES.length;
  const globalRoundFilter = useFilterStore((s) => s.roundFilter);
  const globalHypothesisFilter = useFilterStore((s) => s.hypothesisFilter);

  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [localHypothesisFilter, setLocalHypothesisFilter] = useState<string | null>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  const effectiveHypothesis = localHypothesisFilter ?? globalHypothesisFilter;

  const filteredSummaries = useMemo(
    () =>
      filterExperimentLogSummaries(ROUND_SUMMARIES, {
        globalRoundFilter,
        projectFilter,
        effectiveHypothesis,
        localSearchQuery,
      }),
    [globalRoundFilter, projectFilter, effectiveHypothesis, localSearchQuery]
  );

  const [currentIndex, setCurrentIndex] = useState(total - 1);

  const clampedIndex = Math.min(currentIndex, filteredSummaries.length - 1);
  const effectiveIndex = Math.max(0, clampedIndex);

  const hasActiveFilters =
    projectFilter != null || localHypothesisFilter != null || localSearchQuery.trim() !== "";

  function clearLocalFilters() {
    setProjectFilter(null);
    setLocalHypothesisFilter(null);
    setLocalSearchQuery("");
  }

  return {
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
    currentSummary: filteredSummaries[effectiveIndex],
  };
}
