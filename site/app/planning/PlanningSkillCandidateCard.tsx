"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Ref } from "@/components/refs/Ref";
import type { SkillCandidate } from "./planning-skill-candidates-types";
import { SKILL_CANDIDATE_REVIEW_COLORS } from "./planning-skill-candidates-types";

type PlanningSkillCandidateCardProps = {
  candidate: SkillCandidate;
  isOpen: boolean;
  onToggleOpen: () => void;
};

export function PlanningSkillCandidateCard({ candidate, isOpen, onToggleOpen }: PlanningSkillCandidateCardProps) {
  const isReviewed = candidate.reviewed !== false;

  return (
    <div
      className={[
        "rounded-xl border p-5",
        isReviewed ? "border-border/40 bg-card/20 opacity-80" : "border-border/60 bg-card/40",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Ref id={candidate.source_phase} />
        <Badge variant="default" className="border-transparent bg-amber-500/15 text-amber-400">
          pressure {candidate.pressure_score}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          System
        </Badge>
        {isReviewed && (
          <span
            className={[
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              SKILL_CANDIDATE_REVIEW_COLORS[candidate.reviewed as string] || "border-border/50 text-muted-foreground",
            ].join(" ")}
          >
            {candidate.reviewed}
          </span>
        )}
      </div>

      <h4 className="mt-3 text-sm font-semibold text-foreground">
        {candidate.source_phase_title || `Phase ${candidate.source_phase}`}
      </h4>

      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground/70">{candidate.file_path}</p>

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
          <dt className="uppercase tracking-wider text-muted-foreground/70">Tasks</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {candidate.tasks_done}/{candidate.tasks_total}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-muted-foreground/70">Crosscuts</dt>
          <dd className="font-medium tabular-nums text-foreground">{candidate.crosscuts}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-muted-foreground/70">Score</dt>
          <dd className="font-medium tabular-nums text-amber-400">{candidate.pressure_score}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-3 text-[11px] font-semibold">
        <button type="button" onClick={onToggleOpen} className="text-accent hover:underline">
          {isOpen ? "Hide" : "Show"} source phase tasks ({candidate.tasks.length})
        </button>
        <Link
          href={`/skills/candidates/${candidate.name}`}
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          View full candidate <ExternalLink size={11} />
        </Link>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
          {candidate.tasks.map((t) => (
            <div key={t.id} className="flex items-start gap-2 text-[11px]">
              <Ref id={t.id} />
              <Badge variant="outline" className="shrink-0 text-[9px] uppercase">
                {t.status}
              </Badge>
              <p className="line-clamp-2 flex-1 leading-4 text-muted-foreground">{t.goal}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
