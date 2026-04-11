import type { Workflow } from "@/lib/eval-data";

export const SCORE_WEIGHTS: Array<{ key: string; label: string; weight: number; gist: string }> = [
  { key: "human_review", label: "Human review", weight: 0.3, gist: "Subjective quality vote — gates everything." },
  { key: "requirement_coverage", label: "Requirement coverage", weight: 0.15, gist: "How many gate criteria the artifact passes." },
  { key: "planning_quality", label: "Planning quality", weight: 0.15, gist: "Phases, tasks, and decisions actually captured." },
  { key: "per_task_discipline", label: "Per-task discipline", weight: 0.15, gist: "Atomic commits with task IDs vs batch dumps." },
  { key: "skill_accuracy", label: "Skill accuracy", weight: 0.10, gist: "Did the agent invoke skills when their triggers fired?" },
  { key: "time_efficiency", label: "Time efficiency", weight: 0.05, gist: "Wall-clock vs the project's expected envelope." },
];

export const FRAMEWORK_WORKFLOW_ORDER: Workflow[] = ["gad", "bare", "emergent"];
