"use client";

import { useCallback, useMemo, useState } from "react";
import {
  EVAL_PROJECTS,
  EVAL_RUNS,
  MARKETPLACE_INDEX,
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
  // Task 44-41: species filter — null = all species, else show only rows for
  // the chosen species (one of MARKETPLACE_INDEX.species).
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllRounds, setShowAllRounds] = useState(false);
  const [selectedRunKey, setSelectedRunKey] = useState<string | null>(null);

  // Marketplace truth (task 44-40): MARKETPLACE_INDEX.generations is the
  // canonical set of "things a visitor can play right now". A row qualifies
  // when its per-generation MANIFEST.json has status === "published" AND a
  // built copy exists under public/playable/. (Pre-existing built generations
  // without a manifest get a one-shot legacy promotion at index-build time.)
  const publishedGenerationIds = useMemo(
    () => new Set(MARKETPLACE_INDEX.generations.map((g) => g.id)),
    [],
  );

  const allPlayableRuns = useMemo<EvalRunRecord[]>(
    () =>
      EVAL_RUNS.filter((r) => publishedGenerationIds.has(r.id ?? runKey(r))).sort(
        (a, b) => {
          if (a.project !== b.project) return a.project.localeCompare(b.project);
          const av = parseInt(a.version.slice(1), 10) || 0;
          const bv = parseInt(b.version.slice(1), 10) || 0;
          return av - bv;
        },
      ),
    [publishedGenerationIds],
  );

  // Project listing: derived from the index — a project shows up when it has
  // ≥1 published generation. Replaces the prior project-level `published`
  // boolean flag, which has no concept of drafts/unlists per generation.
  const publishedProjectIds = useMemo(
    () => new Set(MARKETPLACE_INDEX.generations.map((g) => g.project)),
    [],
  );

  const enrichedProjects = useMemo(
    () =>
      enrichProjects(
        EVAL_PROJECTS.filter((p) => publishedProjectIds.has(p.id)),
        EVAL_RUNS,
        PLAYABLE_INDEX,
      ),
    [publishedProjectIds],
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
    if (speciesFilter) {
      const projectsWithSpecies = new Set(
        MARKETPLACE_INDEX.generations
          .filter((g) => g.species === speciesFilter)
          .map((g) => g.project),
      );
      projects = projects.filter((p) => projectsWithSpecies.has(p.id));
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
  }, [enrichedProjects, domainFilter, workflowFilter, speciesFilter, searchQuery]);

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
    if (speciesFilter) {
      runs = runs.filter((r) => r.species === speciesFilter);
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
  }, [allPlayableRuns, domainFilter, workflowFilter, speciesFilter, roundFilter, statusFilter, searchQuery, showAllRounds]);

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
    speciesFilter != null ||
    roundFilter != null ||
    statusFilter !== "all" ||
    searchQuery.trim() !== "" ||
    showAllRounds;

  const clearAllFilters = useCallback(() => {
    setDomainFilter(null);
    setWorkflowFilter(null);
    setSpeciesFilter(null);
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
    speciesFilter,
    roundFilter,
    statusFilter,
    searchQuery,
    showAllRounds,
    // Species directory (task 44-41) — derived index of distinct species with
    // at least one published generation, plus per-species counts.
    speciesIndex: MARKETPLACE_INDEX.species,
    // Setters
    setDomainFilter,
    setWorkflowFilter,
    setSpeciesFilter,
    setRoundFilter,
    setStatusFilter,
    setSearchQuery,
    setShowAllRounds,
    setSelectedRunKey,
    clearAllFilters,
  };
}
