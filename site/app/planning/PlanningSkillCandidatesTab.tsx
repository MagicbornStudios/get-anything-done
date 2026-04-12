"use client";

import { useState, useMemo } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Ref } from "@/components/refs/Ref";

export interface SkillCandidateTask {
  id: string;
  status: string;
  goal: string;
}

export type ReviewState = false | "promoted" | "merged" | "discarded";

export interface SkillCandidate {
  name: string;
  source_phase: string;
  source_phase_title: string;
  pressure_score: number;
  tasks_total: number;
  tasks_done: number;
  crosscuts: number;
  file_path: string;
  reviewed: ReviewState;
  reviewed_on: string | null;
  reviewed_notes: string | null;
  tasks: SkillCandidateTask[];
}

type FilterMode = "all" | "unreviewed" | "reviewed";

const REVIEW_STATE_COLORS: Record<string, string> = {
  promoted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  merged: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  discarded: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
};

export function PlanningSkillCandidatesTab({ candidates }: { candidates: SkillCandidate[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("unreviewed");

  const filtered = useMemo(() => {
    if (filter === "all") return candidates;
    if (filter === "unreviewed") return candidates.filter((c) => c.reviewed === false);
    return candidates.filter((c) => c.reviewed !== false);
  }, [candidates, filter]);

  const counts = useMemo(() => {
    const unreviewed = candidates.filter((c) => c.reviewed === false).length;
    const reviewed = candidates.length - unreviewed;
    return { unreviewed, reviewed, all: candidates.length };
  }, [candidates]);

  return (
    <div>
      {/* Header with info icon + hovercard explanation */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Skill candidates from high-pressure phases
        </h3>
        <HoverCard openDelay={100}>
          <HoverCardTrigger asChild>
            <button type="button" className="inline-flex items-center text-muted-foreground hover:text-accent" aria-label="What is a skill candidate?">
              <Info size={14} />
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-96" side="bottom" align="start">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">What is a skill candidate?</p>
              <p className="text-xs leading-5 text-muted-foreground">
                When a phase exceeds the <strong>pressure threshold</strong>, the self-eval pipeline auto-drafts a{" "}
                <code className="rounded bg-card/60 px-1 text-accent">SKILL.md</code> file for review. High pressure signals
                that patterns likely exist in that phase that could become a reusable skill.
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                <strong>Pressure formula:</strong>{" "}
                <code className="rounded bg-card/60 px-1 text-accent">pressure = tasks_total + (crosscuts × crosscut_weight)</code>
                . A phase is high-pressure when{" "}
                <code className="rounded bg-card/60 px-1 text-accent">pressure &gt; threshold</code>. Weights and threshold
                are configurable in <code className="rounded bg-card/60 px-1 text-accent">site/data/self-eval-config.json</code>.
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Candidates are <strong>quarantined</strong> — they live in{" "}
                <code className="rounded bg-card/60 px-1 text-accent">.agents/skills/candidates/</code>{" "}
                with <code className="rounded bg-card/60 px-1 text-accent">status: candidate</code> in their frontmatter,
                excluded from the catalog scan, and unavailable to GAD until promoted.
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                <strong>Review lifecycle:</strong> each candidate has a{" "}
                <code className="rounded bg-card/60 px-1 text-accent">reviewed</code> field. Set it to{" "}
                <code className="rounded bg-card/60 px-1 text-accent">promoted</code>,{" "}
                <code className="rounded bg-card/60 px-1 text-accent">merged</code>, or{" "}
                <code className="rounded bg-card/60 px-1 text-accent">discarded</code> and the pipeline stops regenerating
                the draft. Reviewed candidates stay on the site as history so you can see what you already decided.
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                Decisions: <Ref id="gad-115" />, <Ref id="gad-144" />, <Ref id="gad-145" />
              </p>
            </div>
          </HoverCardContent>
        </HoverCard>

        {/* Filter chips */}
        <div className="ml-auto flex items-center gap-1.5">
          {(["unreviewed", "reviewed", "all"] as const).map((mode) => {
            const isActive = filter === mode;
            const count = counts[mode];
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setFilter(mode)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                  isActive
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60",
                ].join(" ")}
              >
                {mode}
                <span className="tabular-nums text-muted-foreground/70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filter === "unreviewed"
            ? "All candidates have been reviewed. Switch to 'all' or 'reviewed' to see history."
            : filter === "reviewed"
              ? "No candidates have been reviewed yet."
              : "No high-pressure phases detected. Candidates are regenerated each prebuild."}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((candidate) => {
            const isOpen = selected === candidate.name;
            const isReviewed = candidate.reviewed !== false;
            return (
              <div
                key={candidate.name}
                className={[
                  "rounded-xl border p-5",
                  isReviewed ? "border-border/40 bg-card/20 opacity-80" : "border-border/60 bg-card/40",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Ref id={candidate.source_phase} />
                  <Badge variant="default" className="bg-amber-500/15 text-amber-400 border-transparent">
                    pressure {candidate.pressure_score}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    System
                  </Badge>
                  {isReviewed && (
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        REVIEW_STATE_COLORS[candidate.reviewed as string] || "border-border/50 text-muted-foreground",
                      ].join(" ")}
                    >
                      {candidate.reviewed}
                    </span>
                  )}
                </div>

                <h4 className="mt-3 text-sm font-semibold text-foreground">
                  {candidate.source_phase_title || `Phase ${candidate.source_phase}`}
                </h4>

                <p className="mt-1 text-[11px] font-mono text-muted-foreground/70 break-all">
                  {candidate.file_path}
                </p>

                {isReviewed && candidate.reviewed_notes && (
                  <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      Review notes {candidate.reviewed_on && `· ${candidate.reviewed_on}`}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-foreground">{candidate.reviewed_notes}</p>
                  </div>
                )}

                <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <dt className="text-muted-foreground/70 uppercase tracking-wider">Tasks</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {candidate.tasks_done}/{candidate.tasks_total}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground/70 uppercase tracking-wider">Crosscuts</dt>
                    <dd className="font-medium tabular-nums text-foreground">{candidate.crosscuts}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground/70 uppercase tracking-wider">Score</dt>
                    <dd className="font-medium tabular-nums text-amber-400">{candidate.pressure_score}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => setSelected(isOpen ? null : candidate.name)}
                  className="mt-4 text-[11px] font-semibold text-accent hover:underline"
                >
                  {isOpen ? "Hide" : "Show"} source phase tasks ({candidate.tasks.length})
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
                    {candidate.tasks.map((t) => (
                      <div key={t.id} className="flex items-start gap-2 text-[11px]">
                        <Ref id={t.id} />
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[9px] uppercase"
                        >
                          {t.status}
                        </Badge>
                        <p className="flex-1 leading-4 text-muted-foreground line-clamp-2">{t.goal}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
