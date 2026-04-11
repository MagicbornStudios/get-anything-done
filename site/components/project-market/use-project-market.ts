"use client";

import { useCallback, useMemo, useState } from "react";
import {
  EVAL_PROJECTS,
  EVAL_RUNS,
  PLAYABLE_INDEX,
  WORKFLOW_LABELS,
  type EvalRunRecord,
} from "@/lib/eval-data";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";
import { reviewStateFor, runKey } from "@/components/landing/playable/playable-shared";
import type { ReviewState } from "@/lib/filter-store";
import {
  applyPerProjectRoundWindow,
  domainForProject,
  enrichProjects,
  type EnrichedProject,
  type ProjectDomain,
} from "@/components/project-market/project-market-shared";

export function useProjectMarket() {
  // Filter state (local, not shared with home page)
  const [domainFilter, setDomainFilter] = useState<ProjectDomain | null>(null);
  const [workflowFilter, setWorkflowFilter] = useState<string | null>(null);
  const [roundFilter, setRoundFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewState>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllRounds, setShowAllRounds] = useState(false);
  const [selectedRunKey, setSelectedRunKey] = useState<string | null>(null);

  // All playable runs
  const allPlayableRuns = useMemo<EvalRunRecord[]>(
    () =>
      EVAL_RUNS.filter((r) => PLAYABLE_INDEX[runKey(r)]).sort((a, b) => {
        if (a.project !== b.project) return a.project.localeCompare(b.project);
        const av = parseInt(a.version.slice(1), 10) || 0;
        const bv = parseInt(b.version.slice(1), 10) || 0;
        return av - bv;
      }),
    [],
  );

  // Enriched projects
  const enrichedProjects = useMemo(
    () => enrichProjects(EVAL_PROJECTS, EVAL_RUNS, PLAYABLE_INDEX),
    [],
  );

  // Filter projects
  const filteredProjects = useMemo(() => {
    let projects = enrichedProjects;
    if (domainFilter) {
      projects = projects.filter((p) => p.domain === domainFilter);
    }
    if (workflowFilter) {
      projects = projects.filter((p) => p.workflow === workflowFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      projects = projects.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q),
      );
    }
    return projects;
  }, [enrichedProjects, domainFilter, workflowFilter, searchQuery]);

  // Featured projects (always from full list, unless domain filter excludes them)
  const featuredProjects = useMemo(
    () => filteredProjects.filter((p) => p.featured),
    [filteredProjects],
  );

  const otherProjects = useMemo(
    () => filteredProjects.filter((p) => !p.featured),
    [filteredProjects],
  );

  // Filter runs for the embed section
  const filteredRuns = useMemo(() => {
    let runs = allPlayableRuns;

    // Apply per-project round window unless user explicitly shows all
    if (!showAllRounds && !roundFilter) {
      runs = applyPerProjectRoundWindow(runs);
    }

    if (domainFilter) {
      runs = runs.filter((r) => domainForProject(r.project) === domainFilter);
    }
    if (workflowFilter) {
      runs = runs.filter((r) => r.workflow === workflowFilter);
    }
    if (roundFilter) {
      runs = runs.filter((r) => roundForRun(r) === roundFilter);
    }
    if (statusFilter !== "all") {
      runs = runs.filter((r) => reviewStateFor(r) === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      runs = runs.filter(
        (r) =>
          r.project.toLowerCase().includes(q) ||
          r.version.toLowerCase().includes(q) ||
          (roundForRun(r) ?? "").toLowerCase().includes(q) ||
          WORKFLOW_LABELS[r.workflow].toLowerCase().includes(q),
      );
    }
    return runs;
  }, [allPlayableRuns, domainFilter, workflowFilter, roundFilter, statusFilter, searchQuery, showAllRounds]);

  // Selected run for embed
  const selected = useMemo(() => {
    if (selectedRunKey) {
      return filteredRuns.find((r) => runKey(r) === selectedRunKey) ?? filteredRuns[0] ?? null;
    }
    // Default: latest ETD bare run
    const defaultRun = filteredRuns.find(
      (r) => r.project === "escape-the-dungeon-bare" && r.version === "v3",
    );
    return defaultRun ?? filteredRuns[0] ?? null;
  }, [filteredRuns, selectedRunKey]);

  const hasActiveFilters =
    domainFilter != null ||
    workflowFilter != null ||
    roundFilter != null ||
    statusFilter !== "all" ||
    searchQuery.trim() !== "" ||
    showAllRounds;

  const clearAllFilters = useCallback(() => {
    setDomainFilter(null);
    setWorkflowFilter(null);
    setRoundFilter(null);
    setStatusFilter("all");
    setSearchQuery("");
    setShowAllRounds(false);
    setSelectedRunKey(null);
  }, []);

  // Collect all rounds from enriched projects for the round filter
  const allRounds = useMemo(() => {
    const set = new Set<string>();
    for (const p of enrichedProjects) {
      for (const r of p.rounds) set.add(r);
    }
    return [...set].sort((a, b) => {
      const an = parseInt(a.replace("Round ", ""), 10) || 0;
      const bn = parseInt(b.replace("Round ", ""), 10) || 0;
      return an - bn;
    });
  }, [enrichedProjects]);

  return {
    enrichedProjects,
    featuredProjects,
    otherProjects,
    filteredProjects,
    filteredRuns,
    allPlayableRuns,
    selected,
    hasActiveFilters,
    allRounds,
    // Filter state
    domainFilter,
    workflowFilter,
    roundFilter,
    statusFilter,
    searchQuery,
    showAllRounds,
    // Setters
    setDomainFilter,
    setWorkflowFilter,
    setRoundFilter,
    setStatusFilter,
    setSearchQuery,
    setShowAllRounds,
    setSelectedRunKey,
    clearAllFilters,
  };
}
