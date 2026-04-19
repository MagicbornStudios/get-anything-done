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

// Sweep E (2026-04-19, opus-claude): extracted command families. Pattern is
// factory-receives-deps so we don't have to extract `resolveRoots` (and its
// transitive `getActiveSessionProjectId` / `loadSessions` chain) yet. Future
// sweeps move shared helpers into lib/cli-helpers.cjs and convert these to
// direct requires.
const { createStateCommand } = require('./commands/state.cjs');
const { createNoteCommand } = require('./commands/note.cjs');
const { createTodosCommand } = require('./commands/todos.cjs');
const { createPhasesCommand } = require('./commands/phases.cjs');
const { createDecisionsCommand } = require('./commands/decisions.cjs');
const { createHandoffsCommand } = require('./commands/handoffs.cjs');
const {
  createRequirementsCommand,
  createErrorsCommand,
  createBlockersCommand,
} = require('./commands/readers.cjs');
const { createRefsCommand } = require('./commands/refs.cjs');
const { createNarrativeCommand } = require('./commands/narrative.cjs');
const { createStartCommand } = require('./commands/start.cjs');
const { createSubagentsCommand } = require('./commands/subagents.cjs');
const { createAgentsCommand } = require('./commands/agents.cjs');
const { createSiteCommand } = require('./commands/site.cjs');

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
  detectAgentTelemetry, normalizeEvalRuntime, runtimeInstallFlag,
  resolveSnapshotRuntime, resolveSnapshotAgentInputs,
  simplifyAgentLane, buildAssignmentsView,
} = __cliHelpers;
function ensureEvalRuntimeHooks(runtimeIdentity) {
  return __cliHelpers.ensureEvalRuntimeHooks(runtimeIdentity, {
    outputError, gadEntryPath: __filename,
  });
}

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

// runtime → bin/commands/runtime.cjs (deps SESSION_STATUS / loadSessions /
// buildContextRefs come from session.cjs further down — late-bound)
const { createRuntimeCommand, getRuntimeArg } = require('./commands/runtime.cjs');
let runtimeCmd;

// Shared dependency bag used by most command factories. Each factory
// destructures the keys it needs; extras are ignored. Spread into per-call
// overrides as `{ ...common, extra }` when a single binding needs more.
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

// projects (projects/workspace/ls), species, recipes, generation, env
const { projectsCmd, workspaceCmd, lsCmd }
  = require('./commands/projects.cjs').createProjectsCommands(common);
const speciesCmd = require('./commands/species.cjs').createSpeciesCommand(common);
const recipesCmd = require('./commands/recipes.cjs').createRecipesCommand(common);
const { generationSalvage, generationCmd }
  = require('./commands/generation.cjs').createGenerationCommands(common);
const envCmd = require('./commands/env.cjs').createEnvCommand();

// state / phases / decisions / todos / note / handoffs / refs (sweep E/F)
const stateCmd = createStateCommand(common);
const phasesCmd = createPhasesCommand(common);
const decisionsCmd = createDecisionsCommand(common);
const todosCmd = createTodosCommand(common);
const noteCmd = createNoteCommand(common);
const handoffsCmd = createHandoffsCommand(common);
const refsCmd = createRefsCommand(common);
const requirementsCmd = createRequirementsCommand(common);
const errorsCmd = createErrorsCommand(common);
const blockersCmd = createBlockersCommand(common);
const taskCheckpoint = require('./commands/task-checkpoint.cjs').createTaskCheckpointCommand(common);

const docsCmd = require('./commands/docs.cjs').createDocsCommand(common);
const planningCmd = require('./commands/planning.cjs').createPlanningCommand(common);
const narrativeCmd = createNarrativeCommand();
const startCmd = createStartCommand(common);
const subagentsCmd = createSubagentsCommand(common);
const agentsCmd = createAgentsCommand(common);
const siteCmd = createSiteCommand(common);

// eval surface — split across eval-{info,run,trace,suite,artifacts,preview,skill}.cjs
const { normalizeGenerationReference, buildEvalPrompt } = require('../lib/eval-helpers.cjs');
const evalCommonExtras = { buildEvalPrompt, normalizeEvalRuntime, ensureEvalRuntimeHooks };
const { evalList, evalScore, evalDiff, evalStatus, evalRuns, evalShow, evalScores, evalVersion }
  = require('./commands/eval-info.cjs').createEvalInfoCommands(common);
