'use strict';

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { parseCsvValues } = require('./runtime-args.cjs');
const { detectRuntimeSubstrateRepoRoot } = require('./runtime-substrate-scripts.cjs');
const {
  readFileExcerpt,
  detectContextKindFromFile,
  inferTaskShapeFromState,
  buildGadContextProvenance,
} = require('./runtime-context-helpers.cjs');

function createGadRuntimeContextResolver(deps) {
  const {
    findRepoRoot,
    gadConfig,
    resolveRoots,
    loadSessions,
    SESSION_STATUS,
    readState,
    buildContextRefs,
  } = deps;

  return async function resolveGadRuntimeContext({
    projectId = '',
    sessionId = '',
    modeOverride = '',
    forceRuntime = '',
    allowRuntimeOverride = false,
    taskShape = '',
  } = {}) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots({ projectid: projectId || '', all: false }, baseDir, config.roots);
    if (roots.length === 0) {
      throw new Error('No project resolved. Pass --projectid <id> or run from a project root.');
    }
    const root = roots[0];
    const planningDirAbs = path.join(baseDir, root.path, root.planningDir);

    const allSessions = loadSessions(baseDir, [root]);
    const explicitSessionId = String(sessionId || '').trim();
    let session = null;
    if (explicitSessionId) {
      session = allSessions.find((s) => s.id === explicitSessionId) || null;
    } else {
      const active = allSessions.filter((s) => s.status === SESSION_STATUS.ACTIVE);
      if (active.length > 0) session = active[0];
    }

    const resolvedSessionId = session?.id || (explicitSessionId || null);
    const state = readState(root, baseDir);
    const taskShapeSource = taskShape ? 'cli.task-shape' : 'state.next-action';
    const resolvedTaskShape = inferTaskShapeFromState(state, taskShape);
    const refs = buildContextRefs(root, baseDir, session);
    const contextBlocks = [];
    for (const ref of refs.slice(0, 8)) {
      const filePath = fs.existsSync(path.join(baseDir, ref.file))
        ? path.join(baseDir, ref.file)
        : path.join(baseDir, root.path, ref.file);
      const excerpt = readFileExcerpt(filePath, 2200);
      if (!excerpt) continue;
      contextBlocks.push({
        id: `ref:${ref.file}`,
        kind: detectContextKindFromFile(ref.file),
        priority: ref.file.includes('STATE') ? 95 : ref.file.includes('ROADMAP') ? 85 : 70,
        content: `source: ${ref.file}\nreason: ${ref.reason}\n\n${excerpt}`,
      });
    }

    const handoffArtifacts = [];
    const handoffCandidates = [
      path.join(planningDirAbs, 'HANDOFF.json'),
      path.join(planningDirAbs, 'HANDOFF.md'),
    ];
    if (session?._file) handoffCandidates.push(session._file);
    for (const candidate of handoffCandidates) {
      if (!candidate || !fs.existsSync(candidate)) continue;
      const excerpt = readFileExcerpt(candidate, 2400);
      if (!excerpt) continue;
      const rel = path.relative(baseDir, candidate).replace(/\\/g, '/');
      handoffArtifacts.push(rel);
      contextBlocks.push({
        id: `handoff:${path.basename(candidate)}`,
        kind: 'decision-log',
        priority: 92,
        content: `artifact: ${rel}\n\n${excerpt}`,
      });
    }

    const runtimeRepoRoot = detectRuntimeSubstrateRepoRoot(baseDir);
    if (!runtimeRepoRoot) {
      throw new Error('Could not locate runtime substrate scripts. Expected scripts/runtime-substrate-core.mjs.');
    }

    const coreModulePath = pathToFileURL(path.join(runtimeRepoRoot, 'scripts', 'runtime-substrate-core.mjs')).href;
    const core = await import(coreModulePath);
    const loadedRuntimeSubstrateConfig = typeof core.loadRuntimeSubstrateConfig === 'function'
      ? core.loadRuntimeSubstrateConfig(runtimeRepoRoot)
      : { projects: {} };
    const projectOverrideActive = Boolean(
      loadedRuntimeSubstrateConfig
      && loadedRuntimeSubstrateConfig.projects
      && Object.prototype.hasOwnProperty.call(loadedRuntimeSubstrateConfig.projects, root.id),
    );
    const effectiveRuntimeConfig = core.resolveEffectiveRuntimeSubstrateConfig({
      repoRoot: runtimeRepoRoot,
      projectId: root.id,
      modeOverride: modeOverride || null,
      allowRuntimeOverride: Boolean(allowRuntimeOverride),
    });
    const promotedSkills = core.loadPromotedRuntimeSkills({
      repoRoot: runtimeRepoRoot,
      projectId: root.id,
      taskShape: resolvedTaskShape,
    });

    const phaseId = state.currentPhase || session?.position?.phase || null;
    const nextAction = state.nextAction || '';
    const defaultPrompt = [
      'Use the provided GAD planning context to choose and execute the next safe action.',
      `project: ${root.id}`,
      `session: ${resolvedSessionId || 'none'}`,
      `phase: ${phaseId || 'none'}`,
      `next-action: ${nextAction || 'none'}`,
    ].join('\n');

    const context = {
      baseDir,
      runtimeRepoRoot,
      core,
      root,
      projectId: root.id,
      sessionId: resolvedSessionId,
      sessionResolved: Boolean(session),
      state,
      contextRefs: refs,
      contextBlocks,
      handoffArtifacts,
      taskShape: resolvedTaskShape,
      taskShapeSource,
      handoffArtifactsFound: handoffArtifacts.length,
      effectiveRuntimeConfig,
      projectOverrideActive,
      forceRuntimeActive: Boolean(forceRuntime),
      promotedSkills,
      defaultPrompt,
      contextProvenance: null,
      selectionInput: {
        taskShape: resolvedTaskShape,
        promotedSkills,
        forceRuntime: forceRuntime || null,
      },
    };
    context.contextProvenance = buildGadContextProvenance(context);
    return context;
  };
}

function buildRuntimePrompt(core, context, explicitPrompt) {
  const basePrompt = explicitPrompt || context.defaultPrompt;
  if (typeof core.assemblePromptWithContext === 'function') {
    return core.assemblePromptWithContext(basePrompt, context.contextBlocks);
  }
  return basePrompt;
}

function resolveRuntimeIds(args, core) {
  const runtimes = [];
  if (args.runtime) runtimes.push(String(args.runtime).trim());
  if (args.runtimes) runtimes.push(...parseCsvValues(args.runtimes));
  const unique = Array.from(new Set(runtimes.filter(Boolean)));
  if (unique.length > 0) return unique;
  return Array.isArray(core.RUNTIME_IDS) ? core.RUNTIME_IDS : ['claude-code', 'codex-cli', 'gemini-cli', 'opencode'];
}

module.exports = {
  createGadRuntimeContextResolver,
  buildRuntimePrompt,
  resolveRuntimeIds,
};
