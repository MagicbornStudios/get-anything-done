"use client";

import { Identified } from "@/components/devid/Identified";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DOMAIN_TINT,
  type ProjectDomain,
} from "@/components/project-market/project-market-shared";
import {
  WORKFLOW_TINT,
  WORKFLOW_HYPOTHESIS,
} from "@/components/landing/playable/playable-shared";
import type { ReviewState } from "@/lib/filter-store";
import {
  STATUS_CHIP_STYLES,
  REVIEW_STATE_DOT,
  REVIEW_STATE_LABEL,
} from "@/components/landing/playable/playable-shared";

const ALL = "__all";

const DOMAINS: ProjectDomain[] = ["game", "video", "software", "tooling", "planning"];
const WORKFLOWS = ["bare", "gad", "emergent"] as const;

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
}: Props) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-4">
      <Identified as="ProjectMarketFilterBarControls" className="flex flex-wrap items-center gap-3">
        {/* Domain filter */}
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

        {/* Round filter */}
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

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "reviewed", "needs-review", "excluded"] as const).map((s) => {
            const isActive = statusFilter === s;
            const styles = STATUS_CHIP_STYLES[s];
            return (
              <Button
                key={s}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onStatusChange(s)}
                className={cn(
                  "h-auto gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-none",
                  isActive ? styles.active : styles.base,
                )}
              >
                {s !== "all" && (
                  <span className={`size-1.5 rounded-full ${REVIEW_STATE_DOT[s]}`} aria-hidden />
                )}
                {s === "all" ? "All statuses" : REVIEW_STATE_LABEL[s]}
              </Button>
            );
          })}
        </div>

        <div className="hidden h-6 w-px bg-border/60 sm:block" />

        {/* Workflow/hypothesis chips */}
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

        {/* Search */}
        <div className="relative min-w-[180px] flex-1">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects or runs..."
            className="h-9 rounded-lg border-border/70 bg-background/60 py-2 pl-8 pr-8 text-xs shadow-none focus-visible:ring-accent/40"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onSearchChange("")}
              className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3" aria-hidden />
            </Button>
          )}
        </div>
      </Identified>

      {/* Summary row */}
      <Identified as="ProjectMarketFilterBarSummary" className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground tabular-nums">{filteredRunCount}</span>{" "}
          of <span className="font-semibold text-foreground tabular-nums">{totalRunCount}</span>{" "}
          playable build{totalRunCount !== 1 ? "s" : ""}
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
      </Identified>
    </div>
  );
}
