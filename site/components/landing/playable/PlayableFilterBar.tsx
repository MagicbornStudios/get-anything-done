"use client";

import { ChevronDown, Filter, Search, X } from "lucide-react";
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
        <div className="relative">
          <select
            value={roundFilter ?? ""}
            onChange={(e) => {
              const val = e.target.value || null;
              onRoundChange(val);
              if (val) {
                window.history.replaceState(null, "", `${window.location.pathname}#play?round=${val.replace("Round ", "")}`);
              } else {
                window.history.replaceState(null, "", window.location.pathname + "#play");
              }
              window.dispatchEvent(new CustomEvent("round-filter", { detail: val }));
            }}
            className="appearance-none rounded-lg border border-border/70 bg-background/60 py-2 pl-3 pr-8 text-xs font-medium text-foreground transition-colors hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          >
            <option value="">All rounds</option>
            {ROUND_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>

        <div className="relative">
          <select
            value={domainFilter ?? ""}
            onChange={(e) => {
              const val = e.target.value || null;
              onDomainChange(val);
              window.dispatchEvent(new CustomEvent("domain-filter", { detail: val }));
            }}
            className="appearance-none rounded-lg border border-border/70 bg-background/60 py-2 pl-3 pr-8 text-xs font-medium text-foreground transition-colors hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          >
            <option value="">All projects</option>
            {PROJECT_FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>

        <div className="hidden h-6 w-px bg-border/60 sm:block" />

        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "reviewed", "needs-review", "excluded"] as const).map((s) => {
            const isActive = statusFilter === s;
            const styles = STATUS_CHIP_STYLES[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => onStatusChange(s)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  isActive ? styles.active : styles.base,
                ].join(" ")}
              >
                {s !== "all" && (
                  <span className={`size-1.5 rounded-full ${REVIEW_STATE_DOT[s]}`} aria-hidden />
                )}
                {s === "all" ? "All statuses" : REVIEW_STATE_LABEL[s]}
              </button>
            );
          })}
        </div>

        <div className="hidden h-6 w-px bg-border/60 sm:block" />

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onHypothesisChange(null)}
            className={[
              "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
              !hypothesisFilter
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60",
            ].join(" ")}
          >
            All hypotheses
          </button>
          {(["bare", "gad", "emergent"] as const).map((wf) => {
            const isActive = hypothesisFilter === wf;
            return (
              <button
                key={wf}
                type="button"
                onClick={() => onHypothesisChange(isActive ? null : wf)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  isActive
                    ? WORKFLOW_TINT[wf].replace(/\/15/g, "/30").replace(/\/40/g, "/60")
                    : `${WORKFLOW_TINT[wf]} hover:brightness-125`,
                ].join(" ")}
              >
                {WORKFLOW_HYPOTHESIS[wf] ?? wf}
              </button>
            );
          })}
        </div>

        <div className="hidden h-6 w-px bg-border/60 sm:block" />

        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, version, or workflow..."
            className="w-full rounded-lg border border-border/70 bg-background/60 py-2 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 transition-colors hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={12} aria-hidden />
            </button>
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
          <button
            type="button"
            onClick={onClearAllFilters}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground underline decoration-dotted hover:text-foreground"
          >
            <X size={10} aria-hidden />
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
