/**
 * Auto-generated from evals/<project>/<version>/TRACE.json files.
 * DO NOT EDIT BY HAND — run `npm run prebuild` to regenerate.
 */

export type Workflow = "gad" | "bare" | "emergent";

export type EvalScores = {
  requirement_coverage?: number | null;
  planning_quality?: number | null;
  per_task_discipline?: number | null;
  skill_accuracy?: number | null;
  time_efficiency?: number | null;
  human_review?: number | null;
  workflow_emergence?: number | null;
  implementation_quality?: number | null;
  iteration_evidence?: number | null;
  composite?: number | null;
} & Record<string, number | null | undefined>;

export interface EvalRunRecord {
  project: string;
  version: string;
  workflow: Workflow;
  requirementsVersion: string;
  date: string | null;
  gadVersion: string | null;
  evalType: string;
  contextMode: string | null;
  timing:
    | ({
        duration_minutes?: number | null;
        phases_completed?: number | null;
        tasks_completed?: number | null;
      } & Record<string, unknown>)
    | null;
  tokenUsage:
    | ({
        total_tokens?: number | null;
        tool_uses?: number | null;
        note?: string | null;
      } & Record<string, unknown>)
    | null;
  gitAnalysis:
    | ({
        total_commits?: number | null;
        task_id_commits?: number | null;
        batch_commits?: number | null;
        per_task_discipline?: number | null;
      } & Record<string, unknown>)
    | null;
  requirementCoverage:
    | ({
        total_criteria?: number | null;
        gate_failed?: boolean | null;
        gate_notes?: string | null;
        fully_met?: number | null;
        partially_met?: number | null;
        not_met?: number | null;
        coverage_ratio?: number | null;
      } & Record<string, unknown>)
    | null;
  workflowEmergence:
    | ({
        created_task_lists?: boolean | null;
        created_state_tracking?: boolean | null;
        created_architecture_docs?: boolean | null;
        created_reusable_skills?: boolean | null;
        emergence_score?: number | null;
      } & Record<string, unknown>)
    | null;
  planningQuality:
    | ({
        phases_planned?: number | null;
        tasks_planned?: number | null;
        tasks_completed?: number | null;
        decisions_captured?: number | null;
      } & Record<string, unknown>)
    | null;
  scores: EvalScores;
  humanReview:
    | ({
        score?: number | null;
        notes?: string | null;
        reviewed_by?: string | null;
        reviewed_at?: string | null;
      } & Record<string, unknown>)
    | null;
}

export interface EvalTemplateAsset {
  project: string;
  zipPath: string;
  bytes: number;
}

export interface PlanningZipAsset {
  project: string;
  zipPath: string;
  bytes: number;
  files: number;
}

export interface RoundSummary {
  round: string;
  title: string;
  body: string;
}

