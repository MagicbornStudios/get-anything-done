"use client";

import { useState, useMemo } from "react";
import { Identified } from "@/components/devid/Identified";
import type { SkillCandidate, SkillCandidateFilterMode } from "./planning-skill-candidates-types";
import { PlanningSkillCandidateCard } from "./PlanningSkillCandidateCard";
import { PlanningSkillCandidatesHeader } from "./PlanningSkillCandidatesHeader";

export type { SkillCandidate, SkillCandidateTask, ReviewState } from "./planning-skill-candidates-types";

export function PlanningSkillCandidatesTab({ candidates }: { candidates: SkillCandidate[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<SkillCandidateFilterMode>("unreviewed");

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
      <Identified as="PlanningSkillCandidatesHeader">
        <PlanningSkillCandidatesHeader filter={filter} onFilter={setFilter} counts={counts} />
      </Identified>

      {filtered.length === 0 ? (
        <Identified as="PlanningSkillCandidatesTabEmpty">
        <p className="text-sm text-muted-foreground">
          {filter === "unreviewed"
            ? "All candidates have been reviewed. Switch to 'all' or 'reviewed' to see history."
            : filter === "reviewed"
              ? "No candidates have been reviewed yet."
              : "No high-pressure phases detected. Candidates are regenerated each prebuild."}
        </p>
        </Identified>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((candidate) => (
            <Identified key={candidate.name} as={`PlanningSkillCandidateCard-${candidate.name.replace(/[^a-zA-Z0-9]+/g, "-")}`}>
              <PlanningSkillCandidateCard
                candidate={candidate}
                isOpen={selected === candidate.name}
                onToggleOpen={() => setSelected(selected === candidate.name ? null : candidate.name)}
              />
            </Identified>
          ))}
        </div>
      )}
    </div>
  );
}
