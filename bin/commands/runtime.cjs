'use strict';
/**
 * gad runtime — GAD-native runtime substrate commands (check/select/matrix/pipeline/launch)
 *
 * Required deps: findRepoRoot, gadConfig, resolveRoots, loadSessions, SESSION_STATUS,
 *   readState, buildContextRefs, output, outputError, shouldUseJson
 */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { defineCommand } = require('citty');

// Deps injected by createRuntimeCommand; do not call command run() before injection.
let findRepoRoot, gadConfig, resolveRoots, loadSessions, SESSION_STATUS,
    readState, buildContextRefs, output, outputError, shouldUseJson;

function detectRuntimeSubstrateRepoRoot(baseDir) {
  const candidates = [];
  const addCandidate = (dir) => {
    if (!dir) return;
    const resolved = path.resolve(dir);
    if (!candidates.includes(resolved)) candidates.push(resolved);
  };

  addCandidate(baseDir);
  addCandidate(process.cwd());
  addCandidate(path.resolve(__dirname, '..', '..', '..'));

  let cursor = path.resolve(baseDir);
  for (let i = 0; i < 6; i += 1) {
    addCandidate(cursor);
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  for (const root of candidates) {
    const marker = path.join(root, 'scripts', 'runtime-substrate-core.mjs');
    if (fs.existsSync(marker)) return root;
  }
  return null;
}

function resolveRuntimeScriptPath(runtimeRepoRoot, scriptName) {
  const scriptPath = path.join(runtimeRepoRoot, 'scripts', scriptName);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Runtime substrate script not found: ${scriptPath}`);
  }
  return scriptPath;
}

function runRuntimeScriptJson(runtimeRepoRoot, scriptName, scriptArgs) {
  const { spawnSync } = require('child_process');
  const scriptPath = resolveRuntimeScriptPath(runtimeRepoRoot, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: runtimeRepoRoot,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(stderr || stdout || `${scriptName} failed with exit ${result.status}`);
  }

  const raw = (result.stdout || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(lines[i]);
      } catch {}
    }
    throw new Error(`Expected JSON output from ${scriptName}, received non-JSON payload.`);
  }
}

function parseCsvValues(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseRuntimeLaunchArgsText(rawValue) {
  const raw = String(rawValue || '');
  if (!raw.trim()) return [];
  const out = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current.length > 0) {
        out.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (quote) {
    throw new Error('Unterminated quote in --launch-args value.');
  }
  if (current.length > 0) out.push(current);
  return out;
}

function resolveRuntimeLaunchExtraArgs(args) {
  const jsonRaw = String(getRuntimeArg(args, 'launch-args-json', '') || '').trim();
  if (jsonRaw) {
    let parsed;
    try {
      parsed = JSON.parse(jsonRaw);
    } catch (err) {
      throw new Error(`Invalid --launch-args-json payload: ${err.message || err}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error('--launch-args-json must be a JSON array of strings.');
    }
    return parsed.map((entry) => String(entry));
  }
  const textRaw = String(getRuntimeArg(args, 'launch-args', '') || '').trim();
  if (!textRaw) return [];
  return parseRuntimeLaunchArgsText(textRaw);
}

function getRuntimeArg(args, key, fallback = undefined) {
  if (!args || typeof args !== 'object') return fallback;
  const camel = String(key).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
  // citty can expose both dashed and camelized keys; prefer camelized values
  // because dashed keys may retain defaults even when CLI flags are provided.
  if (Object.prototype.hasOwnProperty.call(args, camel)) return args[camel];
  if (Object.prototype.hasOwnProperty.call(args, key)) return args[key];
  return fallback;
}

function normalizeRuntimeLaunchId(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'claude') return 'claude-code';
  if (raw === 'codex') return 'codex-cli';
  if (raw === 'gemini') return 'gemini-cli';
  if (raw === 'open-code') return 'opencode';
  return raw;
}

function buildInteractiveRuntimeLaunchSpec(runtimeId, runtimeRepoRoot) {
  if (runtimeId === 'claude-code') {
    return { command: 'claude', args: [] };
  }
  if (runtimeId === 'codex-cli') {
    return {
      command: process.execPath,
      args: [path.join(runtimeRepoRoot, 'scripts', 'codex-trial.mjs'), '--'],
    };
  }
  if (runtimeId === 'gemini-cli') {
    return {
      command: process.execPath,
      args: [path.join(runtimeRepoRoot, 'scripts', 'gemini-trial.mjs'), '--'],
    };
  }
  if (runtimeId === 'opencode') {
    return {
      command: process.execPath,
      args: [path.join(runtimeRepoRoot, 'scripts', 'opencode-trial.mjs'), '--'],
    };
  }
  throw new Error(`Unsupported runtime id for interactive launch: ${runtimeId}`);
}

function escapePowerShellSingleQuoted(value) {
  return `'${String(value || '').replace(/'/g, "''")}'`;
}

function buildPowerShellArrayLiteral(values) {
  const entries = Array.isArray(values) ? values : [];
  if (entries.length === 0) return '@()';
  return `@(\n${entries.map((entry) => `  ${escapePowerShellSingleQuoted(entry)}`).join(',\n')}\n)`;
}

