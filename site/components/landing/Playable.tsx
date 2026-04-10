"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Gamepad2, FileText, Sparkles, X, BarChart3, Filter, Search, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  EVAL_RUNS,
  PLAYABLE_INDEX,
  WORKFLOW_LABELS,
  type EvalRunRecord,
  type Workflow,
} from "@/lib/eval-data";
import { roundForRun } from "@/components/landing/HypothesisTracksSection";

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

function runKey(r: { project: string; version: string }) {
  return `${r.project}/${r.version}`;
}

const WORKFLOW_TINT: Record<Workflow, string> = {
  gad: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  bare: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  emergent: "bg-amber-500/15 text-amber-300 border-amber-500/40",
};

type ReviewState = "reviewed" | "needs-review" | "excluded";

function reviewStateFor(r: EvalRunRecord): ReviewState {
  const t = r.timing as Record<string, unknown> | null | undefined;
  if (t && (t.rate_limited === true || t.api_interrupted === true)) {
    return "excluded";
  }
  const norm = r.humanReviewNormalized;
  if (norm && !norm.is_empty && norm.aggregate_score != null) {
    return "reviewed";
  }
  if (r.humanReview && typeof r.humanReview.score === "number") {
    return "reviewed";
  }
  return "needs-review";
}

const REVIEW_STATE_DOT: Record<ReviewState, string> = {
  reviewed: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]",
  "needs-review": "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.7)] animate-pulse",
  excluded: "bg-zinc-500",
};

const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  reviewed: "Reviewed",
  "needs-review": "Needs review",
  excluded: "Excluded (interrupted)",
};

const STATUS_CHIP_STYLES: Record<"all" | ReviewState, { base: string; active: string }> = {
  all: {
    base: "border-border/70 text-muted-foreground hover:border-foreground/40",
    active: "border-purple-500/60 bg-purple-500/15 text-purple-300",
  },
  reviewed: {
    base: "border-border/70 text-muted-foreground hover:border-emerald-500/40",
    active: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300",
  },
  "needs-review": {
    base: "border-border/70 text-muted-foreground hover:border-rose-500/40",
    active: "border-rose-500/60 bg-rose-500/15 text-rose-300",
  },
  excluded: {
    base: "border-border/70 text-muted-foreground hover:border-zinc-400/40",
    active: "border-zinc-400/60 bg-zinc-500/15 text-zinc-300",
  },
};

/** Project families for grouping. Order matters for display. */
const PROJECT_FAMILIES: Array<{
  id: string;
  label: string;
  description: string;
  projects: string[];
}> = [
  {
    id: "escape-the-dungeon",
    label: "Escape the Dungeon",
    description: "Roguelike dungeon crawler — primary eval vehicle across all rounds",
    projects: [
      "escape-the-dungeon",
      "escape-the-dungeon-bare",
      "escape-the-dungeon-emergent",
    ],
  },
  {
    id: "gad-explainer-video",
    label: "GAD Explainer Video",
    description: "Remotion composition — planned eval for video generation workflows",
    projects: ["gad-explainer-video"],
  },
  {
    id: "skill-evaluation-app",
    label: "Skill Evaluation App",
    description: "Interactive requirements editor — planned eval for tooling workflows",
    projects: ["skill-evaluation-app"],
  },
];

const ROUND_OPTIONS = ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5"] as const;

function fmtTokensShort(t: number | null | undefined): string {
  if (t == null) return "\u2014";
  if (t >= 1000) return `${Math.round(t / 1000)}K`;
  return String(t);
}

function fmtTokensLong(t: number | null | undefined): string {
  if (t == null) return "\u2014";
  return t.toLocaleString("en-US");
}

function fmtDuration(m: number | null | undefined): string {
  if (m == null) return "\u2014";
  return `${m} min`;
}

/** Parse round number from URL hash like #play?round=4 */
function parseRoundFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  const match = hash.match(/round=(\d+)/);
  if (match) return `Round ${match[1]}`;
  return null;
}

