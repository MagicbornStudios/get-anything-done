'use strict';

/**
 * lib/runtime-health/index.cjs
 *
 * CJS-native runtime health library for gad runtime check + matrix commands.
 * Self-contained: no ESM imports, no external deps. Built-ins only.
 *
 * Exports:
 *   checkInstall(runtimeId, opts?)         → { install, version, path }
 *   checkAuth(runtimeId)                   → { auth, mode, error? }
 *   checkJsonContract(runtimeId, opts?)    → { json_contract, sample?, notes[] }
 *   checkVllm(opts?)                       → { present, endpoint?, alive?, models?, throughput?, queue_depth?, error? }
 *   runFullPreflight(runtimeId, opts?)     → { runtime, install, auth, json_contract, version, path, notes[] }
 *   loadSuccessRates({ taskShape, planningDir }) → Map<runtimeId, { ok, fail, total, rate }>
 *
 * Normalized status enums:
 *   install:       "ok" | "missing" | "broken"
 *   auth:          "ok" | "stale"   | "missing"
 *   json_contract: "ok" | "broken"  | "missing" | "n/a"
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkVllm } = require('./vllm-probe.cjs');

// ---------------------------------------------------------------------------
// Runtime definitions (CJS-native, mirrors runtime-adapters/*.mjs)
// ---------------------------------------------------------------------------

const RUNTIME_IDS = ['claude-code', 'codex-cli', 'gemini-cli', 'opencode'];

/**
 * For each runtime: install probe, auth probe, and json-contract probe.
 * All probes use sync spawn — must complete within the allotted timeout.
 */
function getRuntimeDef(runtimeId, repoRoot) {
  const node = process.execPath;

  if (runtimeId === 'claude-code') {
    return {
      id: 'claude-code',
      // Install: claude binary on PATH
      installProbe: { command: 'claude', args: ['--version'] },
      // Auth: claude --help never triggers network; API key presence indicates config
      // We mark auth as the env-key check; Claude Code may work via browser login too.
      authCheck: () => {
        const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
        return {
          auth: hasKey ? 'ok' : 'missing',
          mode: hasKey ? 'api_key' : 'unknown',
          error: hasKey ? undefined : 'ANTHROPIC_API_KEY not set; runtime may still work via browser login',
        };
      },
      // json_contract: claude -p 'output {"ok":1}' — but claude code is interactive-only in headless
      jsonContractCheck: null, // Claude Code does not support non-interactive headless
      supportsJsonContract: false,
    };
  }

  if (runtimeId === 'codex-cli') {
    const trialScript = repoRoot ? path.join(repoRoot, 'scripts', 'gad-codex-trial.mjs') : null;
    const execArgs = trialScript && fs.existsSync(trialScript)
      ? [trialScript, '--', '--version']
      : null;
    return {
      id: 'codex-cli',
      installProbe: execArgs
        ? { command: node, args: execArgs }
        : { command: 'codex', args: ['--version'] },
      authCheck: () => {
        const hasKey = Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY);
        return {
          auth: hasKey ? 'ok' : 'missing',
          mode: hasKey ? 'api_key' : 'unknown',
          error: hasKey ? undefined : 'No OPENAI_API_KEY / OPENROUTER_API_KEY; runtime may still work via local login',
        };
      },
      jsonContractCheck: repoRoot && trialScript && fs.existsSync(trialScript)
        ? () => ({
          command: node,
          args: [trialScript, '--', 'exec', '--json', '--skip-git-repo-check',
            'Respond with exactly the JSON object {"ok":1} and nothing else.'],
        })
        : null,
      supportsJsonContract: true,
    };
  }

  if (runtimeId === 'gemini-cli') {
    const trialScript = repoRoot ? path.join(repoRoot, 'scripts', 'gemini-trial.mjs') : null;
    const gadGeminiScript = repoRoot ? path.join(repoRoot, 'scripts', 'gad-gemini-trial.mjs') : null;
    const execArgs = trialScript && fs.existsSync(trialScript)
      ? [trialScript, '--', '--version']
      : null;
    return {
      id: 'gemini-cli',
      installProbe: execArgs
        ? { command: node, args: execArgs }
        : { command: 'gemini', args: ['--version'] },
      authCheck: () => {
        const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
        const hasGoogleKey = Boolean(process.env.GOOGLE_API_KEY);
        const vertexMode = /^(1|true|yes|on)$/i.test(process.env.GOOGLE_GENAI_USE_VERTEXAI || '');
        const homeSettings = fs.existsSync(path.join(os.homedir(), '.gemini', 'settings.json'));
        const cwdSettings = fs.existsSync(path.join(process.cwd(), '.gemini', 'settings.json'));

        if (hasGeminiKey) return { auth: 'ok', mode: 'api_key' };
        if (hasGoogleKey || vertexMode) return { auth: 'ok', mode: 'vertex' };
        if (homeSettings || cwdSettings) return { auth: 'ok', mode: 'oauth' };
        return {
          auth: 'missing',
          mode: 'none',
          error: 'Set GEMINI_API_KEY or configure ~/.gemini/settings.json',
        };
      },
      jsonContractCheck: gadGeminiScript && fs.existsSync(gadGeminiScript)
        ? () => ({
          command: node,
          args: [gadGeminiScript, '--', '--prompt',
            'Respond with exactly the JSON object {"ok":1} and nothing else.',
            '--output-format', 'json'],
        })
        : null,
      supportsJsonContract: true,
    };
  }

  if (runtimeId === 'opencode') {
    const trialScript = repoRoot ? path.join(repoRoot, 'scripts', 'gad-opencode-trial.mjs') : null;
    const execArgs = trialScript && fs.existsSync(trialScript)
      ? [trialScript, '--', '--version']
      : null;
    return {
      id: 'opencode',
      installProbe: execArgs
        ? { command: node, args: execArgs }
        : { command: 'opencode', args: ['--version'] },
      authCheck: () => {
        const hasKey = Boolean(
          process.env.OPENAI_API_KEY ||
          process.env.OPENROUTER_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          process.env.GOOGLE_API_KEY,
        );
        return {
          auth: hasKey ? 'ok' : 'missing',
          mode: hasKey ? 'api_key' : 'unknown',
          error: hasKey ? undefined : 'No common provider API keys detected for opencode',
        };
      },
      jsonContractCheck: null, // opencode is interactive-only
      supportsJsonContract: false,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function spawnProbe(command, args, timeoutMs) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: false,
    env: process.env,
    cwd: process.cwd(),
    windowsHide: true,
  });
  return result;
}

