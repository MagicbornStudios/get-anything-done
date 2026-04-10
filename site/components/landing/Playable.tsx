"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Gamepad2, FileText, Sparkles, X, BarChart3, Filter } from "lucide-react";
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
    id: "gad-requirements-gui",
    label: "GAD Requirements GUI",
    description: "Interactive requirements editor — planned eval for tooling workflows",
    projects: ["gad-requirements-gui"],
  },
];

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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [modal, setModal] = useState<"requirements" | "skill" | null>(null);

  // Parse round filter from URL hash on mount
  useEffect(() => {
    setRoundFilter(parseRoundFromHash());
  }, []);

  // Listen for round-filter custom events from the chart
  useEffect(() => {
    function onRoundFilter(e: Event) {
      const detail = (e as CustomEvent).detail as string | null;
      setRoundFilter(detail);
      // Reset selection when filter changes
      setSelectedKey(null);
    }
    function onHashChange() {
      setRoundFilter(parseRoundFromHash());
    }
    window.addEventListener("round-filter", onRoundFilter);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("round-filter", onRoundFilter);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  // Filter runs by round
  const runs = useMemo(() => {
    if (!roundFilter) return allRuns;
    return allRuns.filter((r) => roundForRun(r) === roundFilter);
  }, [allRuns, roundFilter]);

  // Group filtered runs by project family
  const groupedRuns = useMemo(() => {
    return PROJECT_FAMILIES.map((family) => {
      const familyRuns = runs.filter((r) => family.projects.includes(r.project));
      return { ...family, runs: familyRuns };
    }).filter((g) => g.runs.length > 0);
  }, [runs]);

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
          to filter, or browse all runs below.
          Rate-limited runs with no functioning UI are omitted.
        </p>

        {/* Round filter indicator */}
        {roundFilter && (
          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-300">
              <Filter size={13} aria-hidden />
              Showing {roundFilter} only ({runs.length} build{runs.length !== 1 ? "s" : ""})
            </span>
            <button
              type="button"
              onClick={() => {
                setRoundFilter(null);
                setSelectedKey(null);
                window.history.replaceState(null, "", window.location.pathname + "#play");
                window.dispatchEvent(new CustomEvent("round-filter", { detail: null }));
              }}
              className="text-xs text-muted-foreground underline decoration-dotted hover:text-foreground"
            >
              Show all rounds
            </button>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
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
        {groupedRuns.map((group) => (
          <div key={group.id} className="mt-6">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
              <span className="text-[11px] text-muted-foreground">{group.description}</span>
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
                      <span className="text-[10px] text-muted-foreground/60">
                        {round.replace("Round ", "R")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* No results state */}
        {runs.length === 0 && roundFilter && (
          <div className="mt-8 rounded-2xl border border-border/70 bg-card/30 p-8 text-center">
            <p className="text-lg font-semibold text-muted-foreground">
              No playable builds in {roundFilter}
            </p>
            <p className="mt-2 text-sm text-muted-foreground/70">
              This round may not have scored builds yet, or all runs were rate-limited.
            </p>
            <button
              type="button"
              onClick={() => {
                setRoundFilter(null);
                window.history.replaceState(null, "", window.location.pathname + "#play");
                window.dispatchEvent(new CustomEvent("round-filter", { detail: null }));
              }}
              className="mt-4 inline-flex items-center gap-1 rounded-full border border-accent/60 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
            >
              Show all rounds
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
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Duration</dt>
                  <dd className="text-sm font-medium tabular-nums text-foreground">
                    {selected.timing?.duration_minutes != null
                      ? `${selected.timing.duration_minutes}m`
                      : "—"}
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
