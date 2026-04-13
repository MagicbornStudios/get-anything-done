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
  body_raw?: string;
  tasks: SkillCandidateTask[];
  // Phase 42 — two-stage pipeline fields. Optional for backwards compat.
  stage?: "candidate" | "drafted";
  candidate_file?: string;
  proto_skill_dir?: string | null;
}

export type SkillCandidateFilterMode = "all" | "unreviewed" | "reviewed";

export const SKILL_CANDIDATE_REVIEW_COLORS: Record<string, string> = {
  promoted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  merged: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  discarded: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
};
