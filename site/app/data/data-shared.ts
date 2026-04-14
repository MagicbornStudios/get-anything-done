import {
  ALL_DECISIONS,
  ALL_TASKS,
  ALL_PHASES,
  GLOSSARY,
  OPEN_QUESTIONS,
  BUGS,
} from "@/lib/eval-data";

export interface DataSource {
  id: string;
  surface: string;
  number: string;
  source: string;
  formula?: string;
  trust: "deterministic" | "self-report" | "human" | "authored";
  page: string;
  notes?: string;
}

export function buildDataSources(): DataSource[] {
  return [
    // Hero stats
    {
      id: "playable-count",
      surface: "Hero",
      number: "Playable runs",
      source: "PLAYABLE_INDEX (lib/eval-data.generated.ts)",
      formula: "Object.keys(PLAYABLE_INDEX).length",
      trust: "deterministic",
      page: "/",
      notes: "Set at prebuild from auditPlayable() — counts directories under apps/portfolio/public/evals/<project>/<version>/.",
    },
    {
      id: "runs-scored",
      surface: "Hero",
      number: "Runs scored",
      source: "EVAL_RUNS",
      formula: "EVAL_RUNS.filter(r => r.scores.composite != null).length",
      trust: "deterministic",
      page: "/",
    },
    {
      id: "decisions-logged",
      surface: "Hero",
      number: "Decisions logged",
      source: "ALL_DECISIONS",
      formula: "ALL_DECISIONS.length (parseAllDecisions() over .planning/DECISIONS.xml)",
      trust: "deterministic",
      page: "/",
    },
    // Per-run cards
    {
      id: "composite",
      surface: "Per-run card",
      number: "Composite score",
      source: "TRACE.json scores.composite",
      formula: "Σ_dimensions (weight * dimension_score), capped by gate failures",
      trust: "self-report",
      page: "/runs/[project]/[version]",
      notes: "Composite is currently agent-self-reported in TRACE.json. Programmatic alternative tracked under GAPS.md G1 (deferred until UI stabilizes per gad-99).",
    },
    {
      id: "human-review",
      surface: "Per-run card",
      number: "Human review aggregate",
      source: "TRACE.json human_review (rubric form)",
      formula: "Σ_dimensions (weight * score) per project's human_review_rubric",
      trust: "human",
      page: "/runs/[project]/[version]",
      notes: "Submitted via `gad eval review --rubric '{...}'`. Per-dimension scoring per gad-61 / decision gad-70.",
    },
    // Pressure
    {
      id: "pressure-by-round",
      surface: "Roadmap",
      number: "Pressure rating per round",
      source: "pressureForRound() and constants in app/roadmap/roadmap-shared.ts",
      formula: "f(requirement complexity, ambiguity, constraint density, iteration budget, failure cost) — currently authored",
      trust: "authored",
      page: "/roadmap",
      notes: "Will become programmatic when the pressure-score-formula open question resolves. See gad-75.",
    },
    // CSH
    {
      id: "skill-inheritance-effectiveness",
      surface: "Emergent",
      number: "Skill inheritance effectiveness",
      source: "TRACE.json human_review.dimensions.skill_inheritance_effectiveness",
      formula: "Human-rated 0.0–1.0 on whether the run productively inherited + evolved + authored skills",
      trust: "human",
      page: "/skeptic",
      notes: "The compound-skills hypothesis test signal. Hygiene component (file-mutation events + CHANGELOG validity) is queued as GAPS G11 — automatable.",
    },
    // Tool use mix
    {
      id: "tool-use-mix",
      surface: "Per-run page",
      number: "Tool-use mix",
      source: "TRACE.json derived.tool_use_mix",
      formula: "Counts of tool_use events per tool name from the trace stream",
      trust: "deterministic",
      page: "/runs/[project]/[version]",
      notes: "Reference pattern for all new programmatic metrics — see GAPS.md G4.",
    },
    // Plan adherence
    {
      id: "plan-adherence-delta",
      surface: "Per-run page",
      number: "Plan-adherence delta",
      source: "TRACE.json derived.plan_adherence_delta",
      formula: "(tasks_committed - tasks_planned) / tasks_planned",
      trust: "deterministic",
      page: "/runs/[project]/[version]",
    },
    // Commits
    {
      id: "commit-rhythm",
      surface: "Per-run page",
      number: "Commit count + per-task discipline",
      source: "TRACE.json gitAnalysis (git log over the run's worktree)",
      formula: "Counts of commits, batch vs per-task, ratio of task-id-prefixed commits to total",
      trust: "deterministic",
      page: "/runs/[project]/[version]",
    },
    // Counts on planning pages
    {
      id: "decisions-count",
      surface: "/decisions",
      number: `Total decisions (${ALL_DECISIONS.length})`,
      source: "ALL_DECISIONS",
      formula: "parseAllDecisions() walks .planning/DECISIONS.xml",
      trust: "deterministic",
      page: "/decisions",
    },
    {
      id: "tasks-count",
      surface: "/planning (tasks tab)",
      number: `Total tasks (${ALL_TASKS.length})`,
      source: "ALL_TASKS",
      formula: "parseAllTasks() walks .planning/TASK-REGISTRY.xml",
      trust: "deterministic",
      page: "/planning?tab=tasks",
    },
    {
      id: "phases-count",
      surface: "/planning (phases tab)",
      number: `Total phases (${ALL_PHASES.length})`,
      source: "ALL_PHASES",
      formula: "parseAllPhases() walks .planning/ROADMAP.xml",
      trust: "deterministic",
      page: "/planning?tab=phases",
    },
    {
      id: "glossary-count",
      surface: "/glossary",
      number: `Glossary terms (${GLOSSARY.length})`,
      source: "GLOSSARY",
      formula: "data/glossary.json terms[]",
      trust: "authored",
      page: "/glossary",
    },
    {
      id: "questions-count",
      surface: "/questions",
      number: `Open questions (${OPEN_QUESTIONS.length})`,
      source: "OPEN_QUESTIONS",
      formula: "data/open-questions.json questions[]",
      trust: "authored",
      page: "/questions",
    },
    {
      id: "bugs-count",
      surface: "/planning (bugs tab)",
      number: `Tracked bugs (${BUGS.length})`,
      source: "BUGS",
      formula: "data/bugs.json bugs[]",
      trust: "authored",
      page: "/planning?tab=bugs",
    },
  ];
}

export const TRUST_TINT: Record<DataSource["trust"], "success" | "default" | "outline" | "danger"> = {
  deterministic: "success",
  "self-report": "danger",
  human: "default",
  authored: "outline",
};

export const TRUST_DESCRIPTION: Record<DataSource["trust"], string> = {
  deterministic:
    "Computed by code from raw inputs at prebuild. Same inputs always produce the same number. Highest trust.",
  "self-report": "The agent put this number into TRACE.json itself. Lowest trust.",
  human: "A human submitted this via the rubric review CLI. Trustable but not scalable.",
  authored: "Hand-curated content (glossary, decisions, requirements). Trust is editorial.",
};

export function groupBySurface(sources: DataSource[]) {
  const groups = new Map<string, DataSource[]>();
  for (const s of sources) {
    const arr = groups.get(s.surface) ?? [];
    arr.push(s);
    groups.set(s.surface, arr);
  }
  return [...groups.entries()];
}