export const EVAL_RUNS: EvalRunRecord[] = [
  {
    "project": "escape-the-dungeon",
    "version": "v1",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-06",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-06T21:39:38.637Z",
      "ended": "2026-04-06T21:39:39.663Z",
      "duration_minutes": 0,
      "phases_completed": 0,
      "tasks_completed": 0
    },
    "tokenUsage": null,
    "gitAnalysis": null,
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 0,
      "tasks_planned": 0,
      "tasks_completed": 0,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 0
    },
    "scores": {
      "cli_efficiency": 0,
      "skill_accuracy": null,
      "planning_quality": null,
      "time_efficiency": 1,
      "composite": null
    },
    "humanReview": {
      "score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v2",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-06",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-06T21:30:50.000Z",
      "ended": "2026-04-07T00:25:05.000Z",
      "duration_minutes": 174,
      "phases_completed": 0,
      "tasks_completed": 34
    },
    "tokenUsage": null,
    "gitAnalysis": {
      "total_commits": 4,
      "task_id_commits": 1,
      "batch_commits": 1,
      "source_files_created": 18,
      "state_updates": 0,
      "decisions_added": 0,
      "per_task_discipline": 0.029411764705882353
    },
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 7,
      "tasks_planned": 35,
      "tasks_completed": 34,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 34
    },
    "scores": {
      "cli_efficiency": 0,
      "skill_accuracy": 0.6,
      "planning_quality": 0,
      "time_efficiency": 0.6375,
      "composite": 0.28485294117647053
    },
    "humanReview": {
      "score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v4",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T03:42:00.000Z",
      "ended": "2026-04-07T04:20:00.000Z",
      "duration_minutes": 38,
      "phases_completed": 10,
      "tasks_completed": 19
    },
    "tokenUsage": {
      "total_tokens": 136930,
      "tool_uses": 189
    },
    "gitAnalysis": {
      "total_commits": 19,
      "task_id_commits": 19,
      "batch_commits": 2,
      "source_files_created": 20,
      "state_updates": 19,
      "decisions_added": 0,
      "per_task_discipline": 0.89
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "fully_met": 12,
      "partially_met": 0,
      "not_met": 0,
      "coverage_ratio": 1
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 10,
      "tasks_planned": 19,
      "tasks_completed": 19,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 19,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 1,
      "planning_quality": 1,
      "skill_accuracy": 0.8,
      "time_efficiency": 0.92,
      "per_task_discipline": 0.89,
      "composite": 0.916
    },
    "humanReview": null
  },
  {
    "project": "escape-the-dungeon",
    "version": "v5",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T07:00:00.000Z",
      "ended": "2026-04-07T07:18:00.000Z",
      "duration_minutes": 18,
      "phases_completed": 12,
      "tasks_completed": 12
    },
    "tokenUsage": {
      "total_tokens": 92278,
      "tool_uses": 110
    },
    "gitAnalysis": {
      "total_commits": 11,
      "task_id_commits": 10,
      "batch_commits": 1,
      "source_files_created": 35,
      "state_updates": 12,
      "decisions_added": 0,
      "per_task_discipline": 0.83,
      "verify_commits": 1,
      "conventions_created": true
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "fully_met": 12,
      "partially_met": 0,
      "not_met": 0,
      "coverage_ratio": 1
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 12,
      "tasks_planned": 12,
      "tasks_completed": 12,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 12,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 1,
      "planning_quality": 1,
      "skill_accuracy": 1,
      "time_efficiency": 0.963,
      "per_task_discipline": 0.83,
      "composite": 0.8123,
      "human_review": 0,
      "auto_composite": null
    },
    "humanReview": {
      "score": 0,
      "notes": "Blank screen, no UI renders, no main menu, no playable content. Systems may exist in code but nothing visible. Eval must require vertical slice with playable demo.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T01:01:12.987Z"
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v6",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 20,
      "phases_completed": 8,
      "tasks_completed": 13
    },
    "tokenUsage": {
      "total_tokens": 138835,
      "tool_uses": 150
    },
    "gitAnalysis": {
      "total_commits": 13,
      "task_id_commits": 11,
      "batch_commits": 0,
      "per_task_discipline": 0.85
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": true,
      "gate_notes": "Build exists but renders blank screen on file:// open. ES module + KAPLAY canvas requires web server.",
      "fully_met": 0,
      "partially_met": 0,
      "not_met": 12,
      "coverage_ratio": 0
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 8,
      "tasks_planned": 13,
      "tasks_completed": 13,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 13,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 0,
      "planning_quality": 1,
      "per_task_discipline": 0.85,
      "skill_accuracy": 0.833,
      "time_efficiency": 0.958,
      "human_review": 0,
      "composite": 0.347,
      "auto_composite": null
    },
    "humanReview": {
      "score": 0,
      "notes": "Blank screen on file:// open. KAPLAY canvas game with ES module script requires web server. Gate criterion failed. Same failure mode as v5.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T02:00:00.000Z"
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v7",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 24,
      "phases_completed": 9,
      "tasks_completed": 17
    },
    "tokenUsage": {
      "total_tokens": 93632,
      "tool_uses": 137
    },
    "gitAnalysis": {
      "total_commits": 21,
      "task_id_commits": 17,
      "batch_commits": 0,
      "per_task_discipline": 0.81
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": false,
      "gate_notes": "Game renders, title screen works, combat works. But game loop breaks — after combat, player is stuck with no route back to room navigation.",
      "fully_met": 7,
      "partially_met": 3,
      "not_met": 2,
      "coverage_ratio": 0.708
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 9,
      "tasks_planned": 17,
      "tasks_completed": 17,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 17,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 0.708,
      "planning_quality": 1,
      "per_task_discipline": 0.81,
      "skill_accuracy": 0.833,
      "time_efficiency": 0.95,
      "human_review": 0.3,
      "composite": 0.668
    },
    "humanReview": {
      "score": 0.3,
      "notes": "Game renders, better UI/layout than other evals. But game loop is broken — after combat, player gets stuck with no navigation. Cannot progress past first encounter. UI is bland but structured. Has fallback data (good defensive coding). Score 0.30: renders and partially playable but broken core loop.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T03:00:00.000Z"
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v8",
    "workflow": "gad",
    "requirementsVersion": "v3",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 16,
      "phases_completed": 0,
      "tasks_completed": 0
    },
    "tokenUsage": {
      "total_tokens": 1291,
      "tool_uses": 62,
      "note": "rate-limited"
    },
    "gitAnalysis": {
      "total_commits": 0,
      "task_id_commits": 0,
      "batch_commits": 0,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": true,
      "gate_notes": "G1 (game-loop) partial — renders. G2 (spell-crafting) FAILED — crafting system broken, breaks the game when used. G3 (ui-quality) partial — has particle effects and colors, but text is hard to read, ASCII for map/spells/bags, no sourced sprites.",
      "fully_met": 2,
      "partially_met": 4,
      "not_met": 6,
      "coverage_ratio": 0.33
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 0,
      "tasks_planned": 0,
      "tasks_completed": 0,
      "decisions_captured": 0
    },
    "scores": {
      "requirement_coverage": 0.33,
      "planning_quality": 0,
      "per_task_discipline": 0,
      "skill_accuracy": 0.17,
      "time_efficiency": 0.967,
      "human_review": 0.2,
      "composite": 0.177
    },
    "humanReview": {
      "score": 0.2,
      "notes": "Better particle effects on main menu and better colors than previous GAD runs. However, crafting system broke the game when used (unusable). Old ASCII text design for map/spells/bags menus. Hard to read text. Added icons but didn't search for sourced sprites. 0 commits — rate limit hit before agent could finalize. Score 0.20: has some visual improvements but broken crafting gates it.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T06:00:00.000Z"
    }
  },
  {
    "project": "escape-the-dungeon-bare",
    "version": "v1",
    "workflow": "bare",
    "requirementsVersion": "unknown",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 12,
      "phases_completed": 7,
      "tasks_completed": 21
    },
    "tokenUsage": {
      "total_tokens": 67751,
      "tool_uses": 62
    },
    "gitAnalysis": {
      "total_commits": 2,
      "task_id_commits": 0,
      "batch_commits": 2,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": true,
      "gate_notes": "Build exists but renders blank screen on file:// open. Same ES module issue as GAD version.",
      "fully_met": 0,
      "partially_met": 0,
      "not_met": 12,
      "coverage_ratio": 0
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": true,
      "created_architecture_docs": true,
      "created_reusable_skills": true,
      "emergence_score": 1
    },
    "planningQuality": {
      "phases_planned": 7,
      "tasks_planned": 21,
      "tasks_completed": 21,
      "tasks_blocked": 0,
      "decisions_captured": 10,
      "state_updates": 0,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 0,
      "workflow_emergence": 1,
      "implementation_quality": 0,
      "iteration_evidence": 0,
      "time_efficiency": 0.975,
      "human_review": 0.1,
      "composite": 0.198
    },
    "humanReview": {
      "score": 0.1,
      "notes": "Main menu renders with New Game button visible. Cannot start game — clicking New Game does not progress. Broken build. Score 0.10 for rendering menu only.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T02:00:00.000Z"
    }
  },
  {
    "project": "escape-the-dungeon-bare",
    "version": "v2",
    "workflow": "bare",
    "requirementsVersion": "unknown",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 21,
      "phases_completed": 7,
      "tasks_completed": 0
    },
    "tokenUsage": {
      "total_tokens": 87661,
      "tool_uses": 110
    },
    "gitAnalysis": {
      "total_commits": 6,
      "task_id_commits": 0,
      "batch_commits": 6,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": false,
      "gate_notes": "Game renders, title works, New Game works, room navigation works, combat works, dialogue works, menus work. Very playable vertical slice. Missing: rune forge, icons, visual polish.",
      "fully_met": 9,
      "partially_met": 2,
      "not_met": 1,
      "coverage_ratio": 0.833
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": true,
      "created_architecture_docs": true,
      "created_reusable_skills": true,
      "emergence_score": 1
    },
    "planningQuality": {
      "phases_planned": 7,
      "tasks_planned": 0,
      "tasks_completed": 0,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 0.833,
      "workflow_emergence": 1,
      "implementation_quality": 0.7,
      "iteration_evidence": 0,
      "time_efficiency": 0.956,
      "human_review": 0.5,
      "composite": 0.601
    },
    "humanReview": {
      "score": 0.5,
      "notes": "Most playable game of all evals. Full game loop works: title → new game → rooms → combat → dialogue → navigation. UX and flow are good. UI is very ASCII/plain — needs spacing, icons, better styling. Color coding is good. No spell crafting despite rune system in requirements. Rest room doesn't offer forge. Score 0.50: playable vertical slice but visually rough.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T03:00:00.000Z"
    }
  },
  {
    "project": "escape-the-dungeon-bare",
    "version": "v3",
    "workflow": "bare",
    "requirementsVersion": "v3",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 15,
      "phases_completed": 0,
      "tasks_completed": 0
    },
    "tokenUsage": {
      "total_tokens": 1877,
      "tool_uses": 53,
      "note": "rate-limited — single giant commit"
    },
    "gitAnalysis": {
      "total_commits": 1,
      "task_id_commits": 0,
      "batch_commits": 1,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": false,
      "gate_notes": "G1 (game-loop) partial — playable but no floor progression after boss. G2 (spell-crafting) not clearly implemented. G3 (ui-quality) BEST of round 3 — best UI/UX by far.",
      "fully_met": 8,
      "partially_met": 3,
      "not_met": 1,
      "coverage_ratio": 0.792
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": false,
      "created_architecture_docs": true,
      "created_reusable_skills": false,
      "emergence_score": 0.5
    },
    "planningQuality": null,
    "scores": {
      "requirement_coverage": 0.792,
      "workflow_emergence": 0.5,
      "implementation_quality": 0.75,
      "iteration_evidence": 0,
      "time_efficiency": 0.969,
      "human_review": 0.7,
      "composite": 0.526
    },
    "humanReview": {
      "score": 0.7,
      "notes": "Best UI/UX of all eval runs by far. Most enjoyable and playable. Functional game loop with combat and dialogue. Missing: floor progression after boss (can grind same floor), no clear spell crafting path. Regressed on commit discipline under pressure (1 giant commit vs v2's 6). Score 0.70: most enjoyable game across all experiments.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T06:00:00.000Z"
    }
  },
  {
    "project": "escape-the-dungeon-emergent",
    "version": "v1",
    "workflow": "emergent",
    "requirementsVersion": "unknown",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 14,
      "phases_completed": 7,
      "tasks_completed": 0
    },
    "tokenUsage": {
      "total_tokens": 67375,
      "tool_uses": 79
    },
    "gitAnalysis": {
      "total_commits": 2,
      "task_id_commits": 0,
      "batch_commits": 2,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": false,
      "gate_notes": "Main menu renders, recognized saved game. But entering game gives error: 'Styled text error: unclosed tags START'. Cannot progress past main menu.",
      "fully_met": 2,
      "partially_met": 1,
      "not_met": 9,
      "coverage_ratio": 0.208
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": true,
      "created_architecture_docs": true,
      "created_reusable_skills": true,
      "emergence_score": 1
    },
    "planningQuality": null,
    "scores": {
      "requirement_coverage": 0.208,
      "workflow_quality": 0.6,
      "skill_reuse": 0.75,
      "implementation_quality": 0.1,
      "iteration_evidence": 0.14,
      "time_efficiency": 0.971,
      "human_review": 0.1,
      "composite": 0.303
    },
    "humanReview": {
      "score": 0.1,
      "notes": "Main menu renders and recognizes saved game state (improvement over bare v1). But game crashes with 'Styled text error: unclosed tags START' when entering gameplay. Cannot play. Score 0.10: better than blank screen, menu works, but game is broken.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T03:00:00.000Z"
    }
  },
  {
    "project": "escape-the-dungeon-emergent",
    "version": "v2",
    "workflow": "emergent",
    "requirementsVersion": "v3",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 15,
      "phases_completed": 2,
      "tasks_completed": 0
    },
    "tokenUsage": {
      "total_tokens": 1609,
      "tool_uses": 73,
      "note": "rate-limited — but maintained phase commits"
    },
    "gitAnalysis": {
      "total_commits": 2,
      "task_id_commits": 0,
      "batch_commits": 0,
      "phase_commits": 2,
      "per_task_discipline": 0,
      "phase_discipline": 1
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": false,
      "gate_notes": "G1 (game-loop) partial — playable but no floor progression. G2 (spell-crafting) MET — forge added and functional, has authored content. G3 (ui-quality) medium — better than GAD, worse than bare v3.",
      "fully_met": 6,
      "partially_met": 4,
      "not_met": 2,
      "coverage_ratio": 0.667
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": true,
      "created_architecture_docs": true,
      "created_reusable_skills": false,
      "emergence_score": 0.75
    },
    "planningQuality": null,
    "scores": {
      "requirement_coverage": 0.667,
      "workflow_quality": 0.75,
      "skill_reuse": 0.3,
      "implementation_quality": 0.6,
      "iteration_evidence": 0.5,
      "time_efficiency": 0.969,
      "human_review": 0.5,
      "composite": 0.478
    },
    "humanReview": {
      "score": 0.5,
      "notes": "Solid crafting system — forge functional with more authored content than other runs. Playable but no floor progression after boss. No way to train or test crafted spells. Maintained 2 phase commits even under rate limit pressure (the only condition that did). UI is medium quality — better than GAD v8, worse than bare v3. Score 0.50: most disciplined under pressure with functional crafting.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T06:00:00.000Z"
    }
  },
  {
    "project": "planning-migration",
    "version": "v1",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": null,
    "gadVersion": null,
    "evalType": "implementation",
    "contextMode": null,
    "timing": null,
    "tokenUsage": null,
    "gitAnalysis": null,
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": null,
    "scores": {
      "composite": 0.978
    },
    "humanReview": null
  },
  {
    "project": "portfolio-bare",
    "version": "v2",
    "workflow": "bare",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T01:33:56.211Z",
      "ended": null,
      "duration_minutes": null,
      "phases_completed": 0,
      "tasks_completed": 0
    },
    "tokenUsage": null,
    "gitAnalysis": null,
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 0,
      "tasks_planned": 0,
      "tasks_completed": 0,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 0
    },
    "scores": {
      "cli_efficiency": null,
      "skill_accuracy": null,
      "planning_quality": null,
      "time_efficiency": null,
      "composite": null
    },
    "humanReview": {
      "score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null
    }
  },
  {
    "project": "portfolio-bare",
    "version": "v3",
    "workflow": "bare",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T03:42:00.000Z",
      "ended": "2026-04-07T04:06:00.000Z",
      "duration_minutes": 24,
      "phases_completed": 5,
      "tasks_completed": 12
    },
    "tokenUsage": {
      "total_tokens": 90181,
      "tool_uses": 140
    },
    "gitAnalysis": {
      "total_commits": 13,
      "task_id_commits": 12,
      "batch_commits": 1,
      "source_files_created": 15,
      "state_updates": 12,
      "decisions_added": 0,
      "per_task_discipline": 1
    },
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 5,
      "tasks_planned": 12,
      "tasks_completed": 12,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 12,
      "state_stale_count": 0
    },
    "scores": {
      "planning_quality": 1,
      "skill_accuracy": 0.8,
      "time_efficiency": 0.95,
      "per_task_discipline": 1,
      "composite": 0.944
    },
    "humanReview": null
  },
  {
    "project": "portfolio-bare",
    "version": "v4",
    "workflow": "bare",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T07:00:00.000Z",
      "ended": "2026-04-07T07:12:00.000Z",
      "duration_minutes": 12,
      "phases_completed": 5,
      "tasks_completed": 12
    },
    "tokenUsage": {
      "total_tokens": 78550,
      "tool_uses": 119
    },
    "gitAnalysis": {
      "total_commits": 19,
      "task_id_commits": 12,
      "batch_commits": 0,
      "source_files_created": 15,
      "state_updates": 12,
      "decisions_added": 3,
      "per_task_discipline": 1,
      "verify_commits": 5,
      "conventions_created": true
    },
    "requirementCoverage": {
      "total_criteria": 4,
      "fully_met": 4,
      "partially_met": 0,
      "not_met": 0,
      "coverage_ratio": 1
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 5,
      "tasks_planned": 13,
      "tasks_completed": 13,
      "tasks_blocked": 0,
      "decisions_captured": 3,
      "state_updates": 12,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 1,
      "planning_quality": 1,
      "skill_accuracy": 1,
      "time_efficiency": 0.975,
      "per_task_discipline": 1,
      "composite": 0.996,
      "human_review": null,
      "auto_composite": 0.996
    },
    "humanReview": null
  },
  {
    "project": "project-migration",
    "version": "v1",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-04",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "phases_completed": 1,
      "tasks_completed": 8
    },
    "tokenUsage": null,
    "gitAnalysis": null,
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "tasks_completed": 8,
      "tasks_total": 8
    },
    "scores": {
      "planning_continuity": 0.9,
      "skill_coverage": 0.95,
      "context_efficiency": 0.85,
      "docs_sink_alignment": 0.8,
      "composite": 0.89
    },
    "humanReview": null
  },
  {
    "project": "reader-workspace",
    "version": "v1",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T02:36:00.000Z",
      "ended": "2026-04-07T02:49:30.000Z",
      "duration_minutes": 13,
      "phases_completed": 12,
      "tasks_completed": 24
    },
    "tokenUsage": {
      "total_tokens": 89372,
      "tool_uses": 105
    },
    "gitAnalysis": {
      "total_commits": 12,
      "task_id_commits": 12,
      "batch_commits": 0,
      "source_files_created": 34,
      "state_updates": 24,
      "decisions_added": 12,
      "per_task_discipline": 0.5
    },
    "requirementCoverage": {
      "total_criteria": 51,
      "fully_met": 47,
      "partially_met": 4,
      "not_met": 0,
      "coverage_ratio": 0.961,
      "partial_criteria": [
        "sc-03",
        "sc-10",
        "sc-34",
        "sc-40"
      ]
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 12,
      "tasks_planned": 24,
      "tasks_completed": 24,
      "tasks_blocked": 0,
      "decisions_captured": 12,
      "state_updates": 24,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 0.961,
      "architecture_alignment": 1,
      "planning_quality": 1,
      "skill_accuracy": 0.8,
      "time_efficiency": 0.973,
      "per_task_discipline": 0.5,
      "composite": 0.821
    },
    "humanReview": null
  },
  {
    "project": "reader-workspace",
    "version": "v2",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T03:42:00.000Z",
      "ended": "2026-04-07T04:22:00.000Z",
      "duration_minutes": 40,
      "phases_completed": 11,
      "tasks_completed": 40
    },
    "tokenUsage": {
      "total_tokens": 152849,
      "tool_uses": 261
    },
    "gitAnalysis": {
      "total_commits": 37,
      "task_id_commits": 37,
      "batch_commits": 0,
      "source_files_created": 37,
      "state_updates": 40,
      "decisions_added": 0,
      "per_task_discipline": 0.925
    },
    "requirementCoverage": {
      "total_criteria": 51,
      "fully_met": 51,
      "partially_met": 0,
      "not_met": 0,
      "coverage_ratio": 1
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 11,
      "tasks_planned": 40,
      "tasks_completed": 40,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 40,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 1,
      "planning_quality": 1,
      "skill_accuracy": 0.8,
      "time_efficiency": 0.917,
      "per_task_discipline": 0.925,
      "composite": 0.928
    },
    "humanReview": null
  },
  {
    "project": "reader-workspace",
    "version": "v3",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T07:00:00.000Z",
      "ended": "2026-04-07T07:30:00.000Z",
      "duration_minutes": 30,
      "phases_completed": 11,
      "tasks_completed": 35
    },
    "tokenUsage": {
      "total_tokens": 136862,
      "tool_uses": 212
    },
    "gitAnalysis": {
      "total_commits": 23,
      "task_id_commits": 11,
      "batch_commits": 11,
      "source_files_created": 40,
      "state_updates": 35,
      "decisions_added": 0,
      "per_task_discipline": 0.31,
      "verify_commits": 11,
      "conventions_created": true
    },
    "requirementCoverage": {
      "total_criteria": 51,
      "fully_met": 51,
      "partially_met": 0,
      "not_met": 0,
      "coverage_ratio": 1
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 11,
      "tasks_planned": 35,
      "tasks_completed": 35,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 35,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 1,
      "planning_quality": 1,
      "skill_accuracy": 1,
      "time_efficiency": 0.938,
      "per_task_discipline": 0.31,
      "composite": 0.83,
      "human_review": null,
      "auto_composite": 0.83
    },
    "humanReview": null
  }
];

