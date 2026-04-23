"use strict";
/**
 * Public entry point for eval data. All runtime data comes from
 * eval-data.generated.ts (written by scripts/build-site-data.mjs during
 * prebuild). This file only re-exports and adds a few display helpers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_LABELS = exports.MARKETPLACE_INDEX = exports.BROOD_SKILL_AGGREGATION = exports.TASK_PRESSURE = exports.SEARCH_INDEX = exports.ALL_PHASES = exports.ALL_TASKS = exports.ALL_DECISIONS = exports.GLOSSARY_UPDATED = exports.GLOSSARY = exports.BUGS_UPDATED = exports.BUGS = exports.OPEN_QUESTIONS_UPDATED = exports.OPEN_QUESTIONS = exports.WORKFLOW_DESCRIPTIONS = exports.WORKFLOW_LABELS = exports.PLAYABLE_INDEX = exports.GAD_PACK_TEMPLATE = exports.PRODUCED_ARTIFACTS = exports.EVAL_PROJECTS = exports.ROUND_SUMMARIES = exports.PLANNING_ZIPS = exports.EVAL_TEMPLATES = exports.EVAL_RUNS = void 0;
exports.runKey = runKey;
exports.playableUrl = playableUrl;
exports.runsByProject = runsByProject;
exports.runsByWorkflow = runsByWorkflow;
exports.latestPlayableRuns = latestPlayableRuns;
exports.findRun = findRun;
exports.humanReviewNotes = humanReviewNotes;
exports.isRateLimited = isRateLimited;
exports.isApiInterrupted = isApiInterrupted;
exports.isInterrupted = isInterrupted;
exports.comparableRuns = comparableRuns;
var eval_data_generated_1 = require("./eval-data.generated");
Object.defineProperty(exports, "EVAL_RUNS", { enumerable: true, get: function () { return eval_data_generated_1.EVAL_RUNS; } });
Object.defineProperty(exports, "EVAL_TEMPLATES", { enumerable: true, get: function () { return eval_data_generated_1.EVAL_TEMPLATES; } });
Object.defineProperty(exports, "PLANNING_ZIPS", { enumerable: true, get: function () { return eval_data_generated_1.PLANNING_ZIPS; } });
Object.defineProperty(exports, "ROUND_SUMMARIES", { enumerable: true, get: function () { return eval_data_generated_1.ROUND_SUMMARIES; } });
Object.defineProperty(exports, "EVAL_PROJECTS", { enumerable: true, get: function () { return eval_data_generated_1.EVAL_PROJECTS; } });
Object.defineProperty(exports, "PRODUCED_ARTIFACTS", { enumerable: true, get: function () { return eval_data_generated_1.PRODUCED_ARTIFACTS; } });
Object.defineProperty(exports, "GAD_PACK_TEMPLATE", { enumerable: true, get: function () { return eval_data_generated_1.GAD_PACK_TEMPLATE; } });
Object.defineProperty(exports, "PLAYABLE_INDEX", { enumerable: true, get: function () { return eval_data_generated_1.PLAYABLE_INDEX; } });
Object.defineProperty(exports, "WORKFLOW_LABELS", { enumerable: true, get: function () { return eval_data_generated_1.WORKFLOW_LABELS; } });
Object.defineProperty(exports, "WORKFLOW_DESCRIPTIONS", { enumerable: true, get: function () { return eval_data_generated_1.WORKFLOW_DESCRIPTIONS; } });
Object.defineProperty(exports, "OPEN_QUESTIONS", { enumerable: true, get: function () { return eval_data_generated_1.OPEN_QUESTIONS; } });
Object.defineProperty(exports, "OPEN_QUESTIONS_UPDATED", { enumerable: true, get: function () { return eval_data_generated_1.OPEN_QUESTIONS_UPDATED; } });
Object.defineProperty(exports, "BUGS", { enumerable: true, get: function () { return eval_data_generated_1.BUGS; } });
Object.defineProperty(exports, "BUGS_UPDATED", { enumerable: true, get: function () { return eval_data_generated_1.BUGS_UPDATED; } });
Object.defineProperty(exports, "GLOSSARY", { enumerable: true, get: function () { return eval_data_generated_1.GLOSSARY; } });
Object.defineProperty(exports, "GLOSSARY_UPDATED", { enumerable: true, get: function () { return eval_data_generated_1.GLOSSARY_UPDATED; } });
Object.defineProperty(exports, "ALL_DECISIONS", { enumerable: true, get: function () { return eval_data_generated_1.ALL_DECISIONS; } });
Object.defineProperty(exports, "ALL_TASKS", { enumerable: true, get: function () { return eval_data_generated_1.ALL_TASKS; } });
Object.defineProperty(exports, "ALL_PHASES", { enumerable: true, get: function () { return eval_data_generated_1.ALL_PHASES; } });
Object.defineProperty(exports, "SEARCH_INDEX", { enumerable: true, get: function () { return eval_data_generated_1.SEARCH_INDEX; } });
Object.defineProperty(exports, "TASK_PRESSURE", { enumerable: true, get: function () { return eval_data_generated_1.TASK_PRESSURE; } });
Object.defineProperty(exports, "BROOD_SKILL_AGGREGATION", { enumerable: true, get: function () { return eval_data_generated_1.BROOD_SKILL_AGGREGATION; } });
Object.defineProperty(exports, "MARKETPLACE_INDEX", { enumerable: true, get: function () { return eval_data_generated_1.MARKETPLACE_INDEX; } });
const eval_data_generated_2 = require("./eval-data.generated");
exports.PROJECT_LABELS = {
    "escape-the-dungeon": "Escape the Dungeon · GAD",
    "escape-the-dungeon-bare": "Escape the Dungeon · Bare",
    "escape-the-dungeon-emergent": "Escape the Dungeon · Emergent",
    "etd-brownfield-gad": "ETD Brownfield · GAD",
    "etd-brownfield-bare": "ETD Brownfield · Bare",
    "etd-brownfield-emergent": "ETD Brownfield · Emergent",
    "reader-workspace": "Reader Workspace",
};
function runKey(r) {
    return `${r.project}/${r.version}`;
}
/** Resolves `/playable/...` URL; phase-43 species rows use `project/species/version` keys in PLAYABLE_INDEX. */
function playableUrl(r) {
    if (r.id && eval_data_generated_2.PLAYABLE_INDEX[r.id])
        return eval_data_generated_2.PLAYABLE_INDEX[r.id];
    const speciesKey = r.species ? `${r.project}/${r.species}/${r.version}` : null;
    if (speciesKey && eval_data_generated_2.PLAYABLE_INDEX[speciesKey])
        return eval_data_generated_2.PLAYABLE_INDEX[speciesKey];
    return eval_data_generated_2.PLAYABLE_INDEX[runKey(r)] ?? null;
}
function runsByProject() {
    const groups = new Map();
    for (const r of eval_data_generated_2.EVAL_RUNS) {
        const arr = groups.get(r.project) ?? [];
        arr.push(r);
        groups.set(r.project, arr);
    }
    // Sort each project's runs by version number ascending.
    for (const arr of groups.values()) {
        arr.sort((a, b) => {
            const av = parseInt(a.version.slice(1), 10) || 0;
            const bv = parseInt(b.version.slice(1), 10) || 0;
            return av - bv;
        });
    }
    return [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([project, runs]) => ({ project, runs }));
}
function runsByWorkflow() {
    const by = { gad: [], bare: [], emergent: [] };
    for (const r of eval_data_generated_2.EVAL_RUNS) {
        if (r.workflow in by)
            by[r.workflow].push(r);
    }
    return by;
}
function latestPlayableRuns() {
    // One representative (latest version) per project that has a playable build.
    const latest = new Map();
    for (const r of eval_data_generated_2.EVAL_RUNS) {
        if (!playableUrl(r))
            continue;
        const existing = latest.get(r.project);
        if (!existing) {
            latest.set(r.project, r);
        }
        else {
            const existingV = parseInt(existing.version.slice(1), 10) || 0;
            const thisV = parseInt(r.version.slice(1), 10) || 0;
            if (thisV > existingV)
                latest.set(r.project, r);
        }
    }
    return [...latest.values()].sort((a, b) => a.project.localeCompare(b.project));
}
function findRun(project, version) {
    return eval_data_generated_2.EVAL_RUNS.find((r) => r.project === project && r.version === version);
}
function humanReviewNotes(r) {
    return r.humanReview?.notes ?? null;
}
/**
 * True when the run hit a rate limit before completing. Rate-limited runs
 * are preserved as data points but excluded from cross-round comparisons
 * per decision gad-63.
 */
function isRateLimited(r) {
    if (!r.timing)
        return false;
    const flag = r.timing.rate_limited;
    return flag === true;
}
/**
 * True when the run was interrupted by an Anthropic API error (e.g. HTTP 529
 * overloaded_error). Different cause than rate limit — infrastructure issue
 * rather than account cap — but same exclusion policy per decision gad-64.
 */
function isApiInterrupted(r) {
    if (!r.timing)
        return false;
    const flag = r.timing.api_interrupted;
    return flag === true;
}
/**
 * True when the run was interrupted for ANY reason (rate limit OR API error).
 * Use this as the default filter for comparison surfaces.
 */
function isInterrupted(r) {
    return isRateLimited(r) || isApiInterrupted(r);
}
/**
 * Returns only runs suitable for cross-round comparison — completed runs
 * with a scored composite, no interruption flags.
 */
function comparableRuns(runs = eval_data_generated_2.EVAL_RUNS) {
    return runs.filter((r) => !isInterrupted(r) && r.scores.composite != null);
}
