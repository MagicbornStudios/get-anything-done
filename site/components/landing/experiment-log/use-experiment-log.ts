"use client";

import { useEffect, useMemo, useState } from "react";
import { ROUND_SUMMARIES } from "@/lib/eval-data";
import { filterExperimentLogSummaries } from "@/components/landing/experiment-log/experiment-log-shared";

export function useExperimentLog() {
  const total = ROUND_SUMMARIES.length;

  const [globalRoundFilter, setGlobalRoundFilter] = useState<string | null>(null);
  const [globalHypothesisFilter, setGlobalHypothesisFilter] = useState<string | null>(null);

  useEffect(() => {
    const onRound = (e: Event) => {
      setGlobalRoundFilter((e as CustomEvent<string | null>).detail);
    };
    const onHypothesis = (e: Event) => {
      setGlobalHypothesisFilter((e as CustomEvent<string | null>).detail);
    };
    window.addEventListener("round-filter", onRound);
    window.addEventListener("hypothesis-filter", onHypothesis);
    return () => {
      window.removeEventListener("round-filter", onRound);
      window.removeEventListener("hypothesis-filter", onHypothesis);
    };
  }, []);

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
    [globalRoundFilter, projectFilter, effectiveHypothesis, localSearchQuery],
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
