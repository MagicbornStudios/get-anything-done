import type { ReviewState } from "@/app/planning/planning-skill-candidates-types";

export interface SkillCandidateDetail {
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
  body_html?: string;
  tasks: { id: string; status: string; goal: string }[];
}