const { evalRun } = require('./commands/eval-run.cjs').createEvalRunCommand({ ...common, ...evalCommonExtras });
const { evalTraceCmd } = require('./commands/eval-trace.cjs').createEvalTraceCommand(common);
const { evalSetup, evalSuite, evalReport, evalReadme, evalInheritSkills }
  = require('./commands/eval-suite.cjs').createEvalSuiteCommands({ ...common, ...evalCommonExtras });
const { evalPreserve, evalVerify }
  = require('./commands/eval-artifacts.cjs').createEvalArtifactsCommands(common);
const { servePreservedGenerationBuildArtifact, evalOpen, evalReview }
  = require('./commands/eval-preview.cjs').createEvalPreviewSurfaces(common);
const { evalSkillCmd } = require('./commands/eval-skill.cjs').createEvalSkillCommands(common);

// Decision gad-212: promote selected eval subcommands into species / generation
// (the user-visible vocabulary). `gad eval` stays as a deprecated alias.
Object.assign(speciesCmd.subCommands, { run: evalRun, suite: evalSuite });
Object.assign(generationCmd.subCommands, {
  preserve: evalPreserve, verify: evalVerify,
  open: evalOpen, review: evalReview, report: evalReport,
});

const evalCmd = defineCommand({
  meta: { name: 'eval', description: '[DEPRECATED] Use `gad species` or `gad generation` instead' },
  subCommands: { list: evalList, setup: evalSetup, status: evalStatus, version: evalVersion, run: evalRun, runs: evalRuns, show: evalShow, score: evalScore, scores: evalScores, diff: evalDiff, trace: evalTraceCmd, suite: evalSuite, report: evalReport, review: evalReview, open: evalOpen, preserve: evalPreserve, verify: evalVerify, skill: evalSkillCmd, 'inherit-skills': evalInheritSkills, readme: evalReadme },
  run() {
    console.warn("DEPRECATED: 'gad eval <cmd>' is deprecated. Use 'gad species <cmd>' or 'gad generation <cmd>' instead.");
  },
});

// session/context/pause-work + helpers → bin/commands/session.cjs
const _sessionMod = require('./commands/session.cjs').createSessionCommands({
  ...common, sideEffectsSuppressed,
  getLastActiveProjectid, setLastActiveProjectid,
});
const { sessionCmd, pauseWorkCmd, contextCmd } = _sessionMod;
const { SESSION_STATUS, loadSessions, buildContextRefs } = _sessionMod.helpers;
__loadSessionsRef = loadSessions; // late-bind for scope-helpers (resolveRoots)
const { writeSession } = require('./commands/session.cjs');

runtimeCmd = createRuntimeCommand({
  ...common, loadSessions, SESSION_STATUS, buildContextRefs,
});

// Install / sink helpers → lib/install-helpers.cjs
const __installHelpers = require('../lib/install-helpers.cjs');
const {
  GAD_HOOK_MARKER, getClaudeSettingsPath, readJsonSafe, writeJsonPretty,
  isPackagedExecutableRuntime, getPackagedExecutablePath,
  getDefaultSelfInstallDir, updateWindowsUserPath, stampSinkCompileNote,
} = __installHelpers;
function maybeGenerateDailyTip() {
  return __installHelpers.maybeGenerateDailyTip({
    teachings, scriptDir: path.join(__dirname, '..', 'scripts'),
  });
}

const tasksCmd = require('./commands/tasks.cjs').createTasksCommand({
  ...common,
  resolveSnapshotAgentInputs, resolveSnapshotRuntime, ensureAgentLane,
  claimTask, addTaskClaim, nowIso, releaseTask, removeTaskClaim,
  RAW_ARGV, getRuntimeArg, readRawFlagValue, SENTINEL_SKILL_VALUES,
  listAgentLanes, simplifyAgentLane,
});