function parseVersionFrom(stdout, stderr) {
  const text = (stdout || '') + '\n' + (stderr || '');
  const line = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  if (!line) return null;
  const m = line.match(/([0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?)/);
  return m ? m[1] : line.slice(0, 60);
}

function detectRepoRoot() {
  // Walk up from __dirname looking for the monorepo marker (scripts/runtime-substrate-core.mjs)
  let dir = path.resolve(__dirname, '..', '..');
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'scripts', 'runtime-substrate-core.mjs'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * checkInstall(runtimeId, opts?)
 * Returns: { install: 'ok'|'missing'|'broken', version: string|null, path: string|null, notes: string[] }
 */
function checkInstall(runtimeId, opts = {}) {
  const timeoutMs = opts.timeoutMs || 15000;
  const repoRoot = opts.repoRoot || detectRepoRoot();
  const def = getRuntimeDef(runtimeId, repoRoot);
  const notes = [];

  if (!def) {
    return { install: 'missing', version: null, path: null, notes: [`Unknown runtime id: ${runtimeId}`] };
  }

  const probe = def.installProbe;
  const result = spawnProbe(probe.command, probe.args, timeoutMs);

  if (result.error) {
    const code = result.error.code;
    if (code === 'ENOENT' || code === 'EACCES') {
      notes.push(`binary not found on PATH: ${probe.command}`);
      return { install: 'missing', version: null, path: null, notes };
    }
    notes.push(`probe error: ${result.error.message}`);
    return { install: 'broken', version: null, path: probe.command, notes };
  }

  if (result.signal === 'SIGTERM') {
    notes.push(`probe timed out after ${timeoutMs}ms`);
    return { install: 'broken', version: null, path: probe.command, notes };
  }

  // Many CLIs return non-zero for --version (e.g., codex via trial wrapper).
  // Accept exit 0 or 1 as "installed" as long as version text is parseable.
  const version = parseVersionFrom(result.stdout, result.stderr);
  const exitOk = result.status === 0 || result.status === 1;

  if (!exitOk && !version) {
    const errLine = (result.stderr || '').split(/\r?\n/).find(Boolean) || `exit ${result.status}`;
    notes.push(`version probe failed: ${errLine}`);
    return { install: 'broken', version: null, path: probe.command, notes };
  }

  return {
    install: 'ok',
    version: version || null,
    path: `${probe.command} ${probe.args.join(' ')}`.trim(),
    notes,
  };
}

/**
 * checkAuth(runtimeId)
 * Returns: { auth: 'ok'|'stale'|'missing', mode: string, error?: string }
 */
function checkAuth(runtimeId, opts = {}) {
  const repoRoot = opts.repoRoot || detectRepoRoot();
  const def = getRuntimeDef(runtimeId, repoRoot);
  if (!def) {
    return { auth: 'missing', mode: 'none', error: `Unknown runtime: ${runtimeId}` };
  }
  return def.authCheck();
}

/**
 * checkJsonContract(runtimeId, opts?)
 * Returns: { json_contract: 'ok'|'broken'|'missing'|'n/a', sample?: string, notes: string[] }
 *
 * Probes with a tiny JSON-output request. Aborts if >5s and marks n/a.
 */
function checkJsonContract(runtimeId, opts = {}) {
  const timeoutMs = Math.min(opts.timeoutMs || 5000, 5000); // cap at 5s per spec
  const repoRoot = opts.repoRoot || detectRepoRoot();
  const def = getRuntimeDef(runtimeId, repoRoot);
  const notes = [];

  if (!def) {
    return { json_contract: 'n/a', notes: [`Unknown runtime: ${runtimeId}`] };
  }

  if (!def.supportsJsonContract || !def.jsonContractCheck) {
    notes.push(`${runtimeId} does not support non-interactive JSON output`);
    return { json_contract: 'n/a', notes };
  }

  // Check auth first — skip probe if auth is missing (would just fail with auth error)
  const authResult = def.authCheck();
  if (authResult.auth === 'missing') {
    notes.push(`auth not configured — skipping json-contract probe`);
    return { json_contract: 'n/a', notes };
  }

  const execSpec = def.jsonContractCheck();
  const result = spawnProbe(execSpec.command, execSpec.args, timeoutMs);

  if (result.signal === 'SIGTERM' || (result.error && result.error.code === 'ETIMEDOUT')) {
    notes.push(`probe timed out after ${timeoutMs}ms`);
    return { json_contract: 'n/a', notes };
  }

  if (result.error) {
    notes.push(`probe error: ${result.error.message}`);
    return { json_contract: 'broken', notes };
  }

  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    const errLine = (result.stderr || '').split(/\r?\n/).find(Boolean) || `exit ${result.status}`;
    notes.push(`empty stdout; stderr: ${errLine.slice(0, 120)}`);
    return { json_contract: 'broken', notes };
  }

  // Find last JSON line in stdout
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let parsed = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      parsed = JSON.parse(lines[i]);
      break;
    } catch {}
  }

  if (!parsed) {
    notes.push(`stdout did not contain valid JSON: ${stdout.slice(0, 120)}`);
    return { json_contract: 'broken', sample: stdout.slice(0, 120), notes };
  }

  // Check expected fields — must have at least one key
  if (typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
    notes.push(`JSON response was empty object or array`);
    return { json_contract: 'broken', sample: JSON.stringify(parsed), notes };
  }

  return {
    json_contract: 'ok',
    sample: JSON.stringify(parsed),
    notes,
  };
}

