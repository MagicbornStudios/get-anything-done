"use client";

import { ProjectMarketHeader } from "@/components/project-market/ProjectMarketHeader";
import { ProjectMarketFilterBar } from "@/components/project-market/ProjectMarketFilterBar";
import { ProjectMarketGrid } from "@/components/project-market/ProjectMarketGrid";
import { ProjectMarketRuns } from "@/components/project-market/ProjectMarketRuns";
import { useProjectMarket } from "@/components/project-market/use-project-market";
import { SiteSection } from "@/components/site";

export default function ProjectMarket() {
  const {
    featuredProjects,
    otherProjects,
    filteredRuns,
    allPlayableRuns,
    selected,
    hasActiveFilters,
    allRounds,
    domainFilter,
    workflowFilter,
    roundFilter,
    statusFilter,
    searchQuery,
    showAllRounds,
    setDomainFilter,
    setWorkflowFilter,
    setRoundFilter,
    setStatusFilter,
    setSearchQuery,
    setShowAllRounds,
    setSelectedRunKey,
    clearAllFilters,
  } = useProjectMarket();

  return (
    <>
      <ProjectMarketHeader />

      <SiteSection className="border-b-0" shellClassName="py-8">
        <ProjectMarketFilterBar
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

        <div className="mt-8">
          <ProjectMarketGrid
            featured={featuredProjects}
            other={otherProjects}
          />
        </div>

        <ProjectMarketRuns
          runs={filteredRuns}
          selected={selected}
          domainFilter={domainFilter}
          onSelectRun={setSelectedRunKey}
        />
      </SiteSection>
    </>
  );
}
