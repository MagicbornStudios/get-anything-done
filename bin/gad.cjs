#!/usr/bin/env node
'use strict';
/**
 * gad — planning CLI for get-anything-done
 *
 * Built on citty + gad-config.cjs.
 * Self-contained CJS — does not depend on mb-cli-framework at runtime.
 *
 * Usage:
 *   gad --help
 *   gad projects list
 *   gad projects sync
 *   gad projects list
 *   gad state
 *   gad phases [--projectid <id>]
 *   gad tasks [--projectid <id>]
 *   gad docs compile [--sink <path>]
 *   gad docs serve [--projectid <id>] [--docs-path <path>]
 *   gad species list
 *   gad species run --project <name>
 *   gad session list
 *   gad session new [--project <id>]
 *   gad session resume <id>
 *   gad session close <id>
 *   gad context [--session <id>] [--project <id>]
 *   gad refs [--projectid …] | gad refs list|verify|migrate|watch
 */

const { defineCommand, runMain, createMain } = require('citty');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const gadConfig = require('./gad-config.cjs');
const { resolveTomlPath } = require('./gad-config.cjs');
const { render, shouldUseJson } = require('../lib/table.cjs');
const { readState } = require('../lib/state-reader.cjs');
const { readTasks } = require('../lib/task-registry-reader.cjs');
const { readPhases, readDocFlow } = require('../lib/roadmap-reader.cjs');
const { writePhase } = require('../lib/roadmap-writer.cjs');
const { readDecisions } = require('../lib/decisions-reader.cjs');
const { writeDecision } = require('../lib/decisions-writer.cjs');
const { writeTodo, listTodos } = require('../lib/todos-writer.cjs');
const { writeNote, listNotes, listNoteQuestions } = require('../lib/notes-writer.cjs');
const {
  compactStateXml,
  compactRoadmapSection,
  compactTasksSection,
} = require('../lib/snapshot-compact.cjs');
const teachings = require('../lib/teachings-reader.cjs');

// Decision gad-259 (2026-04-17): DAILY snapshot section removed.
// After gad-258 moved llm-from-scratch execution into a daily subagent,
// the main-session snapshot no longer needs to surface the tip or the
// learning-project next-action. The subagent consumes them directly and
// returns a brief operator-facing report. `gad tip` remains on demand.
const { readRequirements } = require('../lib/requirements-reader.cjs');
const { readErrors } = require('../lib/errors-reader.cjs');
const { readBlockers } = require('../lib/blockers-reader.cjs');
const { readDocsMap } = require('../lib/docs-map-reader.cjs');
const {
  loadProject: loadEvalProject,
  loadAllResolvedSpecies,
  loadResolvedSpecies,
} = require('../lib/eval-loader.cjs');
const { compile: compileDocs } = require('../lib/docs-compiler.cjs');
const planningRefVerify = require('../lib/planning-ref-verify.cjs');
const { summarizeAgentLineage } = require('../lib/eval-agent-lineage.cjs');
const { parseTraceEventsJsonl } = require('../lib/trace-schema.cjs');
const {
  addTaskClaim,
  claimTask,
  ensureAgentLane,
  listAgentLanes,
  nowIso,
  releaseTask,
  removeTaskClaim,
  touchAgentLane,
} = require('../lib/agent-lanes.cjs');
const { detectRuntimeIdentity, detectRuntimeSessionId } = require('../lib/runtime-detect.cjs');
const { getLastActiveProjectid, setLastActiveProjectid } = require('../lib/user-settings.cjs');
const {
  lintAllSkills,
  lintSkill,
  summarizeLint,
  parseFrontmatter: parseSkillFrontmatter,
  auditSkillTokens,
  extractBodyRefs,
} = require('../lib/skill-linter.cjs');
const {
  collectAttributions,
  buildUsageReport,
  discoverSkillIds,
  SENTINEL_SKILL_VALUES,
} = require('../lib/skill-usage-stats.cjs');

