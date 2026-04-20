'use strict';
/**
 * gad command registry — single source of truth for wiring command factories
 * to subCommand names.
 *
 * This file isolates merge-conflict surface for command additions and
 * dep changes. Adding a new command:
 *   1. Create bin/commands/<name>.cjs exporting createXCommand(deps).
 *   2. Append one entry to `simple` (or `multi` for multi-output factories)
 *      and one alias to the subCommands map at the bottom.
 *
 * Rules of thumb:
 *   - Most commands take only `common`. List them in `simple`.
 *   - Multi-output factories or commands needing extras get explicit blocks.
 *   - Keep this file boring and mechanical. No business logic here.
 */

const { defineCommand } = require('citty');

function build(deps) {
  const { common, extras } = deps;

  // -------------------------------------------------------------------------
  // Multi-output factories — single require, destructure all outputs.
  // -------------------------------------------------------------------------
  const projects = require('./projects.cjs').createProjectsCommands(common);
  const generation = require('./generation.cjs').createGenerationCommands(common);
  const evalInfo = require('./eval-info.cjs').createEvalInfoCommands(common);
  const evalSuite = require('./eval-suite.cjs').createEvalSuiteCommands({ ...common, ...extras.eval });
  const evalArtifacts = require('./eval-artifacts.cjs').createEvalArtifactsCommands(common);
  const evalPreview = require('./eval-preview.cjs').createEvalPreviewSurfaces(common);
  const sessionMod = require('./session.cjs').createSessionCommands({
    ...common, ...extras.session,
  });

  // Late-bind loadSessions so scope-helpers (built earlier in gad.cjs)
  // can resolve session-scoped roots once commands actually run.
  extras.setLoadSessions(sessionMod.helpers.loadSessions);

  const sessionHelpers = sessionMod.helpers;
  const writeSession = require('./session.cjs').writeSession;

  const evolutionImages = require('./evolution-images.cjs').createEvolutionImagesCommand(extras.evolutionImages);
  const evolution = require('./evolution.cjs').createEvolutionCommands({
    ...common, ...extras.evolution, evolutionImagesCmd: evolutionImages,
  });
  const skill = require('./skill.cjs').createSkillCommands({
    ...common, ...extras.skill,
    evolutionPromote: evolution.evolutionPromote,
    evolutionInstall: evolution.evolutionInstall,
  });
  const sprint = require('./sprint.cjs');
  const sprintCmd = sprint.createSprintCommand(common);
  const startupMod = require('./startup.cjs');
  const installMod = require('./install.cjs').createInstallCommand(extras.install);
  const self = require('./self.cjs');
  const shortcuts = require('./shortcuts.cjs');
  const evalRun = require('./eval-run.cjs').createEvalRunCommand({ ...common, ...extras.eval });

  const startupCmd = startupMod.createStartupCommand({
    ...common, ...extras.startup,
    sessionHelpers: {
      sessionsDir: require('./session.cjs').sessionsDir,
      generateSessionId: require('./session.cjs').generateSessionId,
      SESSION_STATUS: sessionHelpers.SESSION_STATUS,
      buildContextRefs: sessionHelpers.buildContextRefs,
      writeSession,
    },
  });

  // -------------------------------------------------------------------------
  // Simple single-output factories. Each takes `common` (or `common` + extras
  // already merged). Add new commands here as one-liners.
  // -------------------------------------------------------------------------
  const cmd = {
    // Multi-output picks
    ls: projects.lsCmd,
    workspace: projects.workspaceCmd,
    projects: projects.projectsCmd,
    generation: generation.generationCmd,
    session: sessionMod.sessionCmd,
    context: sessionMod.contextCmd,
    'pause-work': sessionMod.pauseWorkCmd,
    skill: skill.skillCmd,
    evolution: evolution.evolutionCmd,
    install: installMod.install,
    uninstall: installMod.uninstall,

    // Simple single factories (alphabetical-ish, by domain cluster)
    species: require('./species.cjs').createSpeciesCommand(common),
    recipes: require('./recipes.cjs').createRecipesCommand(common),
    env: require('./env.cjs').createEnvCommand(),

    state: require('./state.cjs').createStateCommand(common),
    phases: require('./phases.cjs').createPhasesCommand(common),
    decisions: require('./decisions.cjs').createDecisionsCommand(common),
    todos: require('./todos.cjs').createTodosCommand(common),
    note: require('./note.cjs').createNoteCommand(common),
    handoffs: require('./handoffs.cjs').createHandoffsCommand(common),
    refs: require('./refs.cjs').createRefsCommand(common),
    requirements: require('./readers.cjs').createRequirementsCommand(common),
    errors: require('./readers.cjs').createErrorsCommand(common),
    blockers: require('./readers.cjs').createBlockersCommand(common),
    'task-checkpoint': require('./task-checkpoint.cjs').createTaskCheckpointCommand(common),

    docs: require('./docs.cjs').createDocsCommand(common),
    planning: require('./planning.cjs').createPlanningCommand(common),
    narrative: require('./narrative.cjs').createNarrativeCommand(),
    start: require('./start.cjs').createStartCommand(common),
    subagents: require('./subagents.cjs').createSubagentsCommand(common),
    agents: require('./agents.cjs').createAgentsCommand(common),
    site: require('./site.cjs').createSiteCommand(common),

    // eval surface
    evalRun,
    evalTrace: require('./eval-trace.cjs').createEvalTraceCommand(common).evalTraceCmd,
    evalSkill: require('./eval-skill.cjs').createEvalSkillCommands(common).evalSkillCmd,

    // runtime depends on session helpers (built above)
    runtime: require('./runtime.cjs').createRuntimeCommand({
      ...common,
      loadSessions: sessionHelpers.loadSessions,
      SESSION_STATUS: sessionHelpers.SESSION_STATUS,
      buildContextRefs: sessionHelpers.buildContextRefs,
    }),

    tasks: require('./tasks.cjs').createTasksCommand({ ...common, ...extras.tasks }),
    migrateSchema: require('./migrate-schema.cjs').createMigrateSchemaCommand(common),
    pack: require('./pack.cjs').createPackCommand(common),
    sink: require('./sink.cjs').createSinkCommand({ ...common, ...extras.sink }),
    verify: require('./verify.cjs').createVerifyCommand(common),
    sprint: sprintCmd,
    dev: require('./dev.cjs').createDevCommand(common),
    log: require('./log.cjs').createLogCommand(common),
    worktree: require('./worktree.cjs').createWorktreeCommand({ ...common, ...extras.worktree }),
    health: require('./health.cjs').createHealthCommand({ ...common, ...extras.worktree }),

    'discovery-test': require('./discovery-test.cjs').createDiscoveryTestCommand(),
    version: require('./version.cjs').createVersionCommand(extras.version),
    startup: startupCmd,
    self: self.createSelfCommand({ runDogfoodSelfRefreshOrExit: startupMod.runDogfoodSelfRefreshOrExit }),
    'self-eval': self.createSelfEvalCommand(common),
    data: require('./data.cjs').createDataCommand(common),
    rounds: require('./rounds.cjs').createRoundsCommand(common),
    bundle: require('./bundle.cjs').createBundleCommand(extras.bundle),
    workflow: require('./workflow.cjs').createWorkflowCommand(),
    models: require('./models.cjs').createModelsCommand(),
    graph: require('./graph.cjs').createGraphCommand(common),
    query: require('./query.cjs').createQueryCommand(common),
    try: require('./try.cjs').createTryCommand().tryCmd,
    generate: require('./generate.cjs').createGenerateCommand(common).generateCmd,
    next: require('./next.cjs').createNextCommand(common),
    publish: require('./publish.cjs').createPublishCommand(),
    tip: require('./tip.cjs').createTipCommand({ ...common, ...extras.tip }),
  };

  // shortcuts (gad-219): need evalRun + servePreservedGenerationBuildArtifact
  const shortcutCmds = shortcuts.createShortcutCommands({
    ...common,
    evalRun,
    servePreservedGenerationBuildArtifact: evalPreview.servePreservedGenerationBuildArtifact,
  });
  cmd.spawn = shortcutCmds.spawnCmd;
  cmd.breed = shortcutCmds.breedCmd;
  cmd.play = shortcutCmds.playCmd;

  // Decision gad-212: promote selected eval subcommands into species/generation
  // (the user-visible vocabulary). `gad eval` stays as a deprecated alias.
  Object.assign(cmd.species.subCommands, { run: evalRun, suite: evalSuite.evalSuite });
  Object.assign(cmd.generation.subCommands, {
    preserve: evalArtifacts.evalPreserve,
    verify: evalArtifacts.evalVerify,
    open: evalPreview.evalOpen,
    review: evalPreview.evalReview,
    report: evalSuite.evalReport,
  });

  const evalCmd = defineCommand({
    meta: {
      name: 'eval',
      description: '[DEPRECATED] Use `gad species` or `gad generation` instead',
    },
    subCommands: {
      list: evalInfo.evalList,
      setup: evalSuite.evalSetup,
      status: evalInfo.evalStatus,
      version: evalInfo.evalVersion,
      run: evalRun,
      runs: evalInfo.evalRuns,
      show: evalInfo.evalShow,
      score: evalInfo.evalScore,
      scores: evalInfo.evalScores,
      diff: evalInfo.evalDiff,
      trace: cmd.evalTrace,
      suite: evalSuite.evalSuite,
      report: evalSuite.evalReport,
      review: evalPreview.evalReview,
      open: evalPreview.evalOpen,
      preserve: evalArtifacts.evalPreserve,
      verify: evalArtifacts.evalVerify,
      skill: cmd.evalSkill,
      'inherit-skills': evalSuite.evalInheritSkills,
      readme: evalSuite.evalReadme,
    },
    run() {
      console.warn(
        "DEPRECATED: 'gad eval <cmd>' is deprecated. Use 'gad species <cmd>' or 'gad generation <cmd>' instead.",
      );
    },
  });

  // -------------------------------------------------------------------------
  // SubCommands map. Adding a new command = append one alias here.
  // Aliases (e.g. note/notes, start/dashboard) listed adjacent.
  // -------------------------------------------------------------------------
  const subCommands = {
    ls: cmd.ls,
    workspace: cmd.workspace,
    projects: cmd.projects,
    species: cmd.species,
    recipes: cmd.recipes,
    generation: cmd.generation,
    session: cmd.session,
    context: cmd.context,
    state: cmd.state,
    phases: cmd.phases,
    tasks: cmd.tasks,
    'task-checkpoint': cmd['task-checkpoint'],
    next: cmd.next,
    decisions: cmd.decisions,
    handoffs: cmd.handoffs,
    todos: cmd.todos,
    note: cmd.note,
    notes: cmd.note,
    requirements: cmd.requirements,
    errors: cmd.errors,
    blockers: cmd.blockers,
    refs: cmd.refs,
    pack: cmd.pack,
    docs: cmd.docs,
    planning: cmd.planning,
    narrative: cmd.narrative,
    site: cmd.site,
    self: cmd.self,
    'self-eval': cmd['self-eval'],
    data: cmd.data,
    env: cmd.env,
    runtime: cmd.runtime,
    eval: evalCmd,
    evolution: cmd.evolution,
    skill: cmd.skill,
    models: cmd.models,
    workflow: cmd.workflow,
    rounds: cmd.rounds,
    verify: cmd.verify,
    start: cmd.start,
    dashboard: cmd.start,
    subagents: cmd.subagents,
    agents: cmd.agents,
    startup: cmd.startup,
    'pause-work': cmd['pause-work'],
    'discovery-test': cmd['discovery-test'],
    sprint: cmd.sprint,
    dev: cmd.dev,
    sink: cmd.sink,
    log: cmd.log,
    worktree: cmd.worktree,
    health: cmd.health,
    'migrate-schema': cmd.migrateSchema,
    graph: cmd.graph,
    query: cmd.query,
    install: cmd.install,
    uninstall: cmd.uninstall,
    bundle: cmd.bundle,
    try: cmd.try,
    generate: cmd.generate,
    spawn: cmd.spawn,
    breed: cmd.breed,
    play: cmd.play,
    tip: cmd.tip,
    publish: cmd.publish,
    version: cmd.version,
  };

  // snapshotCmd is built last because it consumes the most helpers.
  subCommands.snapshot = require('./snapshot.cjs').createSnapshotCommand({
    ...common, ...extras.snapshot,
    loadSessions: sessionHelpers.loadSessions,
    writeSession,
    getCurrentSprintIndex: sprint.getCurrentSprintIndex,
    getSprintPhaseIds: sprint.getSprintPhaseIds,
  });

  return { subCommands };
}

module.exports = { build };