export const EVAL_TEMPLATES: EvalTemplateAsset[] = [
  {
    "project": "escape-the-dungeon",
    "zipPath": "/downloads/eval-escape-the-dungeon-template.zip",
    "bytes": 15740
  },
  {
    "project": "escape-the-dungeon-bare",
    "zipPath": "/downloads/eval-escape-the-dungeon-bare-template.zip",
    "bytes": 17939
  },
  {
    "project": "escape-the-dungeon-emergent",
    "zipPath": "/downloads/eval-escape-the-dungeon-emergent-template.zip",
    "bytes": 23643
  },
  {
    "project": "etd-brownfield-bare",
    "zipPath": "/downloads/eval-etd-brownfield-bare-template.zip",
    "bytes": 1130
  },
  {
    "project": "etd-brownfield-emergent",
    "zipPath": "/downloads/eval-etd-brownfield-emergent-template.zip",
    "bytes": 1063
  },
  {
    "project": "etd-brownfield-gad",
    "zipPath": "/downloads/eval-etd-brownfield-gad-template.zip",
    "bytes": 1410
  },
  {
    "project": "reader-workspace",
    "zipPath": "/downloads/eval-reader-workspace-template.zip",
    "bytes": 15255
  }
];

export const PLANNING_ZIPS: PlanningZipAsset[] = [
  {
    "project": "escape-the-dungeon",
    "zipPath": "/downloads/planning/eval-escape-the-dungeon-planning.zip",
    "bytes": 15740,
    "files": 8
  },
  {
    "project": "escape-the-dungeon-bare",
    "zipPath": "/downloads/planning/eval-escape-the-dungeon-bare-planning.zip",
    "bytes": 17939,
    "files": 6
  },
  {
    "project": "escape-the-dungeon-emergent",
    "zipPath": "/downloads/planning/eval-escape-the-dungeon-emergent-planning.zip",
    "bytes": 23643,
    "files": 11
  },
  {
    "project": "etd-brownfield-bare",
    "zipPath": "/downloads/planning/eval-etd-brownfield-bare-planning.zip",
    "bytes": 1130,
    "files": 1
  },
  {
    "project": "etd-brownfield-emergent",
    "zipPath": "/downloads/planning/eval-etd-brownfield-emergent-planning.zip",
    "bytes": 1063,
    "files": 1
  },
  {
    "project": "etd-brownfield-gad",
    "zipPath": "/downloads/planning/eval-etd-brownfield-gad-planning.zip",
    "bytes": 1410,
    "files": 1
  },
  {
    "project": "reader-workspace",
    "zipPath": "/downloads/planning/eval-reader-workspace-planning.zip",
    "bytes": 15255,
    "files": 6
  }
];