function writeRuntimeLaunchScriptWindows({ command, args = [], cwd, runtimeId }) {
  const os = require('os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-runtime-launch-'));
  const scriptPath = path.join(tmpDir, 'launch.ps1');
  const lines = [
    '$ErrorActionPreference = "Stop"',
    `$host.UI.RawUI.WindowTitle = ${escapePowerShellSingleQuoted(`GAD Runtime: ${runtimeId}`)}`,
    `$wd = ${escapePowerShellSingleQuoted(cwd)}`,
    'Set-Location -LiteralPath $wd',
    `$cmd = ${escapePowerShellSingleQuoted(command)}`,
    `$argList = ${buildPowerShellArrayLiteral(args)}`,
    'Write-Host ""',
    `Write-Host ${escapePowerShellSingleQuoted(`[gad runtime launch] ${runtimeId}`)} -ForegroundColor Cyan`,
    'Write-Host ""',
    'if ($argList.Count -gt 0) {',
    '  & $cmd @argList',
    '} else {',
    '  & $cmd',
    '}',
    '$exitCode = $LASTEXITCODE',
    'if ($null -ne $exitCode -and $exitCode -ne 0) {',
    '  Write-Host ""',
    `  Write-Host ${escapePowerShellSingleQuoted('[gad runtime launch] process exited with code')} $exitCode -ForegroundColor Yellow`,
    '}',
    '# Best-effort cleanup of temp launcher artifacts after script execution.',
    'try {',
    '  $self = $MyInvocation.MyCommand.Path',
    '  if ($self -and (Test-Path -LiteralPath $self)) { Remove-Item -LiteralPath $self -Force -ErrorAction SilentlyContinue }',
    '  $dir = Split-Path -Parent $self',
    '  if ($dir -and (Test-Path -LiteralPath $dir)) { Remove-Item -LiteralPath $dir -Force -ErrorAction SilentlyContinue }',
    '} catch {}',
  ];
  fs.writeFileSync(scriptPath, `${lines.join('\r\n')}\r\n`, 'utf8');
  return { scriptPath };
}

function launchRuntimeInNewShellWindows({ command, args = [], cwd, runtimeId = 'runtime' }) {
  const { spawn } = require('child_process');
  const argList = Array.isArray(args) ? args : [];
  const { scriptPath } = writeRuntimeLaunchScriptWindows({
    command,
    args: argList,
    cwd,
    runtimeId,
  });
  const child = spawn(
    'powershell',
    ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    {
      cwd,
      env: process.env,
      detached: true,
      windowsHide: false,
      stdio: 'ignore',
    },
  );
  if (!child || !child.pid) {
    throw new Error(`Failed to launch runtime shell for ${command}.`);
  }
  child.unref();
}