export default function Playable() {
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

  const [roundFilter, setRoundFilter] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewState>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [modal, setModal] = useState<"requirements" | "skill" | null>(null);

  // Parse round filter from URL hash on mount
  useEffect(() => {
    setRoundFilter(parseRoundFromHash());
  }, []);

  // Listen for round-filter AND domain-filter custom events from the chart
  useEffect(() => {
    function onRoundFilter(e: Event) {
      const detail = (e as CustomEvent).detail as string | null;
      setRoundFilter(detail);
      setSelectedKey(null);
    }
    function onDomainFilter(e: Event) {
      const detail = (e as CustomEvent).detail as string | null;
      setDomainFilter(detail);
      setSelectedKey(null);
    }
    function onHashChange() {
      setRoundFilter(parseRoundFromHash());
    }
    window.addEventListener("round-filter", onRoundFilter);
    window.addEventListener("domain-filter", onDomainFilter);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("round-filter", onRoundFilter);
      window.removeEventListener("domain-filter", onDomainFilter);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  // Filter runs by round, domain, status, and search
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
  }, [allRuns, roundFilter, domainFilter, statusFilter, searchQuery]);

  // Group filtered runs by project family
  const groupedRuns = useMemo(() => {
    const families = domainFilter
      ? PROJECT_FAMILIES.filter((f) => f.id === domainFilter)
      : PROJECT_FAMILIES;
    return families.map((family) => {
      const familyRuns = runs.filter((r) => family.projects.includes(r.project));
      return { ...family, runs: familyRuns };
    });
  }, [runs, domainFilter]);

  // Resolve selected run
  const selected = useMemo(() => {
    if (selectedKey) {
      return runs.find((r) => runKey(r) === selectedKey) ?? runs[0] ?? null;
    }
    // Default to bare/v3 if available, otherwise first
    const defaultRun = runs.find(
      (r) => r.project === "escape-the-dungeon-bare" && r.version === "v3"
    );
    return defaultRun ?? runs[0] ?? null;
  }, [runs, selectedKey]);

  const hasActiveFilters = roundFilter != null || domainFilter != null || statusFilter !== "all" || searchQuery.trim() !== "";

  function clearAllFilters() {
    setRoundFilter(null);
    setDomainFilter(null);
    setStatusFilter("all");
    setSearchQuery("");
    setSelectedKey(null);
    window.history.replaceState(null, "", window.location.pathname + "#play");
    window.dispatchEvent(new CustomEvent("round-filter", { detail: null }));
    window.dispatchEvent(new CustomEvent("domain-filter", { detail: null }));
  }

  if (allRuns.length === 0) {
    return null;
  }

  const iframeSrc = selected ? PLAYABLE_INDEX[runKey(selected)] : null;

  return (
    <section id="play" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <p className="section-kicker">Playable archive</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Every build we scored. <span className="gradient-text">Playable in your browser.</span>
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          These are the exact production builds the human reviewers scored — no rebuilds, no
          tweaks. Click a round on the{" "}
          <a href="#tracks" className="text-accent underline decoration-dotted">hypothesis chart above</a>{" "}
          to filter, or use the controls below to search and filter.
        </p>

        {/* ── Filter bar ────────────────────────────────────────── */}
        <div className="mt-8 rounded-xl border border-border/60 bg-card/30 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Round dropdown */}
            <div className="relative">
              <select
                value={roundFilter ?? ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setRoundFilter(val);
                  setSelectedKey(null);
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

            {/* Project dropdown */}
            <div className="relative">
              <select
                value={domainFilter ?? ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setDomainFilter(val);
                  setSelectedKey(null);
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

            {/* Divider */}
            <div className="hidden h-6 w-px bg-border/60 sm:block" />

            {/* Status filter chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(["all", "reviewed", "needs-review", "excluded"] as const).map((s) => {
                const isActive = statusFilter === s;
                const styles = STATUS_CHIP_STYLES[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
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

            {/* Divider */}
            <div className="hidden h-6 w-px bg-border/60 sm:block" />

            {/* Search input */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, version, or workflow..."
                className="w-full rounded-lg border border-border/70 bg-background/60 py-2 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 transition-colors hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X size={12} aria-hidden />
                </button>
              )}
            </div>
          </div>

          {/* Count + clear row */}
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground tabular-nums">{runs.length}</span>{" "}
              of <span className="font-semibold text-foreground tabular-nums">{allRuns.length}</span>{" "}
              build{allRuns.length !== 1 ? "s" : ""}
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
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground underline decoration-dotted hover:text-foreground"
              >
                <X size={10} aria-hidden />
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider">Legend:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${REVIEW_STATE_DOT.reviewed}`} aria-hidden />
            reviewed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${REVIEW_STATE_DOT["needs-review"]}`} aria-hidden />
            needs review
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${REVIEW_STATE_DOT.excluded}`} aria-hidden />
            excluded (rate-limited / api-interrupted)
          </span>
        </div>

        {/* Grouped run pickers */}
        {groupedRuns.map((group) => {
          if (group.runs.length === 0) return null;
          return (
            <div key={group.id} className="mt-6">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                <span className="text-[11px] text-muted-foreground">{group.description}</span>
                <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {group.runs.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.runs.map((r) => {
                  const key = runKey(r);
                  const active = selected && runKey(selected) === key;
                  const state = reviewStateFor(r);
                  const round = roundForRun(r);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      title={`${REVIEW_STATE_LABEL[state]}${round ? ` · ${round}` : ""}`}
                      className={[
                        "group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                        active
                          ? "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20"
                          : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60 hover:text-foreground",
                      ].join(" ")}
                    >
                      <span
                        className={`size-2 shrink-0 rounded-full ${REVIEW_STATE_DOT[state]}`}
                        aria-label={REVIEW_STATE_LABEL[state]}
                      />
                      <span
                        className={[
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                          active ? "border-background/40 bg-background/20 text-accent-foreground" : WORKFLOW_TINT[r.workflow],
                        ].join(" ")}
                      >
                        {WORKFLOW_LABELS[r.workflow]}
                      </span>
                      <span>{r.project.replace("escape-the-dungeon", "etd")}</span>
                      <span className="tabular-nums">{r.version}</span>
                      {round && (
                        <span className={[
                          "rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                          active
                            ? "border-background/30 text-accent-foreground/80"
                            : "border-purple-500/30 bg-purple-500/10 text-purple-400/80",
                        ].join(" ")}>
                          {round.replace("Round ", "R")}
                        </span>
                      )}
                      {r.tokenUsage?.total_tokens != null && (
                        <span className={[
                          "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                          active
                            ? "text-accent-foreground/60"
                            : "text-muted-foreground/60",
                        ].join(" ")}>
                          {fmtTokensShort(r.tokenUsage.total_tokens)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* No results state */}
        {runs.length === 0 && (
          <div className="mt-8 rounded-2xl border border-border/70 bg-card/30 p-8 text-center">
            <p className="text-lg font-semibold text-muted-foreground">
              No playable builds match your filters
            </p>
            <p className="mt-2 text-sm text-muted-foreground/70">
              {roundFilter && `${roundFilter} may not have scored builds yet, or all runs were rate-limited. `}
              Try adjusting your filters or search query.
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-4 inline-flex items-center gap-1 rounded-full border border-accent/60 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
            >
              Clear all filters
            </button>
          </div>
        )}

        {selected && iframeSrc && (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-border/60 bg-card/40 px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Gamepad2 size={14} className="text-accent" aria-hidden />
                  playable: {selected.project}/{selected.version}
                </div>
                <a
                  href={iframeSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
                >
                  Open full screen
                  <ExternalLink size={11} aria-hidden />
                </a>
              </div>
              <div className="aspect-[16/10] w-full">
                <iframe
                  key={iframeSrc}
                  src={iframeSrc}
                  title={`${selected.project} ${selected.version}`}
                  className="h-full w-full bg-[#1a1a2e]"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{WORKFLOW_LABELS[selected.workflow]} · {selected.version}</Badge>
                {(() => {
                  const state = reviewStateFor(selected);
                  const variant =
                    state === "reviewed" ? "success" : state === "excluded" ? "outline" : "danger";
                  return (
                    <Badge variant={variant} className="inline-flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${REVIEW_STATE_DOT[state]}`} aria-hidden />
                      {REVIEW_STATE_LABEL[state]}
                    </Badge>
                  );
                })()}
                {selected.requirementCoverage?.gate_failed ? (
                  <Badge variant="danger">Gate failed</Badge>
                ) : (
                  <Badge variant="success">Gate passed</Badge>
                )}
                {(() => {
                  const round = roundForRun(selected);
                  if (!round) return null;
                  return (
                    <Badge variant="outline" className="border-purple-500/40 text-purple-300">
                      {round}
                    </Badge>
                  );
                })()}
              </div>
              <h3 className="mt-3 text-lg font-semibold leading-tight">{selected.project}</h3>
              <p className="text-xs text-muted-foreground">
                requirements {selected.requirementsVersion} · {selected.date}
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Composite</dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">
                    {(selected.scores.composite ?? 0).toFixed(3)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Human</dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">
                    {(selected.humanReview?.score ?? 0).toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Tokens</dt>
                  <dd className="text-sm font-medium tabular-nums text-foreground">
                    {fmtTokensLong(selected.tokenUsage?.total_tokens)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Build time</dt>
                  <dd className="text-sm font-medium tabular-nums text-foreground">
                    {fmtDuration(selected.timing?.duration_minutes)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Commits</dt>
                  <dd className="text-sm font-medium tabular-nums text-foreground">
                    {selected.gitAnalysis?.total_commits ?? "—"}
                  </dd>
                </div>
              </dl>

              {selected.humanReview?.notes && (
                <p className="mt-5 border-t border-border/60 pt-5 text-sm leading-6 text-muted-foreground">
                  {selected.humanReview.notes}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href={`/runs/${selected.project}/${selected.version}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  <BarChart3 size={11} aria-hidden />
                  Full breakdown
                </Link>
                <a
                  href={`${REPO}/tree/main/evals/${selected.project}/${selected.version}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  Source on GitHub
                  <ExternalLink size={11} aria-hidden />
                </a>
                {selected.requirementsDoc && (
                  <button
                    type="button"
                    onClick={() => setModal("requirements")}
                    className="inline-flex items-center gap-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
                  >
                    <FileText size={11} aria-hidden />
                    <span className="underline decoration-dotted underline-offset-2">
                      {selected.requirementsDoc.filename}
                    </span>
                  </button>
                )}
                {selected.topSkill && (
                  <button
                    type="button"
                    onClick={() => setModal("skill")}
                    disabled={!selected.topSkill.content}
                    className="inline-flex items-center gap-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-accent disabled:opacity-60 disabled:hover:text-muted-foreground"
                    title={
                      selected.topSkill.total_skills > 1
                        ? `Top skill — ${selected.topSkill.total_skills} skills authored this run`
                        : "Top skill authored this run"
                    }
                  >
                    <Sparkles size={11} aria-hidden className="text-amber-400" />
                    <span className="underline decoration-dotted underline-offset-2">
                      {selected.topSkill.filename}
                    </span>
                    {selected.topSkill.total_skills > 1 && (
                      <span className="text-[10px] text-muted-foreground/70">
                        (+{selected.topSkill.total_skills - 1})
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {modal && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {modal === "requirements" ? "Game requirements" : "Top skill"} ·{" "}
                  {selected.project}/{selected.version}
                </p>
                <h3 className="mt-1 truncate text-lg font-semibold text-foreground">
                  {modal === "requirements"
                    ? selected.requirementsDoc?.filename
                    : selected.topSkill?.filename}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-full border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                aria-label="Close"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-background/60 p-6">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-muted-foreground">
                {modal === "requirements"
                  ? selected.requirementsDoc?.content
                  : selected.topSkill?.content ?? "(skill file content unavailable)"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