export const GAD_PACK_TEMPLATE = {
  "zipPath": "/downloads/gad-pack-template.zip",
  "bytes": 91146
};

export const ROUND_SUMMARIES: RoundSummary[] = [
  {
    "round": "Round 1",
    "title": "Greenfield, single-condition, requirements v1",
    "body": "**Date:** 2026-04-06 to 2026-04-07\n**Requirements version:** v1 (12 systems-focused criteria, no gates)\n**Conditions:** GAD only (escape-the-dungeon v1-v5)\n**Results:**\n- v1-v4: Iterative development of the GAD eval harness itself. Not scored.\n- **v5:** Auto-composite 0.935, human review 0.0 (blank screen). Gap between\n  automated scoring and reality first exposed here.\n\n**Key finding:** Automated scoring without human review is dangerously misleading.\nrequirement_coverage was 1.0 but nothing rendered.\n\n**Led to:** Gate criteria design, human_review weight increase, build-must-render rule.\n\n---"
  },
  {
    "round": "Round 2",
    "title": "Greenfield, three-condition, requirements v2",
    "body": "**Date:** 2026-04-08\n**Requirements version:** v2 (added gate criteria, vertical-slice priority, UI-first)\n**Conditions:** GAD v6/v7, Bare v1/v2, Emergent v1\n\n**Results:**\n| Condition | Version | Tokens | Commits | Human |\n|-----------|---------|--------|---------|-------|\n| GAD | v6 | ~100k | 21 | 0.00 (blank screen) |\n| GAD | v7 | 93k | 21 | 0.30 (stuck after combat) |\n| Bare | v1 | 68k | 2 | 0.10 (main menu only) |\n| Bare | v2 | 88k | 6 | **0.50** (most playable) |\n| Emergent | v1 | 67k | 2 | 0.10 (styled text crash) |\n\n**Key findings:**\n1. Bare workflow beats GAD on human review even at equal requirements\n2. Inherited skills (emergent v1) didn't prevent new failure modes\n3. GAD has perfect process metrics (planning_quality 1.0) but broken game loops\n4. Commit discipline inversely tracked with output quality in this round\n\n**Led to:**\n- Requirements v3 with explicit game-loop gate, spell-crafting gate, UI quality gate\n- Human_review weight raised from 0.15 to 0.30 with low-score caps\n- Skills must capture failure modes and fixes, not just patterns\n\n---"
  },
  {
    "round": "Round 3",
    "title": "Greenfield, three-condition, requirements v3",
    "body": "**Date:** 2026-04-08\n**Requirements version:** v3 (game-loop gate, spell-crafting gate, UI quality gate)\n**Conditions:** GAD v8, Bare v3, Emergent v2\n**Note:** All three hit rate limits mid-run\n\n**Results:**\n| Condition | Tokens | Commits | Human | Composite | Notes |\n|-----------|--------|---------|-------|-----------|-------|\n| **Bare v3** | 1877 | 1 batch | **0.70** | 0.526 | **Best game overall** — best UI/UX, most enjoyable. ASCII for some menus. |\n| Emergent v2 | 1609 | 2 phases | 0.50 | 0.478 | Functional forge with authored content. Medium UI. Maintained discipline under pressure. |\n| GAD v8 | 1291 | 0 | 0.20 | 0.177 | Broken crafting, old ASCII design. Never committed anything (rate limit hit mid-task). |\n\n**Key findings — the Freedom Hypothesis:**\n- Bare (no framework) consistently outperforms GAD (full framework) on creative implementation\n- GAD has never exceeded 0.30 human review across 4 attempts (v5, v6, v7, v8)\n- Bare has improved monotonically: 0.10 → 0.50 → 0.70\n- **Process metrics ≠ output quality.** GAD's planning overhead consumes tokens that\n  could go to testing and fixing the game.\n- Under rate-limit pressure, emergent maintained phase commits (inherited skill)\n  while bare regressed to 1 batch commit\n\n**Status of hypothesis:** PRELIMINARY — single-run variance is high, needs more trials.\nBrownfield experiments may invalidate if GAD's overhead pays off on codebase extension.\n\n**Documented in:** `evals/FINDINGS-2026-04-08-round-3.md`\n**Decision:** gad-36 (Freedom hypothesis)\n\n**Led to:**\n- Eval preservation contract (gad-38)\n- game/.planning/ layout mandate (gad-39)\n- Brownfield eval mode (gad-40)\n- Greenfield/brownfield categorization\n- `gad eval preserve`, `gad eval verify`, `gad worktree` commands\n\n---"
  },
  {
    "round": "Round 4",
    "title": "TBD",
    "body": "**Pending user decisions:**\n- Updated game requirements (v4) for greenfield\n- Whether to run greenfield v4 first or brownfield round 1 first"
  }
];

