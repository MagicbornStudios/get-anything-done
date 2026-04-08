/**
 * Static eval results — copied from vendor/get-anything-done/evals/<project>/<version>/TRACE.json
 * at the time the site was built. Source of truth lives in the eval directories; this file
 * is regenerated whenever a new round publishes.
 */

export type Workflow = "gad" | "bare" | "emergent";

export interface EvalRun {
  project: string;
  version: string;
  workflow: Workflow;
  requirementsVersion: string;
  date: string;
  composite: number;
  humanReview: number;
  gateFailed: boolean;
  notes: string;
}

export const EVAL_RUNS: EvalRun[] = [
  {
    project: "escape-the-dungeon",
    version: "v7",
    workflow: "gad",
    requirementsVersion: "v3",
    date: "2026-04-08",
    composite: 0.668,
    humanReview: 0.3,
    gateFailed: false,
    notes:
      "Passed gate technically; human review noted unintentional UI polish and combat felt rote.",
  },
  {
    project: "escape-the-dungeon",
    version: "v8",
    workflow: "gad",
    requirementsVersion: "v3",
    date: "2026-04-08",
    composite: 0.177,
    humanReview: 0.2,
    gateFailed: true,
    notes:
      "Crafting system broke the game when used. ASCII map, no sourced sprites. Rate-limited mid-run.",
  },
  {
    project: "escape-the-dungeon-bare",
    version: "v1",
    workflow: "bare",
    requirementsVersion: "v3",
    date: "2026-04-08",
    composite: 0.198,
    humanReview: 0.1,
    gateFailed: true,
    notes: "Main menu rendered but New Game didn't fire — KAPLAY click area missing.",
  },
  {
    project: "escape-the-dungeon-bare",
    version: "v2",
    workflow: "bare",
    requirementsVersion: "v3",
    date: "2026-04-08",
    composite: 0.601,
    humanReview: 0.5,
    gateFailed: false,
    notes: "Most playable yet, but raw ASCII UI and no rune forge.",
  },
  {
    project: "escape-the-dungeon-bare",
    version: "v3",
    workflow: "bare",
    requirementsVersion: "v3",
    date: "2026-04-08",
    composite: 0.526,
    humanReview: 0.7,
    gateFailed: false,
    notes:
      "Highest human review across all runs. Inspired the freedom hypothesis: less framework, more output.",
  },
  {
    project: "escape-the-dungeon-emergent",
    version: "v1",
    workflow: "emergent",
    requirementsVersion: "v3",
    date: "2026-04-08",
    composite: 0.303,
    humanReview: 0.1,
    gateFailed: false,
    notes: "Crashed on KAPLAY styled-text — captured the failure as a skill for v2.",
  },
  {
    project: "escape-the-dungeon-emergent",
    version: "v2",
    workflow: "emergent",
    requirementsVersion: "v3",
    date: "2026-04-08",
    composite: 0.478,
    humanReview: 0.5,
    gateFailed: false,
    notes: "Inherited skills paid off — no repeat of v1's crash.",
  },
];

export const WORKFLOW_LABELS: Record<Workflow, string> = {
  gad: "GAD",
  bare: "Bare",
  emergent: "Emergent",
};

export const WORKFLOW_DESCRIPTIONS: Record<Workflow, string> = {
  gad: "Full GAD framework: .planning/ XML, AGENTS.md loop, skill triggers, plan/execute/verify cycle.",
  bare: "No framework. Agent builds the game however it wants. Workflow artifacts only mandated to live under game/.planning/.",
  emergent:
    "No framework, but inherits skills from previous bare/emergent runs. Evolves them in place and writes a CHANGELOG.",
};
