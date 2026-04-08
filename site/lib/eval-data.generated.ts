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

export const GAD_PACK_TEMPLATE = {
  "zipPath": "/downloads/gad-pack-template.zip",
  "bytes": 91146
};

export const PLAYABLE_INDEX: Record<string, string> = {
  "escape-the-dungeon/v6": "/playable/escape-the-dungeon/v6/",
  "escape-the-dungeon/v7": "/playable/escape-the-dungeon/v7/",
  "escape-the-dungeon/v8": "/playable/escape-the-dungeon/v8/",
  "escape-the-dungeon-bare/v1": "/playable/escape-the-dungeon-bare/v1/",
  "escape-the-dungeon-bare/v2": "/playable/escape-the-dungeon-bare/v2/",
  "escape-the-dungeon-bare/v3": "/playable/escape-the-dungeon-bare/v3/",
  "escape-the-dungeon-emergent/v1": "/playable/escape-the-dungeon-emergent/v1/",
  "escape-the-dungeon-emergent/v2": "/playable/escape-the-dungeon-emergent/v2/"
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