/**
 * runFullPreflight(runtimeId, opts?)
 * Bundles install + auth + json_contract + notes summary.
 * Returns the per-runtime shape from the spec.
 */
function runFullPreflight(runtimeId, opts = {}) {
  const timeoutMs = opts.timeoutMs || 15000;
  const repoRoot = opts.repoRoot || detectRepoRoot();
  const installResult = checkInstall(runtimeId, { timeoutMs, repoRoot });
  const authResult = checkAuth(runtimeId, { repoRoot });
  const jsonResult = installResult.install === 'ok'
    ? checkJsonContract(runtimeId, { timeoutMs: Math.min(timeoutMs, 5000), repoRoot })
    : { json_contract: 'n/a', notes: ['install failed — skipping json-contract probe'] };

  const notes = [
    ...installResult.notes,
    ...authResult.error ? [authResult.error] : [],
    ...jsonResult.notes,
  ];

  return {
    runtime: runtimeId,
    install: installResult.install,
    auth: authResult.auth,
    json_contract: jsonResult.json_contract,
    version: installResult.version,
    path: installResult.path,
    notes,
  };
}

/**
 * loadSuccessRates({ taskShape, planningDir, limit? })
 *
 * Reads .gad/traces/**\/*.json (runtime traces) and counts ok vs fail per runtime
 * for the given taskShape over the last `limit` runs (default 30).
 *
 * Returns: Map<runtimeId, { ok, fail, total, rate }>
 * If no trace data: returns empty Map (callers must handle gracefully).
 */
