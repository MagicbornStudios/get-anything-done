'use strict';
/**
 * lib/retraining/archiver.cjs — archive a displaced model.
 *
 * Two modes:
 *   1. HF push (when training.hf_archive_repo setting OR --repo flag is set)
 *      Wraps `huggingface-cli upload` for the model's on-disk artifact path
 *      and writes a meta.json sidecar with the registry entry snapshot.
 *      Prefers shell-out to huggingface-cli (operator-installed); falls back
 *      to a NOT_INSTALLED error code that callers can react to.
 *
 *   2. Local archive — copies meta.json into .planning/models/archive/<id>/
 *      and (best-effort) symlinks the artifact path. This is the
 *      always-available fallback so `gad models lifecycle archive` never
 *      leaves a displaced model un-archived.
 *
 * Exports:
 *   archiveModel(projectRoot, modelId, opts) -> { mode, ... }
 *   _runHfCli (test-mocking seam)
 *   _readArtifactPath (test-mocking seam)
 *
 * opts:
 *   repo         — override HF repo slug (e.g. 'magicbornstudios/gad-models-archive')
 *   tokenEnv     — env var to read HF token from (default 'HF_TOKEN')
 *   dryRun       — true: describe action but do not push / copy
 *   commitMsg    — commit message for HF upload
 *   private      — create private repo (default true; models default private)
 *
 * The archiver does NOT mutate the model registry — callers (the archive
 * CLI subcommand) flip status to 'archived' after archiver returns success.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');

const DEFAULT_TOKEN_ENV = 'HF_TOKEN';

// ─── HF CLI seam (overridable for tests) ─────────────────────────────────────

function _runHfCli(args, { token, env: extraEnv } = {}) {
  const env = { ...process.env, ...extraEnv };
  if (token) env['HF_TOKEN'] = token;
  try {
    const out = execFileSync('huggingface-cli', args, {
      encoding: 'utf8',
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: out, ok: true };
  } catch (err) {
    if (err.code === 'ENOENT') {
      const e = new Error(
        'huggingface-cli not found. Install it with: pip install huggingface_hub[cli]'
      );
      e.code = 'CLI_MISSING';
      throw e;
    }
    const msg = (err.stderr && err.stderr.toString())
      || (err.stdout && err.stdout.toString())
      || err.message
      || 'huggingface-cli failed';
    const e = new Error(`huggingface-cli failed: ${msg.trim().slice(0, 400)}`);
    e.code = 'CLI_FAILED';
    e.cause = err;
    throw e;
  }
}

// ─── Artifact path resolution (overridable for tests) ────────────────────────

/**
 * Resolve the on-disk artifact path for a model entry.
 *
 * Priority:
 *   1. model.artifact_path (absolute or repo-relative)
 *   2. model.adapters[0]   (LoRA adapter directory — common case)
 *   3. <projectRoot>/.planning/models/artifacts/<id>/
 *
 * Returns { path, exists } — caller decides whether missing artifact is
 * fatal (HF push) or acceptable (local archive of meta only).
 */
function _readArtifactPath(projectRoot, model) {
  const candidates = [];
  if (model && model.artifact_path) {
    const ap = model.artifact_path;
    candidates.push(path.isAbsolute(ap) ? ap : path.join(projectRoot, ap));
  }
  if (model && Array.isArray(model.adapters) && model.adapters.length > 0) {
    const a = model.adapters[0];
    if (typeof a === 'string' && a.length > 0) {
      candidates.push(path.isAbsolute(a) ? a : path.join(projectRoot, a));
    }
  }
  candidates.push(path.join(projectRoot, '.planning', 'models', 'artifacts', model.id));

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return { path: c, exists: true };
    } catch (_) { /* ignore */ }
  }
  return { path: candidates[0], exists: false };
}

// ─── Settings resolution ─────────────────────────────────────────────────────

function _resolveHfRepo(opts) {
  if (opts && typeof opts.repo === 'string' && opts.repo.length > 0) return opts.repo;
  try {
    const { getSetting } = require('../settings-registry.cjs');
    const v = getSetting('training.hf_archive_repo');
    return (typeof v === 'string' && v.length > 0) ? v : null;
  } catch (_) {
    return null;
  }
}

// ─── Local archive (fallback) ────────────────────────────────────────────────

function _archiveLocal(projectRoot, model, { dryRun } = {}) {
  const archiveDir = path.join(projectRoot, '.planning', 'models', 'archive', model.id);
  const metaPath = path.join(archiveDir, 'meta.json');
  const snapshot = { ...model, archived_at: new Date().toISOString() };

  if (dryRun) {
    return {
      mode: 'local',
      dryRun: true,
      archiveDir,
      metaPath,
      wouldWrite: snapshot,
    };
  }

  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  return {
    mode: 'local',
    archiveDir,
    metaPath,
  };
}

