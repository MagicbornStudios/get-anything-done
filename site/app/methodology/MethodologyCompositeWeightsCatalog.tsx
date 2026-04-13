"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Identified } from "@/components/devid/Identified";
import {
  EVAL_PROJECTS,
  EVAL_RUNS,
  PLAYABLE_INDEX,
  WORKFLOW_LABELS,
  type EvalRunRecord,
  type Workflow,
} from "@/lib/eval-data";
import { ProjectMarketFilterBar } from "@/components/project-market/ProjectMarketFilterBar";
import {
  applyPerProjectRoundWindow,
  domainForProject,
  enrichProjects,
  DOMAIN_LABELS,
  DOMAIN_TINT,
  type EnrichedProject,
  type ProjectDomain,
} from "@/components/project-market/project-market-shared";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";
import { reviewStateFor, runKey, WORKFLOW_TINT } from "@/components/landing/playable/playable-shared";
import type { ReviewState } from "@/lib/filter-store";
import { cn } from "@/lib/utils";

const WEIGHTS_SOURCE = EVAL_PROJECTS.filter((p) => p.scoringWeights && p.workflow);

export function MethodologyCompositeWeightsCatalog() {
  const enrichedAll = useMemo(
    () => enrichProjects(WEIGHTS_SOURCE, EVAL_RUNS, PLAYABLE_INDEX),
    [],
  );

  const catalogProjectIds = useMemo(
    () => new Set(enrichedAll.map((p) => p.id)),
    [enrichedAll],
  );

  const [domainFilter, setDomainFilter] = useState<ProjectDomain | null>(null);
  const [workflowFilter, setWorkflowFilter] = useState<string | null>(null);
  const [roundFilter, setRoundFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewState>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllRounds, setShowAllRounds] = useState(false);

  const allCatalogPlayableRuns = useMemo<EvalRunRecord[]>(
    () =>
      EVAL_RUNS.filter((r) => PLAYABLE_INDEX[runKey(r)] && catalogProjectIds.has(r.project)).sort(
        (a, b) => {
          if (a.project !== b.project) return a.project.localeCompare(b.project);
          const av = parseInt(a.version.slice(1), 10) || 0;
          const bv = parseInt(b.version.slice(1), 10) || 0;
          return av - bv;
        },
      ),
    [catalogProjectIds],
  );

  const filteredRuns = useMemo(() => {
    let runs = allCatalogPlayableRuns;
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
  }, [
    allCatalogPlayableRuns,
    domainFilter,
    workflowFilter,
    roundFilter,
    statusFilter,
    searchQuery,
    showAllRounds,
  ]);

  /** When true, project list is limited to projects with ≥1 run in `filteredRuns` (same as playable strip). */
  const needsRunIntersection =
    roundFilter != null || statusFilter !== "all" || searchQuery.trim() !== "";
  const runProjectIds = useMemo(
    () => new Set(filteredRuns.map((r) => r.project)),
    [filteredRuns],
  );

  const filteredWeightProjects = useMemo(() => {
    let list: EnrichedProject[] = enrichedAll;
    if (domainFilter) list = list.filter((p) => p.domain === domainFilter);
    if (workflowFilter) list = list.filter((p) => p.workflow === workflowFilter);

    if (needsRunIntersection) {
      list = list.filter((p) => runProjectIds.has(p.id));
    }
    return list;
  }, [
    enrichedAll,
    domainFilter,
    workflowFilter,
    needsRunIntersection,
    runProjectIds,
  ]);

  const allRounds = useMemo(() => {
    const set = new Set<string>();
    for (const p of enrichedAll) {
      for (const r of p.rounds) set.add(r);
    }
    return [...set].sort((a, b) => {
      const an = parseInt(a.replace("Round ", ""), 10) || 0;
      const bn = parseInt(b.replace("Round ", ""), 10) || 0;
      return an - bn;
    });
  }, [enrichedAll]);

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
  }, []);

  return (
    <Identified as="MethodologyCompositeWeightsCatalog" className="mt-6">
      <details
        className={cn(
          "group rounded-2xl border border-border/70 bg-card/25 [&_summary::-webkit-details-marker]:hidden",
          "[&>summary]:list-none",
        )}
      >
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-card/40">
          <div>
            <p className="text-sm font-semibold text-foreground">Per-project weight tables</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {enrichedAll.length} eval projects · same filters as project market / playable (collapsed by
              default)
            </p>
          </div>
          <ChevronDown
            className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </summary>

        <div className="border-t border-border/60 px-4 pb-5 pt-2">
          <ProjectMarketFilterBar
            domainFilter={domainFilter}
            workflowFilter={workflowFilter}
            roundFilter={roundFilter}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            showAllRounds={showAllRounds}
            allRounds={allRounds}
            filteredRunCount={filteredRuns.length}
            totalRunCount={allCatalogPlayableRuns.length}
            hasActiveFilters={hasActiveFilters}
            onDomainChange={setDomainFilter}
            onWorkflowChange={setWorkflowFilter}
            onRoundChange={setRoundFilter}
            onStatusChange={setStatusFilter}
            onSearchChange={setSearchQuery}
            onShowAllRoundsChange={setShowAllRounds}
            onClearAll={clearAllFilters}
            countSummary={{
              filtered: filteredWeightProjects.length,
              total: enrichedAll.length,
              nounSingular: "eval project",
              nounPlural: "eval projects",
              qualifier: "with composite weights",
            }}
            searchPlaceholder="Search by project id, name, version, round, or workflow…"
          />

          {filteredWeightProjects.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No eval projects match these filters.
            </p>
          ) : (
            <div className="mt-6 space-y-5">
              {filteredWeightProjects.map((p) => {
                const entries = Object.entries(p.scoringWeights ?? {}).sort((a, b) => b[1] - a[1]);
                const total = entries.reduce((acc, [, w]) => acc + w, 0);
                return (
                  <Identified
                    key={p.id}
                    as={`MethodologyCompositeProjectWeights-${p.id}`}
                    className="overflow-hidden rounded-2xl border border-border/70 bg-card/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/30 px-5 py-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] uppercase tracking-wider",
                              DOMAIN_TINT[p.domain],
                            )}
                          >
                            {DOMAIN_LABELS[p.domain]}
                          </Badge>
                          {p.workflow && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] uppercase tracking-wider",
                                WORKFLOW_TINT[p.workflow as Workflow] ??
                                  "border-border/70 text-muted-foreground",
                              )}
                            >
                              {p.workflow}
                            </Badge>
                          )}
                          {p.evalMode && (
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase tracking-wider border-border/50 text-muted-foreground"
                            >
                              {p.evalMode}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{p.id}</p>
                      </div>
                      <Badge variant="outline">Σ weights = {total.toFixed(2)}</Badge>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {entries.map(([dim, w], idx) => (
                          <tr
                            key={dim}
                            className={idx % 2 === 0 ? "bg-transparent" : "bg-background/20"}
                          >
                            <td className="px-5 py-2.5 font-mono text-[11px] text-foreground">{dim}</td>
                            <td className="px-5 py-2.5 tabular-nums text-accent">{w.toFixed(2)}</td>
                            <td className="px-5 py-2.5">
                              <div className="h-1.5 max-w-xs overflow-hidden rounded-full bg-border/60">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-accent/60 via-accent to-accent/80"
                                  style={{ width: `${w * 100}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Identified>
                );
              })}
            </div>
          )}
        </div>
      </details>
    </Identified>
  );
}