function loadSuccessRates({ taskShape = '', planningDir = '', limit = 30 } = {}) {
  const rates = new Map();
  const repoRoot = planningDir || detectRepoRoot() || process.cwd();
  const tracesDir = path.join(repoRoot, '.gad', 'traces');

  if (!fs.existsSync(tracesDir)) return rates;

  // Collect all trace files sorted newest-first
  const allFiles = [];
  try {
    for (const day of fs.readdirSync(tracesDir).sort().reverse()) {
      const dayDir = path.join(tracesDir, day);
      if (!fs.statSync(dayDir).isDirectory()) continue;
      for (const name of fs.readdirSync(dayDir).sort().reverse()) {
        if (name.endsWith('.json')) allFiles.push(path.join(dayDir, name));
      }
    }
  } catch {
    return rates;
  }

  const targetShape = String(taskShape || '').toLowerCase().trim();
  let count = 0;

  for (const filePath of allFiles) {
    if (count >= limit * RUNTIME_IDS.length) break; // rough cap
    let trace;
    try {
      trace = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      continue;
    }

    const runtimeId = trace.runtime;
    if (!runtimeId || !RUNTIME_IDS.includes(runtimeId)) continue;

    // Filter by task shape if provided
    const traceShape = (() => {
      const s = trace.taskShape;
      if (!s) return '';
      if (typeof s === 'string') return s.toLowerCase();
      if (typeof s === 'object' && s.category) return String(s.category).toLowerCase();
      return '';
    })();
    if (targetShape && traceShape && traceShape !== targetShape) continue;

    // Determine outcome
    const status = trace.outcomeMetrics?.status || trace.raw?.status || trace.status;
    const ok = status === 'success';

    if (!rates.has(runtimeId)) rates.set(runtimeId, { ok: 0, fail: 0, total: 0, rate: 0 });
    const entry = rates.get(runtimeId);
    entry.total += 1;
    if (ok) entry.ok += 1; else entry.fail += 1;
    count += 1;
  }

  // Compute rate
  for (const [, entry] of rates) {
    entry.rate = entry.total > 0 ? Math.round((entry.ok / entry.total) * 100) / 100 : 0;
  }

  return rates;
}

/**
 * Compute routing recommendation for a runtime given health + success rate data.
 * Returns: 'PREFERRED' | 'OK' | 'AVOID' | 'BLOCKED'
 */
function computeRecommendation(preflight, successEntry) {
  // BLOCKED: any preflight failure
  if (preflight.install !== 'ok' || preflight.auth !== 'ok') return 'BLOCKED';

  if (!successEntry || successEntry.total < 10) {
    // Not enough data — use health-only signal
    return preflight.json_contract === 'ok' ? 'OK' : 'OK';
  }

  if (successEntry.rate >= 0.70) return 'PREFERRED';
  if (successEntry.rate < 0.30) return 'AVOID';
  return 'OK';
}

// ---------------------------------------------------------------------------
// Batch helpers (used by the CLI commands)
// ---------------------------------------------------------------------------

/**
 * runBatchPreflight(runtimeIds?, opts?)
 * Returns array of preflight results for all (or specified) runtimes.
 */
function runBatchPreflight(runtimeIds, opts = {}) {
  const ids = Array.isArray(runtimeIds) && runtimeIds.length > 0
    ? runtimeIds
    : RUNTIME_IDS;
  return ids.map((id) => runFullPreflight(id, opts));
}

/**
 * buildMatrixRows(taskShape, opts?)
 * Returns array of matrix rows for `gad runtime matrix --task-shape <shape>`.
 */
function buildMatrixRows(taskShape, opts = {}) {
  const repoRoot = opts.repoRoot || detectRepoRoot();
  const runtimeIds = opts.runtimeIds || RUNTIME_IDS;
  const preflight = runBatchPreflight(runtimeIds, { ...opts, repoRoot });
  const successRates = loadSuccessRates({
    taskShape,
    planningDir: opts.planningDir || repoRoot,
    limit: opts.limit || 30,
  });

  return preflight.map((p) => {
    const successEntry = successRates.get(p.runtime) || null;
    const recommendation = computeRecommendation(p, successEntry);

    // Health verdict: green/yellow/red
    let health = 'green';
    if (p.install !== 'ok' || p.auth !== 'ok') health = 'red';
    else if (p.json_contract === 'broken') health = 'yellow';

    return {
      runtime: p.runtime,
      health,
      install: p.install,
      auth: p.auth,
      json_contract: p.json_contract,
      version: p.version || 'n/a',
      successRate: successEntry
        ? `${Math.round(successEntry.rate * 100)}% (${successEntry.total} runs)`
        : 'n/a',
      recommendation,
    };
  });
}

module.exports = {
  RUNTIME_IDS,
  checkInstall,
  checkAuth,
  checkJsonContract,
  checkVllm,
  runFullPreflight,
  runBatchPreflight,
  buildMatrixRows,
  loadSuccessRates,
  computeRecommendation,
};