// ─── HF push ─────────────────────────────────────────────────────────────────

function _archiveHf(projectRoot, model, opts) {
  const tokenEnv = (opts && opts.tokenEnv) || DEFAULT_TOKEN_ENV;
  const token = process.env[tokenEnv];
  if (!token) {
    const e = new Error(`HF token missing: env var ${tokenEnv} is not set`);
    e.code = 'NO_TOKEN';
    e.tokenEnv = tokenEnv;
    throw e;
  }

  const repo = _resolveHfRepo(opts);
  if (!repo) {
    const e = new Error('HF repo not configured: pass --repo or set training.hf_archive_repo');
    e.code = 'NO_REPO';
    throw e;
  }

  const isPrivate = opts.private === false ? false : true; // default private
  const commitMsg = (opts && opts.commitMsg)
    || `archive: ${model.id} (kind=${model.kind || 'unknown'})`;

  const artifact = (opts && opts._artifactOverride)
    || _readArtifactPath(projectRoot, model);
  if (!artifact.exists && !opts.dryRun) {
    const e = new Error(`artifact path does not exist: ${artifact.path}`);
    e.code = 'NO_ARTIFACT';
    e.artifactPath = artifact.path;
    throw e;
  }

  // Path-in-repo: nest each archived model under <model-id>/ so a single repo
  // can hold many archives.
  const pathInRepo = model.id;

  const cliArgs = [
    'upload',
    repo,
    artifact.path,
    pathInRepo,
    '--repo-type', 'model',
    '--commit-message', commitMsg,
  ];
  if (isPrivate) cliArgs.push('--private');

  if (opts.dryRun) {
    return {
      mode: 'hf',
      dryRun: true,
      repo,
      pathInRepo,
      artifactPath: artifact.path,
      private: isPrivate,
      cliArgs,
      commitMsg,
    };
  }

  const runner = (opts && opts._runHfCli) || _runHfCli;
  const { stdout } = runner(cliArgs, { token });

  // huggingface-cli upload prints the repo URL on success; the commit sha
  // shows on a "Latest commit:" line if --print-commit was set. We capture
  // whatever it emits and let callers parse if needed.
  const repoUrl = `https://huggingface.co/${repo}`;
  const commitSha = _parseCommitSha(stdout);
  return {
    mode: 'hf',
    repo,
    repoUrl,
    pathInRepo,
    artifactPath: artifact.path,
    private: isPrivate,
    commitSha,
    output: (stdout || '').trim(),
  };
}

function _parseCommitSha(stdout) {
  if (!stdout || typeof stdout !== 'string') return null;
  // huggingface-cli prints URLs like
  //   https://huggingface.co/<repo>/commit/<sha>
  // or "Commit sha: <sha>"
  const m1 = stdout.match(/\/commit\/([0-9a-f]{7,40})/);
  if (m1) return m1[1];
  const m2 = stdout.match(/[Cc]ommit\s*(?:sha)?\s*[:=]?\s*([0-9a-f]{7,40})/);
  if (m2) return m2[1];
  return null;
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * archiveModel — archive a model to HF (if configured + token available) or
 * fall back to the local archive directory.
 *
 * @param {string} projectRoot
 * @param {string} modelId
 * @param {object} [opts]
 * @param {string} [opts.repo]      HF repo override
 * @param {string} [opts.tokenEnv]  env var for HF token (default HF_TOKEN)
 * @param {boolean} [opts.dryRun]
 * @param {string} [opts.commitMsg]
 * @param {boolean} [opts.private]  default true
 * @param {boolean} [opts.forceLocal] skip HF path entirely
 * @param {object} [opts._registry] injected registry module (test seam)
 * @returns {object} { mode: 'hf'|'local', ... }
 */
function archiveModel(projectRoot, modelId, opts = {}) {
  const registry = opts._registry || require('../models/registry.cjs');
  const model = registry.getModel(projectRoot, modelId);
  if (!model) {
    const e = new Error(`model not found in registry: ${modelId}`);
    e.code = 'NO_MODEL';
    throw e;
  }

  const repoConfigured = !!_resolveHfRepo(opts);
  const wantHf = !opts.forceLocal && repoConfigured;

  if (!wantHf) {
    return _archiveLocal(projectRoot, model, { dryRun: !!opts.dryRun });
  }

  // HF path: surface errors to caller (NO_TOKEN / CLI_MISSING / NO_ARTIFACT
  // / CLI_FAILED). Caller (CLI subcommand) decides whether to fall back to
  // local archive on each error type.
  return _archiveHf(projectRoot, model, opts);
}

module.exports = {
  archiveModel,
  // Test seams:
  _runHfCli,
  _readArtifactPath,
  _resolveHfRepo,
  _archiveLocal,
  _archiveHf,
  _parseCommitSha,
  DEFAULT_TOKEN_ENV,
};
