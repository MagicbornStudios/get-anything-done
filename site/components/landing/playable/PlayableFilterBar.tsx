"use client";

import { Filter, Search, X } from "lucide-react";
import {
  PROJECT_FAMILIES,
  REVIEW_STATE_DOT,
  REVIEW_STATE_LABEL,
  ROUND_OPTIONS,
  STATUS_CHIP_STYLES,
  WORKFLOW_HYPOTHESIS,
  WORKFLOW_TINT,
} from "@/components/landing/playable/playable-shared";
import type { ReviewState } from "@/lib/filter-store";
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

const ALL_ROUND = "__all";
const ALL_DOMAIN = "__all";

type Props = {
  roundFilter: string | null;
  domainFilter: string | null;
  statusFilter: "all" | ReviewState;
  hypothesisFilter: string | null;
  searchQuery: string;
  runsLength: number;
  allRunsLength: number;
  hasActiveFilters: boolean;
  onRoundChange: (value: string | null) => void;
  onDomainChange: (value: string | null) => void;
  onStatusChange: (value: "all" | ReviewState) => void;
  onHypothesisChange: (value: string | null) => void;
  onSearchChange: (value: string) => void;
  onClearAllFilters: () => void;
};

export function PlayableFilterBar({
  roundFilter,
  domainFilter,
  statusFilter,
  hypothesisFilter,
  searchQuery,
  runsLength,
  allRunsLength,
  hasActiveFilters,
  onRoundChange,
  onDomainChange,
  onStatusChange,
  onHypothesisChange,
  onSearchChange,
  onClearAllFilters,
}: Props) {
  return (
    <div className="mt-8 rounded-xl border border-border/60 bg-card/30 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={roundFilter ?? ALL_ROUND}
          onValueChange={(v) => {
            const val = v === ALL_ROUND ? null : v;
            onRoundChange(val);
            if (val) {
              window.history.replaceState(
                null,
                "",
                `${window.location.pathname}#play?round=${val.replace("Round ", "")}`
              );
            } else {
              window.history.replaceState(null, "", `${window.location.pathname}#play`);
            }
            window.dispatchEvent(new CustomEvent("round-filter", { detail: val }));
          }}
        >
          <SelectTrigger className="h-9 w-[min(11rem,40vw)] rounded-lg border-border/70 bg-background/60 text-xs font-medium shadow-none focus:ring-accent/40">
            <SelectValue placeholder="All rounds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ROUND} className="text-xs">
              All rounds
            </SelectItem>
            {ROUND_OPTIONS.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={domainFilter ?? ALL_DOMAIN}
          onValueChange={(v) => {
            const val = v === ALL_DOMAIN ? null : v;
            onDomainChange(val);
            window.dispatchEvent(new CustomEvent("domain-filter", { detail: val }));
          }}
        >
          <SelectTrigger className="h-9 w-[min(11rem,40vw)] rounded-lg border-border/70 bg-background/60 text-xs font-medium shadow-none focus:ring-accent/40">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DOMAIN} className="text-xs">
              All projects
            </SelectItem>
            {PROJECT_FAMILIES.map((f) => (
              <SelectItem key={f.id} value={f.id} className="text-xs">
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="hidden h-6 w-px bg-border/60 sm:block" />

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
                  isActive ? styles.active : styles.base
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

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onHypothesisChange(null)}
            className={cn(
              "h-auto rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-none",
              !hypothesisFilter
                ? "border-accent bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground"
                : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60"
            )}
          >
            All hypotheses
          </Button>
          {(["bare", "gad", "emergent"] as const).map((wf) => {
            const isActive = hypothesisFilter === wf;
            return (
              <Button
                key={wf}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onHypothesisChange(isActive ? null : wf)}
                className={cn(
                  "h-auto gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-none",
                  isActive
                    ? WORKFLOW_TINT[wf].replace(/\/15/g, "/30").replace(/\/40/g, "/60")
                    : `${WORKFLOW_TINT[wf]} hover:brightness-125`
                )}
              >
                {WORKFLOW_HYPOTHESIS[wf] ?? wf}
              </Button>
            );
          })}
        </div>

        <div className="hidden h-6 w-px bg-border/60 sm:block" />

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
            placeholder="Search by name, version, or workflow..."
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
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground tabular-nums">{runsLength}</span>{" "}
          of <span className="font-semibold text-foreground tabular-nums">{allRunsLength}</span>{" "}
          build{allRunsLength !== 1 ? "s" : ""}
          {roundFilter && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
              <Filter size={9} aria-hidden />
              {roundFilter}
            </span>
          )}
          {domainFilter && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
              {PROJECT_FAMILIES.find((f) => f.id === domainFilter)?.label}
            </span>
          )}
        </p>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAllFilters}
            className="h-auto gap-1 p-0 text-[11px] font-medium text-muted-foreground underline decoration-dotted hover:bg-transparent hover:text-foreground"
          >
            <X className="size-2.5" aria-hidden />
            Clear all filters
          </Button>
        )}
      </div>
    </div>
  );
}