// Sweep E (2026-04-19): graph-extractor used by both state.show (factory dep,
// resolved at module-load time) and the inline graph commands defined later
// in this file. Hoisted to top imports so factory invocations don't see it
// as undefined. Original location preserved as a comment marker for grep.
const graphExtractor = require('../lib/graph-extractor.cjs');

// Command modules self-register via bin/commands/_loader.cjs. Adding a new
// command should be a one-file change: create bin/commands/<name>.cjs with
// register/provides/postWire hooks and let the loader discover it.

const pkg = require('../package.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve repo root from cwd (looks for gad-config.toml / legacy planning-config.toml / compat JSON up the tree). */
function readXmlFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function findRepoRoot(start) {
  let dir = start || process.cwd();
  for (let i = 0; i < 10; i++) {
    if (
      resolveTomlPath(dir) ||
      fs.existsSync(path.join(dir, '.planning', 'config.json')) ||
      fs.existsSync(path.join(dir, 'config.json'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

// ---------------------------------------------------------------------------
// Load .env if present (for API keys like ANTHROPIC_API_KEY)
// ---------------------------------------------------------------------------
try {
  const envPath = path.join(findRepoRoot() || process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  }
} catch {}

// ---------------------------------------------------------------------------
// Multi-root eval discovery (task 42.4-12, decision GAD-D-184)
// ---------------------------------------------------------------------------
//
// Eval projects can live in more than one directory. The default root stays
// `vendor/get-anything-done/evals/` (the submodule's own evals/) for
// backwards compatibility. Additional roots are declared in gad-config.toml:
//
//   [[evals.roots]]
//   id = "app-forge"
//   path = "apps/forge/evals"
//
// Paths are resolved relative to the repo root (or taken as-is if absolute).
// The default root is always appended last unless a configured root already
// points at the same absolute path. Project ids must be unique across all
// roots — `listAllEvalProjects()` throws if a duplicate is detected.

// Eval roots helpers → lib/eval-helpers.cjs (factory; needs findRepoRoot+gadConfig)
const { createEvalRootsHelpers } = require('../lib/eval-helpers.cjs');
const {
  getEvalRoots, defaultEvalsDir, listAllEvalProjects,
  resolveEvalProject, resolveOrDefaultEvalProjectDir,
  listEvalProjectsHint: __listEvalProjectsHintFromLib,
} = createEvalRootsHelpers({
  repoRoot: path.join(__dirname, '..'),
  findRepoRoot: () => findRepoRoot(),
  gadConfig,
});

// CLI helpers (project namespacing, agent telemetry, runtime resolution,
// assignments view, eval runtime hook installer) → lib/cli-helpers.cjs
const __cliHelpers = require('../lib/cli-helpers.cjs');
const {
  PROJECT_NAMESPACE_MAP, projectNamespace, formatId,
  detectAgentTelemetry,
  resolveSnapshotRuntime, resolveSnapshotAgentInputs,
  simplifyAgentLane, buildAssignmentsView,
} = __cliHelpers;

function output(rows, opts = {}) {
  const fmt = shouldUseJson() ? 'json' : (opts.format || 'table');
  console.log(render(rows, { ...opts, format: fmt }));
}

function outputError(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

// Side-effects + raw-argv flag helpers + call logger → lib/side-effects.cjs
const RAW_ARGV = process.argv.slice();
const __sideEffects = require('../lib/side-effects.cjs');
const {
  NO_SIDE_EFFECTS_FLAG, NO_SIDE_EFFECTS_MARKER, envFlagEnabled,
} = __sideEffects;
function readRawFlagValue(flagName, argv = RAW_ARGV) {
  return __sideEffects.readRawFlagValue(flagName, argv);
}
function hasRawFlag(flagName, argv = RAW_ARGV) {
  return __sideEffects.hasRawFlag(flagName, argv);
}
const {
  resolveSideEffectsMode, sideEffectsSuppressed, getLogDir, logCall,
} = __sideEffects.createSideEffectsHelpers({
  RAW_ARGV, findRepoRoot, detectRuntimeIdentity, detectAgentTelemetry,
});
const _isGadCli = process.argv[1] && path.basename(process.argv[1]) === 'gad.cjs';
process.on('exit', (code) => { if (_isGadCli) logCall({ exit: code }); });

const listEvalProjectsHint = __listEvalProjectsHintFromLib;

// graph helpers → lib/graph-helpers.cjs (must be hoisted above command
// factories that depend on maybeRebuildGraph / ensureGraphFresh).
const __graphHelpers = require('../lib/graph-helpers.cjs');
const { maybeRebuildGraph, ensureGraphFresh } = __graphHelpers.createGraphHelpers({
  gadDir: path.resolve(__dirname, '..'),
});

// proto-skill / skill helper bindings (pure pass-throughs).
// Hoisted above startup factory which consumes writeEvolutionScan.
const {
  protoSkillRelativePath, expandHomeDir,
  normalizeProtoSkillRuntime, getProtoSkillRuntimeDirName,
  getProtoSkillGlobalDir, installProtoSkillToRuntime,
} = require('../lib/proto-skill-helpers.cjs');
const {
  splitCsvList, listSkillDirs, readSkillFrontmatter,
  normalizeSkillLaneValues, skillMatchesLane,
  severityRank, filterIssuesBySeverity, resolveSkillWorkflowPath,
  buildSkillUsageIndex, readSkillSource, skillReferencesId,
  findReferencedSkillIds, listCandidateDirs, evolutionScanFilePath,
  readEvolutionScan,
} = require('../lib/skill-helpers.cjs');

// evolution-config bundles wrappers (evolutionPaths, resolveSkillRoots,
// build/writeEvolutionScan, validateSkillLaneFilter, resolveProtoSkillInstallRuntimes,
// buildEvolutionSection). → lib/evolution-config.cjs
const {
  evolutionPaths, resolveSkillRoots,
  buildEvolutionScan, writeEvolutionScan,
  validateSkillLaneFilter, resolveProtoSkillInstallRuntimes,
  buildEvolutionSection,
} = require('../lib/evolution-config.cjs').createEvolutionConfig({
  outputError, sideEffectsSuppressed, detectRuntimeIdentity, readEvolutionScan,
});

// scope helpers (resolveRoots / getActiveSessionProjectId / listActiveSessionsHint)
// → lib/scope-helpers.cjs. loadSessions is bound late (session.cjs is required
// further down the file), so we inject a thunk.
let __loadSessionsRef = null;
const {
  resolveRoots, getActiveSessionProjectId, listActiveSessionsHint,
} = require('../lib/scope-helpers.cjs').createScopeHelpers({
  getLoadSessions: () => __loadSessionsRef,
});


const evalDataAccess = (() => {
  let _mod;
  return () => (_mod ||= require('../lib/eval-data-access.cjs'));
})();

const { listHandoffs, countHandoffs, createHandoff } = require('../lib/handoffs.cjs');

// section helpers used by snapshot/sprint/startup → lib/section-helpers.cjs
const __sectionHelpers = require('../lib/section-helpers.cjs');
const { resolveDetectedRuntimeId, printSection } = __sectionHelpers;
function buildHandoffsSection(opts = {}) {
  return __sectionHelpers.buildHandoffsSection(opts, { render });
}

const { getRuntimeArg } = require('./commands/runtime.cjs');

// Install / sink helpers → lib/install-helpers.cjs
const __installHelpers = require('../lib/install-helpers.cjs');
const {
  isPackagedExecutableRuntime, getPackagedExecutablePath,
  getDefaultSelfInstallDir, stampSinkCompileNote,
} = __installHelpers;
function maybeGenerateDailyTip() {
  return __installHelpers.maybeGenerateDailyTip({
    teachings, scriptDir: path.join(__dirname, '..', 'scripts'),
  });
}

// Shared dependency bag. Most factories take only `common` and destructure
// what they need — extras are ignored. Add cross-cutting helpers here.
const repoRoot = path.resolve(__dirname, '..');
const common = {
  findRepoRoot, gadConfig, resolveRoots, resolveTomlPath, repoRoot, pkg,
  outputError, output, render, shouldUseJson,
  readState, readPhases, readTasks, readDecisions, readRequirements,
  readErrors, readBlockers, readDocFlow, readDocsMap, readXmlFile,
  writePhase, writeDecision, writeTodo, listTodos,
  writeNote, listNotes, listNoteQuestions,
  detectRuntimeIdentity, detectRuntimeSessionId,
  graphExtractor, maybeRebuildGraph, formatId, evalDataAccess,
  planningRefVerify, compileDocs, getLogDir,
  listHandoffs, countHandoffs, createHandoff,
  resolveDetectedRuntimeId, printSection, buildHandoffsSection,
  // eval surface
  listAllEvalProjects, listEvalProjectsHint, resolveOrDefaultEvalProjectDir,
  resolveEvalProject, defaultEvalsDir, loadEvalProject, loadAllResolvedSpecies,
  parseTraceEventsJsonl, summarizeAgentLineage,
};

// Per-command extras. Each block holds the helpers a single command needs
// beyond `common`. Two agents touching different blocks → no conflict.
const extras = {
  setLoadSessions: (fn) => { __loadSessionsRef = fn; },
  session: {
    sideEffectsSuppressed,
    getLastActiveProjectid, setLastActiveProjectid,
  },
  tasks: {
    resolveSnapshotAgentInputs, resolveSnapshotRuntime, ensureAgentLane,
    claimTask, addTaskClaim, nowIso, releaseTask, removeTaskClaim,
    RAW_ARGV, getRuntimeArg, readRawFlagValue, SENTINEL_SKILL_VALUES,
    listAgentLanes, simplifyAgentLane,
  },
  snapshot: {
    sideEffectsSuppressed, ensureGraphFresh,
    resolveSnapshotAgentInputs, resolveSnapshotRuntime, ensureAgentLane,
    listAgentLanes, touchAgentLane,
    buildAssignmentsView, compactStateXml, compactRoadmapSection, compactTasksSection,
    buildEvolutionSection, listSkillDirs, readSkillFrontmatter,
  },
  startup: {
    sideEffectsSuppressed, resolveSideEffectsMode, NO_SIDE_EFFECTS_FLAG,
    getPackagedExecutablePath, isPackagedExecutableRuntime, getDefaultSelfInstallDir,
    ensureGraphFresh, writeEvolutionScan, maybeGenerateDailyTip,
    getLastActiveProjectid, setLastActiveProjectid,
  },
  evolutionImages: {
    splitCsvList, getProtoSkillGlobalDir, listSkillDirs, readSkillFrontmatter,
  },
  evolution: {
    evolutionPaths, resolveProtoSkillInstallRuntimes, installProtoSkillToRuntime,
    protoSkillRelativePath, writeEvolutionScan, readEvolutionScan,
  },
  skill: {
    evolutionPaths, resolveSkillRoots, listSkillDirs, readSkillFrontmatter,
    validateSkillLaneFilter, skillMatchesLane, resolveSkillWorkflowPath,
    normalizeSkillLaneValues, lintSkill, summarizeLint, lintAllSkills,
    filterIssuesBySeverity, auditSkillTokens, buildSkillUsageIndex,
  },
};

const { subCommands } = require('./commands/_loader.cjs').load({ common, extras });

const main = defineCommand({
  meta: {
    name: 'gad',
    description: 'Planning CLI for get-anything-done',
    version: pkg.version,
  },
  subCommands,
});

// argv injectors → lib/argv-injectors.cjs
const __argvInjectors = require('../lib/argv-injectors.cjs');
__argvInjectors.applyDefaultSubcommandInjectors();
__argvInjectors.extractActiveSkillFlag();

runMain(main);