const migrateSchema = require('./commands/migrate-schema.cjs').createMigrateSchemaCommand(common);
const packCmd = require('./commands/pack.cjs').createPackCommand(common);
const sinkCmd = require('./commands/sink.cjs').createSinkCommand({ ...common, stampSinkCompileNote });
const verifyCmd = require('./commands/verify.cjs').createVerifyCommand(common);
const { createSprintCommand, getSprintPhaseIds, getCurrentSprintIndex } = require('./commands/sprint.cjs');
const sprintCmd = createSprintCommand(common);
const devCmd = require('./commands/dev.cjs').createDevCommand(common);
const logCmd = require('./commands/log.cjs').createLogCommand(common);

// worktree helpers → lib/worktree-helpers.cjs
const { listAllWorktrees, worktreeInfo, findWorktreeByPartial } = require('../lib/worktree-helpers.cjs');
const worktreeExtras = { listAllWorktrees, worktreeInfo, findWorktreeByPartial };
const worktreeCmd = require('./commands/worktree.cjs').createWorktreeCommand({ ...common, ...worktreeExtras });
const healthCmd = require('./commands/health.cjs').createHealthCommand({ ...common, ...worktreeExtras });

const { getFrameworkVersion } = require('../lib/framework-version.cjs');
const discoveryTestCmd = require('./commands/discovery-test.cjs').createDiscoveryTestCommand();
const versionCmd = require('./commands/version.cjs').createVersionCommand({ getFrameworkVersion });

// startup → bin/commands/startup.cjs (decision gad-59: trace-hook handler at
// bin/gad-trace-hook.cjs is merged into ~/.claude/settings.json by install).
const { createStartupCommand, runDogfoodSelfRefreshOrExit } = require('./commands/startup.cjs');
const startupCmd = createStartupCommand({
  ...common,
  sideEffectsSuppressed, resolveSideEffectsMode, NO_SIDE_EFFECTS_FLAG,
  getPackagedExecutablePath, isPackagedExecutableRuntime, getDefaultSelfInstallDir,
  ensureGraphFresh, writeEvolutionScan, maybeGenerateDailyTip,
  getLastActiveProjectid, setLastActiveProjectid,
  sessionHelpers: {
    sessionsDir: require('./commands/session.cjs').sessionsDir,
    generateSessionId: require('./commands/session.cjs').generateSessionId,
    SESSION_STATUS, buildContextRefs, writeSession,
  },
});

const { createSelfCommand, createSelfEvalCommand } = require('./commands/self.cjs');
const selfCmd = createSelfCommand({ runDogfoodSelfRefreshOrExit });
const selfEvalCmd = createSelfEvalCommand(common);

const { install: installCmd, uninstall: uninstallCmd }
  = require('./commands/install.cjs').createInstallCommand({
    getClaudeSettingsPath, readJsonSafe, writeJsonPretty, GAD_HOOK_MARKER,
    isPackagedExecutableRuntime, getPackagedExecutablePath,
    getDefaultSelfInstallDir, updateWindowsUserPath,
  });

const dataCmd = require('./commands/data.cjs').createDataCommand(common);
const roundsCmd = require('./commands/rounds.cjs').createRoundsCommand(common);

// evolution images + evolution: validate/promote/discard/status proto-skills
const evolutionImagesCmd = require('./commands/evolution-images.cjs').createEvolutionImagesCommand({
  splitCsvList, getProtoSkillGlobalDir, listSkillDirs, readSkillFrontmatter,
});
const { evolutionCmd, evolutionPromote, evolutionInstall }
  = require('./commands/evolution.cjs').createEvolutionCommands({
    ...common,
    evolutionPaths, resolveProtoSkillInstallRuntimes, installProtoSkillToRuntime,
    protoSkillRelativePath, writeEvolutionScan, readEvolutionScan,
    evolutionImagesCmd,
  });

// skill (44-36): unified skill ops. promote --framework moves into canonical
// skills/ tree; --project installs into current project's runtime skill dirs.
const { skillCmd } = require('./commands/skill.cjs').createSkillCommands({
  ...common,
  evolutionPaths, resolveSkillRoots, listSkillDirs, readSkillFrontmatter,
  validateSkillLaneFilter, skillMatchesLane, resolveSkillWorkflowPath,
  normalizeSkillLaneValues, lintSkill, summarizeLint, lintAllSkills,
  filterIssuesBySeverity, auditSkillTokens, buildSkillUsageIndex,
  evolutionPromote, evolutionInstall,
});

