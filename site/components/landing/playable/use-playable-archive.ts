"use client";

import { useCallback, useEffect, useMemo } from "react";
import { EVAL_RUNS, PLAYABLE_INDEX, WORKFLOW_LABELS, type EvalRunRecord } from "@/lib/eval-data";
import { useFilterStore } from "@/lib/filter-store";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";
import {
  parseRoundFromHash,
  PROJECT_FAMILIES,
  reviewStateFor,
  runKey,
} from "@/components/landing/playable/playable-shared";

export function usePlayableArchive() {
  const allRuns = useMemo<EvalRunRecord[]>(
    () =>
      EVAL_RUNS.filter((r) => PLAYABLE_INDEX[runKey(r)]).sort((a, b) => {
        if (a.project !== b.project) return a.project.localeCompare(b.project);
        const av = parseInt(a.version.slice(1), 10) || 0;
        const bv = parseInt(b.version.slice(1), 10) || 0;
        return av - bv;
      }),
    []
  );

  const roundFilter = useFilterStore((s) => s.roundFilter);
  const domainFilter = useFilterStore((s) => s.domainFilter);
  const statusFilter = useFilterStore((s) => s.statusFilter);
  const hypothesisFilter = useFilterStore((s) => s.hypothesisFilter);
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const selectedRunKey = useFilterStore((s) => s.selectedRunKey);
  const setRoundFilter = useFilterStore((s) => s.setRoundFilter);
  const setDomainFilter = useFilterStore((s) => s.setDomainFilter);
  const setStatusFilter = useFilterStore((s) => s.setStatusFilter);
  const setHypothesisFilter = useFilterStore((s) => s.setHypothesisFilter);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const setSelectedRunKey = useFilterStore((s) => s.setSelectedRunKey);
  const clearAll = useFilterStore((s) => s.clearAll);

  useEffect(() => {
    const hashRound = parseRoundFromHash();
    if (hashRound) setRoundFilter(hashRound);
  }, [setRoundFilter]);

  useEffect(() => {
    function onRoundFilter(e: Event) {
      setRoundFilter((e as CustomEvent).detail as string | null);
    }
    function onDomainFilter(e: Event) {
      setDomainFilter((e as CustomEvent).detail as string | null);
    }
    function onHashChange() {
      const hashRound = parseRoundFromHash();
      if (hashRound) setRoundFilter(hashRound);
    }
    window.addEventListener("round-filter", onRoundFilter);
    window.addEventListener("domain-filter", onDomainFilter);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("round-filter", onRoundFilter);
      window.removeEventListener("domain-filter", onDomainFilter);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [setRoundFilter, setDomainFilter]);

  const runs = useMemo(() => {
    let filtered = allRuns;
    if (roundFilter) {
      filtered = filtered.filter((r) => roundForRun(r) === roundFilter);
    }
    if (domainFilter) {
      const family = PROJECT_FAMILIES.find((f) => f.id === domainFilter);
      if (family) {
        filtered = filtered.filter((r) => family.projects.includes(r.project));
      }
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => reviewStateFor(r) === statusFilter);
    }
    if (hypothesisFilter) {
      filtered = filtered.filter((r) => r.workflow === hypothesisFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.project.toLowerCase().includes(q) ||
          r.version.toLowerCase().includes(q) ||
          (roundForRun(r) ?? "").toLowerCase().includes(q) ||
          WORKFLOW_LABELS[r.workflow].toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allRuns, roundFilter, domainFilter, statusFilter, hypothesisFilter, searchQuery]);

  const groupedRuns = useMemo(() => {
    const families = domainFilter
      ? PROJECT_FAMILIES.filter((f) => f.id === domainFilter)
      : PROJECT_FAMILIES;
    return families.map((family) => {
      const familyRuns = runs.filter((r) => family.projects.includes(r.project));
      return { ...family, runs: familyRuns };
    });
  }, [runs, domainFilter]);

  const selected = useMemo(() => {
    if (selectedRunKey) {
      return runs.find((r) => runKey(r) === selectedRunKey) ?? runs[0] ?? null;
    }
    const defaultRun = runs.find(
      (r) => r.project === "escape-the-dungeon-bare" && r.version === "v3"
    );
    return defaultRun ?? runs[0] ?? null;
  }, [runs, selectedRunKey]);

  const hasActiveFilters =
    roundFilter != null ||
    domainFilter != null ||
    statusFilter !== "all" ||
    hypothesisFilter != null ||
    searchQuery.trim() !== "";

  const clearAllFilters = useCallback(() => {
    clearAll();
    window.history.replaceState(null, "", window.location.pathname + "#play");
    window.dispatchEvent(new CustomEvent("round-filter", { detail: null }));
    window.dispatchEvent(new CustomEvent("domain-filter", { detail: null }));
  }, [clearAll]);

  return {
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
  };
}
