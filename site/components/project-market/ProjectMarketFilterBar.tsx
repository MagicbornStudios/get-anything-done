"use client";

import { EvalFilterSearchField } from "@/components/eval-filters/EvalFilterSearchField";
import { EvalFilterSurface } from "@/components/eval-filters/EvalFilterSurface";
import { EvalReviewStatusFilterChips } from "@/components/eval-filters/EvalReviewStatusFilterChips";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DOMAIN_LABELS,
  type ProjectDomain,
} from "@/components/project-market/project-market-shared";
import {
  WORKFLOW_TINT,
  WORKFLOW_HYPOTHESIS,
} from "@/components/landing/playable/playable-shared";
import type { ReviewState } from "@/lib/filter-store";

const ALL = "__all";

const DOMAINS: ProjectDomain[] = ["game", "video", "software", "tooling", "planning"];
const WORKFLOWS = ["bare", "gad", "emergent"] as const;

/** When set, replaces the default “playable builds” summary line (e.g. methodology weights catalog). */
export type ProjectMarketCountSummary = {
  filtered: number;
  total: number;
  nounSingular: string;
  nounPlural: string;
  /** Appended after the noun phrase, e.g. “with composite weights”. */
  qualifier?: string;
};

type Props = {
  domainFilter: ProjectDomain | null;
  workflowFilter: string | null;
  roundFilter: string | null;
  statusFilter: "all" | ReviewState;
  searchQuery: string;
  showAllRounds: boolean;
  allRounds: string[];
  filteredRunCount: number;
  totalRunCount: number;
  hasActiveFilters: boolean;
  onDomainChange: (v: ProjectDomain | null) => void;
  onWorkflowChange: (v: string | null) => void;
  onRoundChange: (v: string | null) => void;
  onStatusChange: (v: "all" | ReviewState) => void;
  onSearchChange: (v: string) => void;
  onShowAllRoundsChange: (v: boolean) => void;
  onClearAll: () => void;
  /** Override summary counts/labels; still uses round/domain badges from filters. */
  countSummary?: ProjectMarketCountSummary;
  searchPlaceholder?: string;
};

export function ProjectMarketFilterBar({
  domainFilter,
  workflowFilter,
  roundFilter,
  statusFilter,
  searchQuery,
  showAllRounds,
  allRounds,
  filteredRunCount,
  totalRunCount,
  hasActiveFilters,
  onDomainChange,
  onWorkflowChange,
  onRoundChange,
  onStatusChange,
  onSearchChange,
  onShowAllRoundsChange,
  onClearAll,
  countSummary,
  searchPlaceholder = "Search projects or runs...",
}: Props) {
  const summaryFiltered = countSummary?.filtered ?? filteredRunCount;
  const summaryTotal = countSummary?.total ?? totalRunCount;
  const summaryNoun =
    countSummary != null
      ? summaryTotal === 1
        ? countSummary.nounSingular
        : countSummary.nounPlural
      : null;
  const summaryQualifier = countSummary?.qualifier;

  return (
    <EvalFilterSurface>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={domainFilter ?? ALL}
          onValueChange={(v) => onDomainChange(v === ALL ? null : (v as ProjectDomain))}
        >
          <SelectTrigger className="h-9 w-[min(10rem,40vw)] rounded-lg border-border/70 bg-background/60 text-xs font-medium shadow-none focus:ring-accent/40">
            <SelectValue placeholder="All domains" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-xs">All domains</SelectItem>
            {DOMAINS.map((d) => (
              <SelectItem key={d} value={d} className="text-xs">
                {DOMAIN_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={roundFilter ?? ALL}
          onValueChange={(v) => onRoundChange(v === ALL ? null : v)}
        >
          <SelectTrigger className="h-9 w-[min(10rem,40vw)] rounded-lg border-border/70 bg-background/60 text-xs font-medium shadow-none focus:ring-accent/40">
            <SelectValue placeholder="All rounds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-xs">All rounds</SelectItem>
            {allRounds.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="hidden h-6 w-px bg-border/60 sm:block" />

        <EvalReviewStatusFilterChips statusFilter={statusFilter} onStatusChange={onStatusChange} />

        <div className="hidden h-6 w-px bg-border/60 sm:block" />

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onWorkflowChange(null)}
            className={cn(
              "h-auto rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-none",
              !workflowFilter
                ? "border-accent bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground"
                : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60",
            )}
          >
            All workflows
          </Button>
          {WORKFLOWS.map((wf) => {
            const isActive = workflowFilter === wf;
            return (
              <Button
                key={wf}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onWorkflowChange(isActive ? null : wf)}
                className={cn(
                  "h-auto gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-none",
                  isActive
                    ? WORKFLOW_TINT[wf].replace(/\/15/g, "/30").replace(/\/40/g, "/60")
                    : `${WORKFLOW_TINT[wf]} hover:brightness-125`,
                )}
              >
                {WORKFLOW_HYPOTHESIS[wf] ?? wf}
              </Button>
            );
          })}
        </div>

        <div className="hidden h-6 w-px bg-border/60 sm:block" />

        <EvalFilterSearchField
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
      </div>

      {/* Summary row */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground tabular-nums">{summaryFiltered}</span>{" "}
          of <span className="font-semibold text-foreground tabular-nums">{summaryTotal}</span>{" "}
          {countSummary != null ? (
            <>
              {summaryNoun}
              {summaryQualifier ? <> {summaryQualifier}</> : null}
            </>
          ) : (
            <>playable build{totalRunCount !== 1 ? "s" : ""}</>
          )}
          {!showAllRounds && !roundFilter && (
            <Badge
              variant="outline"
              className="ml-2 border-amber-500/40 bg-amber-500/10 py-0.5 px-2 text-[10px] font-semibold normal-case tracking-normal text-amber-300"
            >
              last 5 rounds per project
            </Badge>
          )}
          {domainFilter && (
            <Badge
              variant="outline"
              className="ml-2 border-sky-500/40 bg-sky-500/10 py-0.5 px-2 text-[10px] font-semibold normal-case tracking-normal text-sky-300"
            >
              {DOMAIN_LABELS[domainFilter]}
            </Badge>
          )}
        </p>
        <div className="flex items-center gap-3">
          {!showAllRounds && !roundFilter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onShowAllRoundsChange(true)}
              className="h-auto gap-1 p-0 text-[11px] font-medium text-muted-foreground underline decoration-dotted hover:bg-transparent hover:text-foreground"
            >
              Show all rounds
            </Button>
          )}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-auto gap-1 p-0 text-[11px] font-medium text-muted-foreground underline decoration-dotted hover:bg-transparent hover:text-foreground"
            >
              <X className="size-2.5" aria-hidden />
              Clear all filters
            </Button>
          )}
        </div>
      </div>
    </EvalFilterSurface>
  );
}
