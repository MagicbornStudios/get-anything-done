"use client";

import { useMemo } from "react";
import { ProjectMarketHeader } from "@/components/project-market/ProjectMarketHeader";
import { ProjectFilterBar } from "@/components/project-market/ProjectFilterBar";
import { ProjectMarketGrid } from "@/components/project-market/ProjectMarketGrid";
import { ProjectMarketRuns } from "@/components/project-market/ProjectMarketRuns";
import { ProjectMarketSpeciesBand } from "@/components/project-market/ProjectMarketSpeciesBand";
import { useProjectMarket } from "@/components/project-market/use-project-market";
import { Identified } from "gad-visual-context";
import { SiteSection } from "@/components/site";

interface ProjectMarketProps {
  /** Task 44-30: when non-null, collapse the marketplace to only this
   * project's species rows / runs. Null = full marketplace. */
  scopeProject?: string | null;
}

export default function ProjectMarket({ scopeProject = null }: ProjectMarketProps = {}) {
  const {
    featuredProjects: allFeatured,
    otherProjects: allOther,
    filteredRuns: allFilteredRuns,
    allPlayableRuns,
    selected,
    hasActiveFilters,
    allRounds,
    domainFilter,
    workflowFilter,
    speciesFilter,
    roundFilter,
    statusFilter,
    searchQuery,
    showAllRounds,
    speciesIndex,
    setDomainFilter,
    setWorkflowFilter,
    setSpeciesFilter,
    setRoundFilter,
    setStatusFilter,
    setSearchQuery,
    setShowAllRounds,
    setSelectedRunKey,
    clearAllFilters,
  } = useProjectMarket();

  // Task 44-30: collapse to a single project when scopeProject is set.
  // EVAL_PROJECTS rows carry an optional `project` field (composite id is
  // project/species). When scoped, only keep rows matching that project.
  const featuredProjects = useMemo(
    () => (scopeProject ? allFeatured.filter((p) => p.project === scopeProject) : allFeatured),
    [allFeatured, scopeProject],
  );
  const otherProjects = useMemo(
    () => (scopeProject ? allOther.filter((p) => p.project === scopeProject) : allOther),
    [allOther, scopeProject],
  );
  const filteredRuns = useMemo(
    () => (scopeProject ? allFilteredRuns.filter((r) => r.project === scopeProject) : allFilteredRuns),
    [allFilteredRuns, scopeProject],
  );

  return (
    <>
      <Identified as="ProjectMarketHeader">
        <ProjectMarketHeader />
      </Identified>

      <SiteSection cid="project-market-site-section" className="border-b-0" shellClassName="py-8">
        <Identified as="ProjectMarket">
          <ProjectFilterBar
            domainFilter={domainFilter}
            workflowFilter={workflowFilter}
            roundFilter={roundFilter}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            showAllRounds={showAllRounds}
            allRounds={allRounds}
            filteredRunCount={filteredRuns.length}
            totalRunCount={allPlayableRuns.length}
            hasActiveFilters={hasActiveFilters}
            onDomainChange={setDomainFilter}
            onWorkflowChange={setWorkflowFilter}
            onRoundChange={setRoundFilter}
            onStatusChange={setStatusFilter}
            onSearchChange={setSearchQuery}
            onShowAllRoundsChange={setShowAllRounds}
            onClearAll={clearAllFilters}
          />

          {/* Task 44-41: species directory band — only show on the full
              marketplace, not when collapsed to a single project. */}
          {!scopeProject && (
            <ProjectMarketSpeciesBand
              species={speciesIndex}
              active={speciesFilter}
              onSelect={setSpeciesFilter}
            />
          )}

          <div className="mt-8">
            <ProjectMarketGrid featured={featuredProjects} other={otherProjects} />
          </div>

          <ProjectMarketRuns
            runs={filteredRuns}
            selected={selected}
            domainFilter={domainFilter}
            onSelectRun={setSelectedRunKey}
          />
        </Identified>
      </SiteSection>
    </>
  );
}