function readFileExcerpt(filePath, maxChars = 2400) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}\n\n…[truncated for runtime context]`;
  } catch {
    return null;
  }
}

function detectContextKindFromFile(fileRef) {
  const normalized = String(fileRef || '').replace(/\\/g, '/').toLowerCase();
  if (normalized.endsWith('state.xml') || normalized.endsWith('state.md')) return 'task';
  if (normalized.endsWith('roadmap.xml') || normalized.endsWith('roadmap.md')) return 'phase';
  if (normalized.includes('/phases/') && normalized.endsWith('plan.md')) return 'phase';
  if (normalized.endsWith('agents.md') || normalized.endsWith('claude.md')) return 'runtime-hints';
  if (normalized.includes('handoff')) return 'decision-log';
  return 'file-snippet';
}

function inferTaskShapeFromState(state, explicitTaskShape) {
  if (explicitTaskShape) return explicitTaskShape;
  const nextAction = String(state?.nextAction || '').toLowerCase();
  if (nextAction.includes('test') || nextAction.includes('failing')) return 'test-repair';
  if (nextAction.includes('refactor') || nextAction.includes('cleanup')) return 'refactor';
  if (nextAction.includes('analy') || nextAction.includes('investigat')) return 'analysis';
  return 'planning';
}

function toSelectionTrace(selection = {}, opts = {}) {
  const computedPrimary = Object.prototype.hasOwnProperty.call(selection, 'computedPrimary')
    ? selection.computedPrimary
    : selection?.computed?.primary ?? null;
  const effectivePrimary = Object.prototype.hasOwnProperty.call(selection, 'effectivePrimary')
    ? selection.effectivePrimary
    : selection?.effective?.primary ?? null;
  const fallbackChain = Array.isArray(selection?.fallbackChain)
    ? selection.fallbackChain
    : Array.isArray(selection?.effective?.fallbackChain)
      ? selection.effective.fallbackChain
      : [];
  const reasoning = Array.isArray(selection?.reasoning)
    ? selection.reasoning
    : Array.isArray(selection?.effective?.reasoning)
      ? selection.effective.reasoning
      : [];
  const appliedSkills = Array.isArray(selection?.appliedSkills)
    ? selection.appliedSkills
    : Array.isArray(selection?.effective?.appliedSkills)
      ? selection.effective.appliedSkills
      : [];
  const suppressedSkills = Array.isArray(selection?.suppressedSkills) ? selection.suppressedSkills : [];
  return {
    mode: selection?.mode ?? null,
    configuredPrimary: selection?.configuredPrimary ?? null,
    computedPrimary,
    effectivePrimary,
    fallbackChain,
    reasoning,
    appliedSkills,
    suppressedSkills,
    suppressedReason: selection?.suppressedReason ?? null,
    projectOverrideActive: Boolean(opts.projectOverrideActive),
    forceRuntimeActive: Boolean(opts.forceRuntimeActive),
    forceRuntime: opts.forceRuntime || null,
  };
}

function buildGadContextProvenance(context) {
  const contextRefs = Array.isArray(context?.contextRefs) ? context.contextRefs : [];
  const handoffArtifacts = Array.isArray(context?.handoffArtifacts) ? context.handoffArtifacts : [];
  const contextBlocks = Array.isArray(context?.contextBlocks) ? context.contextBlocks : [];
  const snapshotRefPaths = contextRefs.map((ref) => String(ref?.file || '')).filter(Boolean);
  return {
    projectId: context?.projectId || null,
    sessionId: context?.sessionId || null,
    snapshotSource: {
      present: snapshotRefPaths.length > 0,
      refCount: snapshotRefPaths.length,
      refs: snapshotRefPaths.slice(0, 12),
    },
    handoffInputs: {
      present: handoffArtifacts.length > 0,
      count: handoffArtifacts.length,
      artifacts: handoffArtifacts,
    },
    docInputs: {
      present: contextBlocks.length > 0,
      contextBlockCount: contextBlocks.length,
      contextRefCount: contextRefs.length,
    },
    taskShape: {
      value: context?.taskShape || null,
      source: context?.taskShapeSource || 'state.next-action',
    },
    contextBlocksInjected: contextBlocks.length,
  };
}

function annotateJsonArtifact(filePath, patch) {
  if (!filePath || !patch) return;
  try {
    if (!fs.existsSync(filePath)) return;
    const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const next = { ...current, ...patch };
    fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  } catch {}
}

function annotateRuntimeArtifacts(payload, patch) {
  if (!payload || !patch || typeof patch !== 'object') return;
  if (payload.matrixFile) annotateJsonArtifact(payload.matrixFile, patch);
  if (Array.isArray(payload.traceFiles)) {
    for (const traceFile of payload.traceFiles) annotateJsonArtifact(traceFile, patch);
  }
}

async function resolveGadRuntimeContext({
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

const runtimeCheckCmd = defineCommand({
  meta: { name: 'check', description: 'Run runtime health checks through GAD project/session context.' },
  args: {
    projectid: { type: 'string', description: 'Project id (GAD planning root)', default: '' },
    sessionid: { type: 'string', description: 'Session id for context hydration', default: '' },
    runtime: { type: 'string', description: 'Single runtime id to check', default: '' },
    runtimes: { type: 'string', description: 'Comma-separated runtime ids to check', default: '' },
    smoke: { type: 'boolean', description: 'Run smoke prompt checks when supported', default: false },
    'timeout-ms': { type: 'string', description: 'Probe timeout in milliseconds', default: '60000' },
    'no-save': { type: 'boolean', description: 'Do not persist runtime health artifacts', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  async run({ args }) {
    try {
      const context = await resolveGadRuntimeContext({
        projectId: args.projectid,
        sessionId: args.sessionid,
      });
      const scriptArgs = ['--project-id', context.projectId, '--json'];
      if (args.runtime) scriptArgs.push('--runtime', String(args.runtime));
      if (args.runtimes) scriptArgs.push('--runtimes', String(args.runtimes));
      if (args.smoke) scriptArgs.push('--smoke');
      const timeoutMs = getRuntimeArg(args, 'timeout-ms', '60000');
      const noSave = Boolean(getRuntimeArg(args, 'no-save', false));
      if (timeoutMs) scriptArgs.push('--timeout-ms', String(timeoutMs));
      if (noSave) scriptArgs.push('--no-save');

      const payload = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-check.mjs', scriptArgs);
      payload.gadContext = {
        projectId: context.projectId,
        sessionId: context.sessionId,
        sessionResolved: context.sessionResolved,
        handoffArtifacts: context.handoffArtifacts,
        contextProvenance: context.contextProvenance,
      };

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log(`Runtime check complete for project=${context.projectId} session=${context.sessionId || 'none'}`);
      const rows = (payload.runtimes || []).map((entry) => ({
        runtime: entry.runtime,
        installed: entry.installed,
        auth: entry.authConfigured,
        headless: entry.supportsHeadless,
        json: entry.supportsJsonOutput,
      }));
      output(rows, { title: 'Runtime health (GAD)', format: 'table' });
    } catch (err) {
      outputError(err.message);
    }
  },
});

const runtimeSelectCmd = defineCommand({
  meta: { name: 'select', description: 'Read-only guarded runtime selection with computed vs effective decision output.' },
  args: {
    projectid: { type: 'string', description: 'Project id (GAD planning root)', default: '' },
    sessionid: { type: 'string', description: 'Session id for context hydration', default: '' },
    runtime: { type: 'string', description: 'Single runtime id to consider', default: '' },
    runtimes: { type: 'string', description: 'Comma-separated runtime ids to consider', default: '' },
    prompt: { type: 'string', description: 'Task prompt override', default: '' },
    'task-shape': { type: 'string', description: 'Task shape category', default: '' },
    mode: { type: 'string', description: 'Substrate rollout mode override (off|shadow|assist|active)', default: '' },
    'run-mode': { type: 'string', description: 'Execution mode (plan|implement|analyze|repair|eval)', default: 'plan' },
    'force-runtime': { type: 'string', description: 'Bypass selector and force a runtime', default: '' },
    'allow-runtime-override': { type: 'boolean', description: 'Allow routing overrides for this invocation', default: false },
    'shadow-log': { type: 'boolean', description: 'Include computed decision payload when mode=shadow (disable with --no-shadow-log)', default: true },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  async run({ args }) {
    try {
      const context = await resolveGadRuntimeContext({
        projectId: args.projectid,
        sessionId: args.sessionid,
        modeOverride: args.mode,
        forceRuntime: getRuntimeArg(args, 'force-runtime', ''),
        allowRuntimeOverride: Boolean(getRuntimeArg(args, 'allow-runtime-override', false)),
        taskShape: getRuntimeArg(args, 'task-shape', ''),
      });
      const noShadowLog = !Boolean(getRuntimeArg(args, 'shadow-log', true))
        || Boolean(getRuntimeArg(args, 'no-shadow-log', false));
      if (noShadowLog) {
        context.effectiveRuntimeConfig.log_shadow_decisions = false;
      }
      const core = context.core || (await import(pathToFileURL(path.join(context.runtimeRepoRoot, 'scripts', 'runtime-substrate-core.mjs')).href));
      const runtimeIds = resolveRuntimeIds(args, core);
      const prompt = buildRuntimePrompt(core, context, args.prompt);
      const estimatedTokensIn = Math.ceil(String(prompt || '').length / 4);

      const healthStatuses = {};
      for (const runtime of runtimeIds) {
        healthStatuses[runtime] = core.runtimeHealthReport(runtime, {
          smoke: false,
          timeoutMs: 25000,
        });
      }
      const authStatuses = core.authStatusByRuntime(runtimeIds);
      const installed = Object.fromEntries(
        runtimeIds.map((runtime) => [
          runtime,
          {
            installed: Boolean(healthStatuses[runtime]?.installed),
            executablePath: healthStatuses[runtime]?.executablePath ?? null,
            version: healthStatuses[runtime]?.version ?? null,
            issues: [...(healthStatuses[runtime]?.issues || [])],
          },
        ]),
      );

      const decision = core.selectRuntimeWithGuards({
        runtimeIds,
        taskShape: context.taskShape,
        estimatedTokensIn,
        requiresHeadless: true,
        requiresJsonOutput: true,
        requiresShell: false,
        requiresWrite: false,
        authStatuses,
        healthStatuses,
        installed,
        promotedSkills: context.promotedSkills,
        effectiveConfig: context.effectiveRuntimeConfig,
        forceRuntime: getRuntimeArg(args, 'force-runtime', '') || null,
      });
      const selectionTrace = toSelectionTrace(decision, {
        projectOverrideActive: context.projectOverrideActive,
        forceRuntimeActive: Boolean(getRuntimeArg(args, 'force-runtime', '')),
        forceRuntime: getRuntimeArg(args, 'force-runtime', ''),
      });
      if (decision.mode === 'shadow' && !context.effectiveRuntimeConfig.log_shadow_decisions) {
        selectionTrace.computedPrimary = null;
      }

      const payload = {
        projectId: context.projectId,
        sessionId: context.sessionId,
        mode: decision.mode,
        configuredPrimary: decision.configuredPrimary || null,
        computedPrimary: decision.mode === 'shadow' && !context.effectiveRuntimeConfig.log_shadow_decisions
          ? null
          : decision.computed.primary,
        effectivePrimary: decision.effective.primary,
        fallbackChain: decision.effective.fallbackChain,
        reasoning: decision.effective.reasoning,
        appliedSkills: decision.effective.appliedSkills,
        suppressedSkills: decision.suppressedSkills,
        suppressedReason: decision.suppressedReason,
        forceRuntime: getRuntimeArg(args, 'force-runtime', '') || null,
        routingOverrideSuppressed: decision.routingOverrideSuppressed,
        primaryRuntimeFixed: decision.primaryRuntimeFixed,
        taskShape: context.taskShape,
        runMode: getRuntimeArg(args, 'run-mode', 'plan') || 'plan',
        promotedSkillCount: context.promotedSkills.length,
        handoffArtifacts: context.handoffArtifacts,
        contextProvenance: context.contextProvenance,
        selectionTrace,
        projectOverrideActive: context.projectOverrideActive,
        forceRuntimeActive: selectionTrace.forceRuntimeActive,
        computed: decision.mode === 'shadow' && !context.effectiveRuntimeConfig.log_shadow_decisions
          ? null
          : decision.computed,
        effective: decision.effective,
      };

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log('Runtime selection (GAD)');
      console.log(`project=${payload.projectId} session=${payload.sessionId || 'none'} mode=${payload.mode}`);
      console.log(`configured=${payload.configuredPrimary || 'none'} computed=${payload.computedPrimary || 'none'} effective=${payload.effectivePrimary || 'none'}`);
      console.log(`fallback=${payload.fallbackChain.join(', ') || '(none)'} suppressed-reason=${payload.suppressedReason || 'none'}`);
      console.log(`project-override=${payload.projectOverrideActive ? 'yes' : 'no'} force-runtime=${payload.forceRuntimeActive ? 'yes' : 'no'}`);
      if (payload.forceRuntime) console.log(`force-runtime=${payload.forceRuntime}`);
      if (payload.reasoning.length > 0) {
        console.log('\nreasoning:');
        for (const line of payload.reasoning) console.log(`  - ${line}`);
      }
    } catch (err) {
      outputError(err.message);
    }
  },
});

const runtimeMatrixCmd = defineCommand({
  meta: { name: 'matrix', description: 'Run runtime matrix through GAD project/session context and snapshot-aware prompt assembly.' },
  args: {
    projectid: { type: 'string', description: 'Project id (GAD planning root)', default: '' },
    sessionid: { type: 'string', description: 'Session id for context hydration', default: '' },
    runtime: { type: 'string', description: 'Single runtime id', default: '' },
    runtimes: { type: 'string', description: 'Comma-separated runtime ids', default: '' },
    prompt: { type: 'string', description: 'Prompt override', default: '' },
    'task-shape': { type: 'string', description: 'Task shape category', default: '' },
    mode: { type: 'string', description: 'Substrate rollout mode override (off|shadow|assist|active)', default: '' },
    'run-mode': { type: 'string', description: 'Execution mode', default: 'plan' },
    'phase-id': { type: 'string', description: 'Phase id override', default: '' },
    'task-id': { type: 'string', description: 'Task id override', default: '' },
    'timeout-ms': { type: 'string', description: 'Execution timeout in milliseconds', default: '60000' },
    'expected-file-touches': { type: 'string', description: 'Expected file touch count', default: '0' },
    'no-execute': { type: 'boolean', description: 'Skip runtime execution (selection + health only)', default: false },
    'no-save': { type: 'boolean', description: 'Do not persist traces/matrix artifacts', default: false },
    'force-runtime': { type: 'string', description: 'Bypass selector and force a runtime', default: '' },
    'allow-runtime-override': { type: 'boolean', description: 'Allow routing overrides for this invocation', default: false },
    'shadow-log': { type: 'boolean', description: 'Include computed decision payload when mode=shadow (disable with --no-shadow-log)', default: true },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  async run({ args }) {
    try {
      const context = await resolveGadRuntimeContext({
        projectId: args.projectid,
        sessionId: args.sessionid,
        modeOverride: args.mode,
        forceRuntime: getRuntimeArg(args, 'force-runtime', ''),
        allowRuntimeOverride: Boolean(getRuntimeArg(args, 'allow-runtime-override', false)),
        taskShape: getRuntimeArg(args, 'task-shape', ''),
      });
      const core = context.core || (await import(pathToFileURL(path.join(context.runtimeRepoRoot, 'scripts', 'runtime-substrate-core.mjs')).href));
      const prompt = buildRuntimePrompt(core, context, args.prompt);
      const runMode = getRuntimeArg(args, 'run-mode', 'plan');
      const phaseIdArg = getRuntimeArg(args, 'phase-id', '');
      const taskIdArg = getRuntimeArg(args, 'task-id', '');
      const timeoutMs = getRuntimeArg(args, 'timeout-ms', '60000');
      const expectedFileTouches = getRuntimeArg(args, 'expected-file-touches', '0');
      const noExecute = Boolean(getRuntimeArg(args, 'no-execute', false));
      const noSave = Boolean(getRuntimeArg(args, 'no-save', false));
      const forceRuntime = getRuntimeArg(args, 'force-runtime', '');
      const allowRuntimeOverride = Boolean(getRuntimeArg(args, 'allow-runtime-override', false));
      const noShadowLog = !Boolean(getRuntimeArg(args, 'shadow-log', true))
        || Boolean(getRuntimeArg(args, 'no-shadow-log', false));

      const scriptArgs = [
        '--project-id', context.projectId,
        '--task-shape', context.taskShape,
        '--run-mode', String(runMode || 'plan'),
        '--mode', context.effectiveRuntimeConfig.mode,
        '--prompt', prompt,
        '--json',
      ];
      if (args.runtime) scriptArgs.push('--runtime', String(args.runtime));
      if (args.runtimes) scriptArgs.push('--runtimes', String(args.runtimes));
      if (phaseIdArg || context.state.currentPhase) scriptArgs.push('--phase-id', String(phaseIdArg || context.state.currentPhase));
      if (taskIdArg) scriptArgs.push('--task-id', String(taskIdArg));
      if (timeoutMs) scriptArgs.push('--timeout-ms', String(timeoutMs));
      if (expectedFileTouches) scriptArgs.push('--expected-file-touches', String(expectedFileTouches));
      if (noExecute) scriptArgs.push('--no-execute');
      if (noSave) scriptArgs.push('--no-save');
      if (forceRuntime) scriptArgs.push('--force-runtime', String(forceRuntime));
      if (allowRuntimeOverride) scriptArgs.push('--allow-runtime-override');
      if (noShadowLog) scriptArgs.push('--no-shadow-log');

      const payload = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-matrix.mjs', scriptArgs);
      const selectionTrace = toSelectionTrace(payload.selection, {
        projectOverrideActive: context.projectOverrideActive,
        forceRuntimeActive: Boolean(forceRuntime),
        forceRuntime,
      });
      const artifactPatch = {
        gadContextProvenance: context.contextProvenance,
        gadSelectionTrace: selectionTrace,
      };
      annotateRuntimeArtifacts(payload, artifactPatch);
      payload.selectionTrace = selectionTrace;
      payload.gadContext = {
        projectId: context.projectId,
        sessionId: context.sessionId,
        sessionResolved: context.sessionResolved,
        contextRefCount: context.contextRefs.length,
        contextBlockCount: context.contextBlocks.length,
        handoffArtifacts: context.handoffArtifacts,
        contextProvenance: context.contextProvenance,
        projectOverrideActive: context.projectOverrideActive,
        forceRuntimeActive: Boolean(forceRuntime),
      };

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log(`Runtime matrix complete (project=${context.projectId}, session=${context.sessionId || 'none'})`);
      console.log(`mode=${payload.substrateMode || context.effectiveRuntimeConfig.mode} runMode=${payload.runMode || args['run-mode']}`);
      console.log(`configured=${selectionTrace.configuredPrimary || 'none'} computed=${selectionTrace.computedPrimary || 'none'} effective=${selectionTrace.effectivePrimary || 'none'}`);
      console.log(`fallback=${selectionTrace.fallbackChain.join(', ') || '(none)'} suppressed-reason=${selectionTrace.suppressedReason || 'none'}`);
      const rows = (payload.runs || []).map((run) => ({
        runtime: run.runtime,
        status: run.status,
        error: run.normalizedErrorCode || 'none',
        durationMs: run.durationMs,
      }));
      output(rows, { title: 'Runtime matrix results', format: 'table' });
    } catch (err) {
      outputError(err.message);
    }
  },
});

const runtimePipelineCmd = defineCommand({
  meta: { name: 'pipeline', description: 'Run check -> matrix -> score -> candidates using GAD runtime context.' },
  args: {
    projectid: { type: 'string', description: 'Project id (GAD planning root)', default: '' },
    sessionid: { type: 'string', description: 'Session id for context hydration', default: '' },
    runtime: { type: 'string', description: 'Single runtime id', default: '' },
    runtimes: { type: 'string', description: 'Comma-separated runtime ids', default: '' },
    prompt: { type: 'string', description: 'Prompt override', default: '' },
    'task-shape': { type: 'string', description: 'Task shape category', default: '' },
    mode: { type: 'string', description: 'Substrate rollout mode override (off|shadow|assist|active)', default: '' },
    'run-mode': { type: 'string', description: 'Execution mode', default: 'plan' },
    'phase-id': { type: 'string', description: 'Phase id override', default: '' },
    'task-id': { type: 'string', description: 'Task id override', default: '' },
    'timeout-ms': { type: 'string', description: 'Execution timeout in milliseconds', default: '60000' },
    'expected-file-touches': { type: 'string', description: 'Expected file touch count', default: '0' },
    'no-execute': { type: 'boolean', description: 'Skip runtime execution during matrix stage', default: false },
    'no-save': { type: 'boolean', description: 'Do not persist traces/matrix artifacts', default: false },
    'force-runtime': { type: 'string', description: 'Bypass selector and force a runtime', default: '' },
    'allow-runtime-override': { type: 'boolean', description: 'Allow routing overrides for this invocation', default: false },
    'shadow-log': { type: 'boolean', description: 'Include computed decision payload when mode=shadow (disable with --no-shadow-log)', default: true },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  async run({ args }) {
    try {
      const context = await resolveGadRuntimeContext({
        projectId: args.projectid,
        sessionId: args.sessionid,
        modeOverride: args.mode,
        forceRuntime: getRuntimeArg(args, 'force-runtime', ''),
        allowRuntimeOverride: Boolean(getRuntimeArg(args, 'allow-runtime-override', false)),
        taskShape: getRuntimeArg(args, 'task-shape', ''),
      });
      const core = context.core || (await import(pathToFileURL(path.join(context.runtimeRepoRoot, 'scripts', 'runtime-substrate-core.mjs')).href));
      const prompt = buildRuntimePrompt(core, context, args.prompt);
      const runMode = getRuntimeArg(args, 'run-mode', 'plan');
      const phaseIdArg = getRuntimeArg(args, 'phase-id', '');
      const taskIdArg = getRuntimeArg(args, 'task-id', '');
      const timeoutMs = getRuntimeArg(args, 'timeout-ms', '60000');
      const expectedFileTouches = getRuntimeArg(args, 'expected-file-touches', '0');
      const noExecute = Boolean(getRuntimeArg(args, 'no-execute', false));
      const noSave = Boolean(getRuntimeArg(args, 'no-save', false));
      const forceRuntime = getRuntimeArg(args, 'force-runtime', '');
      const allowRuntimeOverride = Boolean(getRuntimeArg(args, 'allow-runtime-override', false));
      const noShadowLog = !Boolean(getRuntimeArg(args, 'shadow-log', true))
        || Boolean(getRuntimeArg(args, 'no-shadow-log', false));

      const commonCheckArgs = ['--project-id', context.projectId, '--json'];
      if (args.runtime) commonCheckArgs.push('--runtime', String(args.runtime));
      if (args.runtimes) commonCheckArgs.push('--runtimes', String(args.runtimes));
      if (timeoutMs) commonCheckArgs.push('--timeout-ms', String(timeoutMs));
      if (noSave) commonCheckArgs.push('--no-save');

      const check = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-check.mjs', commonCheckArgs);

      const matrixArgs = [
        '--project-id', context.projectId,
        '--task-shape', context.taskShape,
        '--run-mode', String(runMode || 'plan'),
        '--mode', context.effectiveRuntimeConfig.mode,
        '--prompt', prompt,
        '--json',
      ];
      if (args.runtime) matrixArgs.push('--runtime', String(args.runtime));
      if (args.runtimes) matrixArgs.push('--runtimes', String(args.runtimes));
      if (phaseIdArg || context.state.currentPhase) matrixArgs.push('--phase-id', String(phaseIdArg || context.state.currentPhase));
      if (taskIdArg) matrixArgs.push('--task-id', String(taskIdArg));
      if (timeoutMs) matrixArgs.push('--timeout-ms', String(timeoutMs));
      if (expectedFileTouches) matrixArgs.push('--expected-file-touches', String(expectedFileTouches));
      if (noExecute) matrixArgs.push('--no-execute');
      if (noSave) matrixArgs.push('--no-save');
      if (forceRuntime) matrixArgs.push('--force-runtime', String(forceRuntime));
      if (allowRuntimeOverride) matrixArgs.push('--allow-runtime-override');
      if (noShadowLog) matrixArgs.push('--no-shadow-log');

      const matrix = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-matrix.mjs', matrixArgs);
      const selectionTrace = toSelectionTrace(matrix.selection, {
        projectOverrideActive: context.projectOverrideActive,
        forceRuntimeActive: Boolean(forceRuntime),
        forceRuntime,
      });
      const artifactPatch = {
        gadContextProvenance: context.contextProvenance,
        gadSelectionTrace: selectionTrace,
      };
      annotateRuntimeArtifacts(matrix, artifactPatch);
      matrix.selectionTrace = selectionTrace;
      const score = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-score.mjs', ['--project-id', context.projectId, '--json']);
      const candidates = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-candidates.mjs', ['--json']);

      const payload = {
        executedAt: new Date().toISOString(),
        context: {
          projectId: context.projectId,
          sessionId: context.sessionId,
          sessionResolved: context.sessionResolved,
          taskShape: context.taskShape,
          mode: context.effectiveRuntimeConfig.mode,
          contextRefCount: context.contextRefs.length,
          contextBlockCount: context.contextBlocks.length,
          handoffArtifacts: context.handoffArtifacts,
          contextProvenance: context.contextProvenance,
          projectOverrideActive: context.projectOverrideActive,
          forceRuntimeActive: Boolean(forceRuntime),
        },
        selectionTrace,
        check,
        matrix,
        score,
        candidates,
      };

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log(`Runtime pipeline complete (project=${context.projectId}, session=${context.sessionId || 'none'})`);
      console.log(`mode=${context.effectiveRuntimeConfig.mode} task-shape=${context.taskShape}`);
      console.log(`configured=${selectionTrace.configuredPrimary || 'none'} computed=${selectionTrace.computedPrimary || 'none'} effective=${selectionTrace.effectivePrimary || 'none'}`);
      console.log(`project-override=${selectionTrace.projectOverrideActive ? 'yes' : 'no'} force-runtime=${selectionTrace.forceRuntimeActive ? 'yes' : 'no'}`);
      const emitted = Array.isArray(candidates.emitted) ? candidates.emitted.length : 0;
      console.log(`candidates-emitted=${emitted}`);
      const runs = Array.isArray(matrix.runs) ? matrix.runs : [];
      for (const run of runs) {
        console.log(`  - ${run.runtime}: status=${run.status} error=${run.normalizedErrorCode || 'none'}`);
      }
    } catch (err) {
      outputError(err.message);
    }
  },
});

const runtimeLaunchCmd = defineCommand({
  meta: {
    name: 'launch',
    description: 'Launch an interactive runtime CLI (new shell by default) using GAD project/session context.',
  },
  args: {
    projectid: { type: 'string', description: 'Project id (GAD planning root)', default: '' },
    sessionid: { type: 'string', description: 'Session id for context hydration', default: '' },
    id: { type: 'string', description: 'Runtime id alias (claude, codex, gemini, opencode)', default: '' },
    runtime: { type: 'string', description: 'Runtime id (claude-code, codex-cli, gemini-cli, opencode)', default: '' },
    runtimes: { type: 'string', description: 'Comma-separated runtimes to consider when --id/--runtime omitted', default: '' },
    'task-shape': { type: 'string', description: 'Task shape category', default: '' },
    mode: { type: 'string', description: 'Substrate rollout mode override (off|shadow|assist|active)', default: '' },
    'force-runtime': { type: 'string', description: 'Bypass selector and force a runtime', default: '' },
    'allow-runtime-override': { type: 'boolean', description: 'Allow routing overrides for this invocation', default: false },
    'new-shell': { type: 'boolean', description: 'Launch in a new shell window', default: true },
    'same-shell': { type: 'boolean', description: 'Launch in the current shell (blocks until runtime exits)', default: false },
    'skip-health-check': { type: 'boolean', description: 'Skip runtime executable/auth health probes before launch', default: false },
    'launch-args': { type: 'string', description: 'Extra args passed to the launched runtime command (supports simple quoted strings)', default: '' },
    'launch-args-json': { type: 'string', description: 'JSON array of extra args passed to the launched runtime command (overrides --launch-args)', default: '' },
    'dry-run': { type: 'boolean', description: 'Resolve runtime and launch command but do not execute', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  async run({ args }) {
    try {
      const context = await resolveGadRuntimeContext({
        projectId: args.projectid,
        sessionId: args.sessionid,
        modeOverride: args.mode,
        forceRuntime: getRuntimeArg(args, 'force-runtime', ''),
        allowRuntimeOverride: Boolean(getRuntimeArg(args, 'allow-runtime-override', false)),
        taskShape: getRuntimeArg(args, 'task-shape', ''),
      });
      const core = context.core || (await import(pathToFileURL(path.join(context.runtimeRepoRoot, 'scripts', 'runtime-substrate-core.mjs')).href));

      const explicitId = normalizeRuntimeLaunchId(getRuntimeArg(args, 'id', '') || getRuntimeArg(args, 'runtime', ''));
      const forceRuntime = normalizeRuntimeLaunchId(getRuntimeArg(args, 'force-runtime', ''));
      const selectionRuntimeIds = resolveRuntimeIds(args, core).map((id) => normalizeRuntimeLaunchId(id));
      let selectedRuntime = explicitId || forceRuntime || '';
      let selectionTrace = null;

      if (!selectedRuntime) {
        const runtimeIds = Array.from(new Set(selectionRuntimeIds.filter(Boolean)));
        const healthStatuses = {};
        for (const runtime of runtimeIds) {
          healthStatuses[runtime] = core.runtimeHealthReport(runtime, {
            smoke: false,
            timeoutMs: 25000,
          });
        }
        const authStatuses = core.authStatusByRuntime(runtimeIds);
        const installed = Object.fromEntries(
          runtimeIds.map((runtime) => [
            runtime,
            {
              installed: Boolean(healthStatuses[runtime]?.installed),
              executablePath: healthStatuses[runtime]?.executablePath ?? null,
              version: healthStatuses[runtime]?.version ?? null,
              issues: [...(healthStatuses[runtime]?.issues || [])],
            },
          ]),
        );
        const decision = core.selectRuntimeWithGuards({
          runtimeIds,
          taskShape: context.taskShape,
          estimatedTokensIn: 0,
          requiresHeadless: false,
          requiresJsonOutput: false,
          requiresShell: true,
          requiresWrite: true,
          authStatuses,
          healthStatuses,
          installed,
          promotedSkills: context.promotedSkills,
          effectiveConfig: context.effectiveRuntimeConfig,
          forceRuntime: forceRuntime || null,
        });
        selectionTrace = toSelectionTrace(decision, {
          projectOverrideActive: context.projectOverrideActive,
          forceRuntimeActive: Boolean(forceRuntime),
          forceRuntime,
        });
        selectedRuntime = normalizeRuntimeLaunchId(decision.effective?.primary || decision.computed?.primary || '');
      }

      if (!selectedRuntime) {
        throw new Error('Could not resolve a runtime to launch. Pass --id <runtime> to force one.');
      }

      const launchSpec = buildInteractiveRuntimeLaunchSpec(selectedRuntime, context.runtimeRepoRoot);
      const extraRuntimeArgs = resolveRuntimeLaunchExtraArgs(args);
      const launchArgs = [...(launchSpec.args || []), ...extraRuntimeArgs];
      const sameShell = Boolean(getRuntimeArg(args, 'same-shell', false));
      const launchInNewShell = sameShell ? false : Boolean(getRuntimeArg(args, 'new-shell', true));
      const dryRun = Boolean(getRuntimeArg(args, 'dry-run', false));
      const skipHealthCheck = Boolean(getRuntimeArg(args, 'skip-health-check', false)) || dryRun;
      const auth = core.authStatusByRuntime([selectedRuntime])[selectedRuntime];
      let health = {
        installed: null,
        version: null,
        executablePath: null,
        supportsWorkspaceWrite: null,
        supportsHeadless: null,
        supportsJsonOutput: null,
        issues: [],
        warnings: [],
      };
      if (!skipHealthCheck) {
        health = core.runtimeHealthReport(selectedRuntime, { smoke: false, timeoutMs: 25000 });
        if (!health.installed) {
          throw new Error(`Runtime ${selectedRuntime} is not installed or not on PATH. ${health.issues.join(' | ')}`);
        }
      }

      const payload = {
        projectId: context.projectId,
        sessionId: context.sessionId,
        taskShape: context.taskShape,
        runtime: selectedRuntime,
        launchInNewShell,
        sameShell,
        dryRun,
        command: launchSpec.command,
        args: launchArgs,
        cwd: context.runtimeRepoRoot,
        extraArgs: extraRuntimeArgs,
        healthCheckSkipped: skipHealthCheck,
        health: {
          installed: health.installed,
          version: health.version,
          executablePath: health.executablePath,
          supportsWorkspaceWrite: health.supportsWorkspaceWrite,
          supportsHeadless: health.supportsHeadless,
          supportsJsonOutput: health.supportsJsonOutput,
          issues: health.issues,
          warnings: health.warnings,
        },
        auth: auth || null,
        contextProvenance: context.contextProvenance,
        selectionTrace,
      };

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(payload, null, 2));
        if (dryRun) return;
      }

      if (dryRun) {
        console.log(`Runtime launch dry-run: ${selectedRuntime}`);
        console.log(`command=${launchSpec.command} ${(launchArgs || []).join(' ')}`.trim());
        return;
      }

      if (launchInNewShell) {
        if (process.platform !== 'win32') {
          throw new Error('New-shell launch is currently implemented for Windows only. Use --same-shell on this platform.');
        }
        launchRuntimeInNewShellWindows({
          command: launchSpec.command,
          args: launchArgs,
          cwd: context.runtimeRepoRoot,
          runtimeId: selectedRuntime,
        });
        if (!args.json && !shouldUseJson()) {
          console.log(`Launched ${selectedRuntime} in a new shell window.`);
        }
        return;
      }

      const { spawnSync } = require('child_process');
      const child = spawnSync(launchSpec.command, launchArgs, {
        cwd: context.runtimeRepoRoot,
        env: process.env,
        stdio: 'inherit',
        shell: false,
      });
      if (child.error) throw child.error;
      if (child.status !== 0) {
        throw new Error(`${selectedRuntime} exited with status ${child.status}.`);
      }
    } catch (err) {
      outputError(err.message);
    }
  },
});

const runtimeCmd = defineCommand({
  meta: {
    name: 'runtime',
    description: 'GAD-native runtime substrate commands (check/select/matrix/pipeline/launch).',
  },
  subCommands: {
    check: runtimeCheckCmd,
    select: runtimeSelectCmd,
    matrix: runtimeMatrixCmd,
    pipeline: runtimePipelineCmd,
    launch: runtimeLaunchCmd,
  },
});

// Helpers exposed for re-use elsewhere in gad.cjs (e.g., tasksCmd uses getRuntimeArg)
module.exports = {
  createRuntimeCommand,
  getRuntimeArg,
};

function createRuntimeCommand(deps) {
  const { findRepoRoot: _findRepoRoot, gadConfig: _gadConfig, resolveRoots: _resolveRoots,
          loadSessions: _loadSessions, SESSION_STATUS: _SESSION_STATUS,
          readState: _readState, buildContextRefs: _buildContextRefs,
          output: _output, outputError: _outputError, shouldUseJson: _shouldUseJson } = deps;
  // Bind closures
  findRepoRoot = _findRepoRoot;
  gadConfig = _gadConfig;
  resolveRoots = _resolveRoots;
  loadSessions = _loadSessions;
  SESSION_STATUS = _SESSION_STATUS;
  readState = _readState;
  buildContextRefs = _buildContextRefs;
  output = _output;
  outputError = _outputError;
  shouldUseJson = _shouldUseJson;
  return runtimeCmd;
}
