"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Ref } from "@/components/refs/Ref";

export interface SkillCandidateTask {
  id: string;
  status: string;
  goal: string;
}

export interface SkillCandidate {
  name: string;
  source_phase: string;
  source_phase_title: string;
  pressure_score: number;
  tasks_total: number;
  tasks_done: number;
  crosscuts: number;
  file_path: string;
  tasks: SkillCandidateTask[];
}

export function PlanningSkillCandidatesTab({ candidates }: { candidates: SkillCandidate[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      {/* Header with info icon + hovercard explanation */}
      <div className="mb-6 flex items-center gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} from high-pressure phases
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
                When a phase exceeds the <strong>pressure threshold</strong> (task count + weighted crosscuts above 10),
                the self-eval pipeline auto-drafts a <code className="rounded bg-card/60 px-1 text-accent">SKILL.md</code> file
                for review. High pressure signals that patterns likely exist in that phase that could become a reusable skill.
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Candidates are <strong>quarantined</strong> — they live in{" "}
                <code className="rounded bg-card/60 px-1 text-accent">.agents/skills/candidates/</code>{" "}
                with <code className="rounded bg-card/60 px-1 text-accent">status: candidate</code> in their frontmatter.
                They are excluded from the catalog scan and are not available to GAD until a human promotes them.
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Review actions: <strong>promote</strong> to a real skill, <strong>merge</strong> into an existing skill via{" "}
                <code className="rounded bg-card/60 px-1 text-accent">gad:merge-skill</code>, or <strong>discard</strong>.
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                Decisions: GAD-D-115 (pressure drives skill creation), GAD-D-144 (candidate quarantine)
              </p>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No high-pressure phases detected in the current self-eval snapshot. Candidates are regenerated each prebuild.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {candidates.map((candidate) => {
            const isOpen = selected === candidate.name;
            return (
              <div
                key={candidate.name}
                className="rounded-xl border border-border/60 bg-card/40 p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Ref id={candidate.source_phase} />
                  <Badge variant="default" className="bg-amber-500/15 text-amber-400 border-transparent">
                    pressure {candidate.pressure_score}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    System
                  </Badge>
                </div>

                <h4 className="mt-3 text-sm font-semibold text-foreground">
                  {candidate.source_phase_title || `Phase ${candidate.source_phase}`}
                </h4>

                <p className="mt-1 text-[11px] font-mono text-muted-foreground/70 break-all">
                  {candidate.file_path}
                </p>

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