const bundleCmd = require('./commands/bundle.cjs').createBundleCommand({ readSkillFrontmatter });
const workflowCmd = require('./commands/workflow.cjs').createWorkflowCommand();
const modelsCmd = require('./commands/models.cjs').createModelsCommand();
const graphCmd = require('./commands/graph.cjs').createGraphCommand(common);
const queryCmd = require('./commands/query.cjs').createQueryCommand(common);
const { tryCmd } = require('./commands/try.cjs').createTryCommand();
const { generateCmd } = require('./commands/generate.cjs').createGenerateCommand(common);
const { spawnCmd, breedCmd, playCmd } = require('./commands/shortcuts.cjs').createShortcutCommands({
  ...common, evalRun, servePreservedGenerationBuildArtifact,
});
const tipCmd = require('./commands/tip.cjs').createTipCommand({ ...common, teachings });
const nextCmd = require('./commands/next.cjs').createNextCommand(common);
const publishCmd = require('./commands/publish.cjs').createPublishCommand();

const snapshotCmd = require('./commands/snapshot.cjs').createSnapshotCommand({
  ...common,
  sideEffectsSuppressed, ensureGraphFresh, loadSessions, writeSession,
  resolveSnapshotAgentInputs, resolveSnapshotRuntime, ensureAgentLane,
  listAgentLanes, touchAgentLane,
  buildAssignmentsView, compactStateXml, compactRoadmapSection, compactTasksSection,
  buildEvolutionSection, listSkillDirs, readSkillFrontmatter,
  getCurrentSprintIndex, getSprintPhaseIds,
});

const main = defineCommand({
  meta: {
    name: 'gad',
    description: 'Planning CLI for get-anything-done',
    version: pkg.version,
  },
  subCommands: {
    ls: lsCmd,
    workspace: workspaceCmd,
    projects: projectsCmd,
    species: speciesCmd,
    recipes: recipesCmd,
    generation: generationCmd,
    session: sessionCmd,
    context: contextCmd,
    state: stateCmd,
    phases: phasesCmd,
    tasks: tasksCmd,
    'task-checkpoint': taskCheckpoint,
    next: nextCmd,
    decisions: decisionsCmd,
    handoffs: handoffsCmd,
    todos: todosCmd,
    note: noteCmd,
    notes: noteCmd,
    requirements: requirementsCmd,
    errors: errorsCmd,
    blockers: blockersCmd,
    refs: refsCmd,
    pack: packCmd,
    docs: docsCmd,
    planning: planningCmd,
    narrative: narrativeCmd,
    site: siteCmd,
    self: selfCmd,
    'self-eval': selfEvalCmd,
    data: dataCmd,
    env: envCmd,
    runtime: runtimeCmd,
    eval: evalCmd,
    evolution: evolutionCmd,
    skill: skillCmd,
    models: modelsCmd,
    workflow: workflowCmd,
    rounds: roundsCmd,
    verify: verifyCmd,
    snapshot: snapshotCmd,
    start: startCmd,
    dashboard: startCmd,
    subagents: subagentsCmd,
    agents: agentsCmd,
    startup: startupCmd,
    'pause-work': pauseWorkCmd,
    'discovery-test': discoveryTestCmd,
    sprint: sprintCmd,
    dev: devCmd,
    sink: sinkCmd,
    log: logCmd,
    worktree: worktreeCmd,
    health: healthCmd,
    'migrate-schema': migrateSchema,
    graph: graphCmd,
    query: queryCmd,
    install: installCmd,
    uninstall: uninstallCmd,
    bundle: bundleCmd,
    try: tryCmd,
    generate: generateCmd,
    spawn: spawnCmd,
    breed: breedCmd,
    play: playCmd,
    tip: tipCmd,
    publish: publishCmd,
    version: versionCmd,
  },
});

// argv injectors → lib/argv-injectors.cjs
const __argvInjectors = require('../lib/argv-injectors.cjs');
__argvInjectors.applyDefaultSubcommandInjectors();
__argvInjectors.extractActiveSkillFlag();

runMain(main);