export const FINDINGS_ROUND_3_RAW: string | null = "# Round 3 Findings — Freedom Hypothesis\r\n\r\n**Requirements version:** v3 (game-loop gate, spell-crafting gate, UI quality gate)\r\n**Date:** 2026-04-08\r\n**Conditions:** GAD v8, Bare v3, Emergent v2 — all hit rate limits but produced builds\r\n\r\n## Results — inverted from expectations\r\n\r\n| Condition | Framework constraint | Tokens | Commits | Human score | Notes |\r\n|-----------|---------------------|--------|---------|-------------|-------|\r\n| **Bare v3** | **None (most freedom)** | 1,877 | 1 batch | **0.70** | Best UI/UX by far, most enjoyable |\r\n| Emergent v2 | Medium (inherited skills) | 1,609 | 2 phases | 0.50 | Solid forge, more content, maintained discipline |\r\n| GAD v8 | Full framework | 1,291 | 0 | 0.20 | Broken crafting, ASCII UI, hard to read |\r\n\r\n**The result is monotonic and inverse to framework constraint.** More freedom = better output.\r\n\r\n## Running tally across all rounds\r\n\r\n| Run | Requirements | Human | Key observation |\r\n|-----|-------------|-------|----------------|\r\n| GAD v5 | v1 | 0.00 | Blank screen |\r\n| GAD v6 | v2 | 0.00 | Blank screen |\r\n| GAD v7 | v2 | 0.30 | Stuck after combat |\r\n| **GAD v8** | **v3** | **0.20** | Broken crafting |\r\n| Bare v1 | v2 | 0.10 | New Game broken |\r\n| Bare v2 | v2 | 0.50 | Playable, ASCII UI |\r\n| **Bare v3** | **v3** | **0.70** | **Best game overall** |\r\n| Emergent v1 | v2 | 0.10 | Styled text crash |\r\n| **Emergent v2** | **v3** | **0.50** | Functional forge, medium UI |\r\n\r\n**GAD has never exceeded 0.30 human review across 4 attempts.**\r\n**Bare has improved monotonically: 0.10 → 0.50 → 0.70.**\r\n**Emergent has improved: 0.10 → 0.50.**\r\n\r\n## Freedom hypothesis\r\n\r\n> For creative/game implementation tasks, agent performance correlates INVERSELY with\r\n> framework constraint. Less prescribed structure leads to better output.\r\n\r\n### Supporting evidence\r\n\r\n1. **Bare always beats GAD** on human review, across all 3 rounds with same requirements\r\n2. **GAD has more tokens, more tool uses, more commits** — but produces worse games\r\n3. **GAD v8 had 0 commits** because it was so busy following the framework it hit the rate limit\r\n   before completing a work unit worth committing\r\n4. **Bare v3 best UI/UX** despite no framework telling it how to build UI\r\n5. **Emergent sits in the middle** — some framework, some freedom, middle results\r\n\r\n### Counter-evidence / confounds\r\n\r\n1. Rate limits hit all three runs — GAD v8 may have been about to commit when cut off\r\n2. Single-run variance is high — we haven't established statistical significance\r\n3. GAD's strength is discipline/traceability, not creative output — we may be measuring the\r\n   wrong thing for game evals\r\n4. Bare v3's \"one giant commit\" means if it had broken, there'd be no checkpoint. GAD's\r\n   discipline is insurance against catastrophic failure, not a booster for success\r\n\r\n### Alternative interpretation: the framework hurts speed\r\n\r\nGAD's planning overhead (reading/writing .planning/ docs, per-task commits, state updates,\r\ndecision capture) consumes tokens that could have gone to implementation and testing. In\r\na time-limited or token-limited environment, this overhead compounds:\r\n\r\n| Metric | GAD | Bare | Ratio |\r\n|--------|-----|------|-------|\r\n| Rounds completed with playable game | 0/4 | 2/3 | Bare 5x better |\r\n| Rounds with blank screen | 2/4 | 0/3 | GAD worse |\r\n| Rounds with gate failure | 4/4 | 1/3 | GAD worse |\r\n\r\n**GAD is producing disciplined garbage.** The process is followed but the product fails.\r\n\r\n## What this means for GAD\r\n\r\n1. **GAD may not be the right framework for creative implementation tasks.** It was designed\r\n   for planning/tracking, not for game development. Game dev rewards iteration speed and\r\n   visual feedback, which GAD's planning overhead slows down.\r\n\r\n2. **The bare condition's success suggests \"AGENTS.md + requirements + freedom\" is sufficient**\r\n   for implementation. The planning doc maintenance may be dead weight.\r\n\r\n3. **GAD's value proposition needs to be re-examined.** If process compliance doesn't correlate\r\n   with output quality, what is GAD actually optimizing for?\r\n   - Traceability across sessions (context compaction recovery)\r\n   - Multi-agent coordination\r\n   - Long-horizon planning (months, not days)\r\n   - Regulatory/compliance work where process matters\r\n\r\n4. **The game eval may be the wrong benchmark for GAD.** A better benchmark would be:\r\n   - Resuming work after context compaction\r\n   - Multi-phase refactors where state matters\r\n   - Documentation that has to be kept in sync with code\r\n   - Bug triage and root-cause analysis\r\n\r\n## Open questions\r\n\r\n1. Would GAD win if we measured context-resumption rather than fresh implementation?\r\n2. Does GAD win when the agent is replaced mid-run (simulating handoff)?\r\n3. What happens if we give Bare the same token budget as GAD's planning overhead in the form of free research time?\r\n4. Is the freedom hypothesis specific to KAPLAY/games, or does it generalize to web apps, APIs, CLIs?\r\n5. Would GAD do better with a \"lite mode\" that strips planning doc maintenance but keeps verification?\r\n\r\n## Immediate actions\r\n\r\n1. Treat this as a preliminary finding — needs more runs for statistical validity\r\n2. Create a GAD-lite mode for comparison (no per-task planning doc updates, only phase-level)\r\n3. Add a context-resumption eval where GAD's advantages should appear\r\n4. Do NOT abandon GAD — this finding may be specific to greenfield game implementation\r\n\r\n## Infrastructure findings\r\n\r\n- **Rate limits revealed discipline pressure response:** Emergent v2 was the only condition\r\n  that maintained phase commits under pressure. Bare regressed to 1 batch commit. GAD never\r\n  committed anything. Emergent's inherited skill \"game-loop-verification\" (which mandated\r\n  verify-per-phase) may have enforced a checkpoint discipline that kicked in before the limit.\r\n\r\n- **Build preservation was broken:** All previous runs overwrote the same path in\r\n  apps/portfolio/public/evals/. Now fixed — all 8 builds preserved per-version.\r\n";
export const FINDINGS_GENERAL_RAW: string | null = "# Eval Findings — 2026-04-08\n\n## Experiment: Escape the Dungeon — Three Conditions\n\n### Setup\n\nSame game requirements (12 criteria, vertical-slice priority, UI-first mandate), same source\ndocs (trimmed gameplay design ~120 lines), same stack (Vite + TypeScript + KAPLAY).\n\n| Condition | Framework | Skills | Runs |\n|-----------|-----------|--------|------|\n| GAD (escape-the-dungeon) | Full GAD: .planning/ XML, AGENTS.md loop, skill triggers | Pre-built | v5 (0.0), v6 (0.0), v7 (0.30) |\n| Bare (escape-the-dungeon-bare) | None — agent creates own workflow | From scratch | v1 (0.10), v2 (0.50) |\n| Emergent (escape-the-dungeon-emergent) | None — inherits skills from bare v1 | Inherited + evolves | v1 (0.10) |\n\n### Results: Human review scores\n\n| Run | Human | Notes |\n|-----|-------|-------|\n| GAD v5 | 0.00 | Blank screen |\n| GAD v6 | 0.00 | Blank screen (ES module + file://) |\n| GAD v7 | **0.30** | Renders, better UI layout, but game loop breaks after combat — player gets stuck |\n| Bare v1 | 0.10 | Main menu renders, New Game doesn't work |\n| Bare v2 | **0.50** | **Most playable.** Full game loop works. ASCII/plain UI, needs polish, no rune forge |\n| Emergent v1 | 0.10 | Main menu + saved game detection, but crashes entering game (styled text error) |\n\n### Key finding: Bare v2 beat GAD v7 on playability\n\nThe agent WITHOUT a framework produced the most playable game. This is a significant finding.\n\n**Why bare v2 won:**\n- Simpler architecture — fewer abstractions meant fewer places for bugs\n- Focused on making things work rather than following a process\n- 6 commits (phase-level granularity) — enough traceability without overhead\n- The feedback from v1's failure was more actionable than GAD's structural requirements\n\n**Why GAD v7 lost on playability despite better process metrics:**\n- 21 commits, 17/17 tasks tracked, full planning docs — excellent discipline\n- But the game loop broke (combat → no return to navigation)\n- More framework overhead (93K tokens vs 88K) didn't translate to better output\n- Planning docs were maintained perfectly while the actual game was broken\n- **The process was followed but the product was worse**\n\n### Token comparison\n\n| Run | Tokens | Tool uses | Commits | Human |\n|-----|--------|-----------|---------|-------|\n| Bare v1 | 67,751 | 62 | 2 | 0.10 |\n| Emergent v1 | 67,375 | 79 | 2 | 0.10 |\n| Bare v2 | 87,661 | 110 | 6 | **0.50** |\n| GAD v7 | 93,632 | 137 | 21 | 0.30 |\n\nGAD used 7% more tokens than bare v2 but scored 40% lower on human review. The token overhead\nof maintaining .planning/ docs did not pay for itself in output quality.\n\n### Emergent v1 findings\n\nThe emergent eval (inherited skills from bare v1) performed WORSE than both bare v2 and GAD v7.\nThis challenges the hypothesis that inherited skills improve outcomes.\n\n**Why emergent v1 failed:**\n- Inherited skills were code-level patterns, not workflow fixes\n- The `previous-workflow.md` told it v1's New Game was broken, but the fix didn't work\n- \"Styled text error: unclosed tags START\" — a KAPLAY API issue the skills didn't cover\n- Fewer tokens (67K) suggests it relied on inherited knowledge but that knowledge was insufficient\n\n**Lesson:** Skills need to capture failure modes and fixes, not just patterns. The bare v2 agent\nsucceeded because it was told \"v1's New Game was broken\" and had to figure out the fix itself.\nThe emergent agent was told the same thing AND given skills, but the skills didn't help with\nthe specific KAPLAY API issue that caused the crash.\n\n### What this means for GAD\n\n1. **Process metrics ≠ output quality.** GAD v7 had near-perfect discipline (0.81) and planning\n   quality (1.0) but produced a worse game than the undisciplined bare v2.\n\n2. **The framework adds overhead that doesn't always pay off.** 93K tokens for GAD vs 88K for\n   bare, with worse results. The planning doc maintenance consumed tokens that could have gone\n   to testing and fixing the game.\n\n3. **Feedback about failures is more valuable than inherited skills.** Bare v2 (told about v1's\n   failure) outperformed emergent v1 (given v1's skills + failure notes). Direct feedback\n   about what broke was more actionable than documented patterns.\n\n4. **Human review is the only metric that matters for game evals.** Auto-composite can be\n   0.95+ while the game is a blank screen. The gate criteria help but aren't sufficient —\n   a game can render and still be broken.\n\n### Requirements versioning\n\nRequirements have been updated twice this session:\n- **v1 (original):** 12 criteria focused on systems completeness\n- **v2 (current):** Gate criteria (must render, must be playable), vertical-slice priority,\n  UI-first build order. Trimmed source docs from 640 → 127 lines.\n\nNext iteration should add:\n- Explicit game-loop verification: title → new game → room → interaction → room (full cycle)\n- UI quality baseline: minimum spacing, readable text, no overlapping elements\n- Rune forge as a required criterion (currently missing from all implementations)\n\n### Open questions\n\n1. Would GAD do better if the AGENTS.md mandated explicit game-loop testing per phase?\n2. Would the emergent eval improve if skills captured KAPLAY-specific error fixes?\n3. Is the bare approach inherently better for creative/game implementation, or was this specific to KAPLAY?\n4. Would multiple bare v2 runs cluster around 0.50, or was this a lucky outlier?\n";

export const PLAYABLE_INDEX: Record<string, string> = {
  "escape-the-dungeon/v6": "/playable/escape-the-dungeon/v6/index.html",
  "escape-the-dungeon/v7": "/playable/escape-the-dungeon/v7/index.html",
  "escape-the-dungeon/v8": "/playable/escape-the-dungeon/v8/index.html",
  "escape-the-dungeon-bare/v1": "/playable/escape-the-dungeon-bare/v1/index.html",
  "escape-the-dungeon-bare/v2": "/playable/escape-the-dungeon-bare/v2/index.html",
  "escape-the-dungeon-bare/v3": "/playable/escape-the-dungeon-bare/v3/index.html",
  "escape-the-dungeon-emergent/v1": "/playable/escape-the-dungeon-emergent/v1/index.html",
  "escape-the-dungeon-emergent/v2": "/playable/escape-the-dungeon-emergent/v2/index.html"
};

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
