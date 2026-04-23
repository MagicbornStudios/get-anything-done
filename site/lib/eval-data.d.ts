/**
 * Public entry point for eval data. All runtime data comes from
 * eval-data.generated.ts (written by scripts/build-site-data.mjs during
 * prebuild). This file only re-exports and adds a few display helpers.
 */
export { EVAL_RUNS, EVAL_TEMPLATES, PLANNING_ZIPS, ROUND_SUMMARIES, EVAL_PROJECTS, PRODUCED_ARTIFACTS, GAD_PACK_TEMPLATE, PLAYABLE_INDEX, WORKFLOW_LABELS, WORKFLOW_DESCRIPTIONS, OPEN_QUESTIONS, OPEN_QUESTIONS_UPDATED, BUGS, BUGS_UPDATED, GLOSSARY, GLOSSARY_UPDATED, ALL_DECISIONS, ALL_TASKS, ALL_PHASES, SEARCH_INDEX, TASK_PRESSURE, BROOD_SKILL_AGGREGATION, MARKETPLACE_INDEX, type MarketplaceIndex, type MarketplaceGeneration, type MarketplaceSpecies, type MarketplaceProject, type EvalRunRecord, type EvalScores, type EvalTemplateAsset, type PlanningZipAsset, type RoundSummary, type EvalProjectMeta, type ProducedArtifacts, type Workflow, type OpenQuestion, type BugRecord, type GlossaryTerm, type DecisionRecord, type TaskRecord, type PhaseRecord, type SearchEntry, type TaskPressureRecord, } from "./eval-data.generated";
import { type EvalRunRecord, type Workflow } from "./eval-data.generated";
export declare const PROJECT_LABELS: Record<string, string>;
export declare function runKey(r: {
    project: string;
    version: string;
}): string;
/** Resolves `/playable/...` URL; phase-43 species rows use `project/species/version` keys in PLAYABLE_INDEX. */
export declare function playableUrl(r: {
    project: string;
    version: string;
    species?: string | null;
    id?: string;
}): string | null;
export declare function runsByProject(): Array<{
    project: string;
    runs: EvalRunRecord[];
}>;
export declare function runsByWorkflow(): Record<Workflow, EvalRunRecord[]>;
export declare function latestPlayableRuns(): EvalRunRecord[];
export declare function findRun(project: string, version: string): EvalRunRecord | undefined;
export declare function humanReviewNotes(r: EvalRunRecord): string | null;
/**
 * True when the run hit a rate limit before completing. Rate-limited runs
 * are preserved as data points but excluded from cross-round comparisons
 * per decision gad-63.
 */
export declare function isRateLimited(r: EvalRunRecord): boolean;
/**
 * True when the run was interrupted by an Anthropic API error (e.g. HTTP 529
 * overloaded_error). Different cause than rate limit — infrastructure issue
 * rather than account cap — but same exclusion policy per decision gad-64.
 */
export declare function isApiInterrupted(r: EvalRunRecord): boolean;
/**
 * True when the run was interrupted for ANY reason (rate limit OR API error).
 * Use this as the default filter for comparison surfaces.
 */
export declare function isInterrupted(r: EvalRunRecord): boolean;
/**
 * Returns only runs suitable for cross-round comparison — completed runs
 * with a scored composite, no interruption flags.
 */
export declare function comparableRuns(runs?: EvalRunRecord[]): EvalRunRecord[];
//# sourceMappingURL=eval-data.d.ts.map