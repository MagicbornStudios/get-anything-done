'use strict';
/**
 * lib/retraining/trainer-dispatch.cjs — trainer dispatcher for the lifecycle pipeline.
 *
 * Phase 253-05 (GLOBAL-T-253-05).
 *
 * Public API:
 *   trainModel(projectRoot, modelId, opts?) -> { ok, kind, mode, artifactPath, registryEntry, stdout, stderr, dryRun }
 *
 * Dispatch table by model.kind:
 *
 *   knn | intent (classic-ML)
 *     → locate .planning/data-dungeon/<dataset>/train.mjs via model.dataset_id or
 *       dataset_dir field; fall back to scanning for a dir whose name contains
 *       model.id.  Runs `node train.mjs` as a child process (inherits stdout so
 *       progress streams to the terminal).  Artifact: whatever train.mjs writes
 *       under its own models/ dir.  Promotes a staging entry in registry.json.
 *
 *   mid (mid-tier)
 *     → looks for ../slm_learning/src/trainers/<trainer>.py.  If missing, emits a
 *       GAP report (ok=true, mode='gap') instead of hard-failing — operator can
 *       decide whether to write the trainer.  If found, runs `python <script>
 *       --model-id <id>`.
 *
 *   llm (large language model)
 *     → looks for ../slm_learning/scripts/train_qlora.py (primary) or
 *       train_lora.py (fallback).  Same gap-report pattern.  Per project memory
 *       (project_local_cuda_training_in_scope.md): local laptop CUDA is the play
 *       — Modal is NOT wired here.  When script exists, runs
 *       `python <script> --model-id <id>`.
 *
 * After a successful run (non-dry) the dispatcher:
 *   1. Writes .planning/models/<modelId>/train-meta.json with run provenance.
 *   2. Calls registry.upsertModel() to set last_train_at, status='staging', and
 *      artifact_path (pointing at the model artifact produced by train.mjs / py).
 *   3. Appends a line to .planning/models/training-runs.jsonl (decision gad-392).
 *
 * opts:
 *   dryRun   {boolean}  — describe invocation without executing
 *   datasetId {string}  — override dataset directory name (for knn/intent)
 *   trainerScript {string} — override trainer script path (for llm/mid)
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const registry = require('../models/registry.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODELS_STAGING_DIR = path.join('.planning', 'models');
const TRAINING_RUNS_JSONL = path.join('.planning', 'models', 'training-runs.jsonl');

function stagingDir(projectRoot, modelId) {
  return path.join(projectRoot, MODELS_STAGING_DIR, modelId);
}

function trainingRunsPath(projectRoot) {
  return path.join(projectRoot, TRAINING_RUNS_JSONL);
}

/** Append one JSON line to the training-runs lineage log (decision gad-392). */
function appendTrainingRun(projectRoot, entry) {
  const p = trainingRunsPath(projectRoot);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(p, JSON.stringify(entry) + '\n', 'utf8');
}

/** Write staging meta JSON for a completed run. */
function writeTrainMeta(projectRoot, modelId, meta) {
  const dir = stagingDir(projectRoot, modelId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'train-meta.json');
  fs.writeFileSync(p, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  return p;
}

/** Locate slm_learning root (one level up from the monorepo). */
function slmLearningRoot(projectRoot) {
  // Canonical: sibling of the monorepo root
  return path.resolve(projectRoot, '..', 'slm_learning');
}

/** Return a gap-report object (ok=true so pipeline can continue with operator decision). */
function gapReport(modelId, kind, missingPath, suggestion) {
  return {
    ok: true,
    kind,
    mode: 'gap',
    modelId,
    missingPath,
    suggestion,
    message: `Trainer script not found: ${missingPath}. ${suggestion}`,
  };
}

// ---------------------------------------------------------------------------
// Dataset / train.mjs resolution for knn/intent
// ---------------------------------------------------------------------------

/** Find the data-dungeon dataset directory for a knn/intent model.
 *
 *  Resolution order:
 *    1. opts.datasetId — explicit override
 *    2. model.dataset_id field in registry
 *    3. model.dataset_dir field
 *    4. Scan .planning/data-dungeon/ for a dir whose name === modelId
 *    5. Scan for a dir whose name contains any token of modelId (first match wins)
 */
function resolveDatasetDir(projectRoot, model, opts) {
  const dungeonRoot = path.join(projectRoot, '.planning', 'data-dungeon');

  function tryDir(name) {
    const full = path.join(dungeonRoot, name);
    return fs.existsSync(full) && fs.statSync(full).isDirectory() ? full : null;
  }

  if (opts.datasetId) {
    const d = tryDir(opts.datasetId);
    if (d) return d;
    throw Object.assign(
      new Error(`dataset dir not found: ${opts.datasetId}`),
      { code: 'NO_DATASET' }
    );
  }

  if (model.dataset_id) {
    const d = tryDir(model.dataset_id);
    if (d) return d;
  }

  if (model.dataset_dir) {
    const d = tryDir(model.dataset_dir);
    if (d) return d;
    // Could be an absolute path
    if (fs.existsSync(model.dataset_dir)) return model.dataset_dir;
  }

  // Try exact match on model.id
  {
    const d = tryDir(model.id);
    if (d) return d;
  }

  // Token-based fuzzy match (model.id may be 'task-skill-v2', dataset dir 'task-skill')
  if (fs.existsSync(dungeonRoot)) {
    const dirs = fs.readdirSync(dungeonRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    const tokens = model.id.replace(/[-_v\d.]+$/, '').split(/[-_]/);
    for (const dir of dirs) {
      if (tokens.some((t) => t.length >= 4 && dir.includes(t))) {
        const d = tryDir(dir);
        if (d) return d;
      }
    }
  }

  throw Object.assign(
    new Error(
      `No data-dungeon dataset found for model "${model.id}". ` +
      `Add a dataset_id field to the registry entry or create .planning/data-dungeon/${model.id}/.`
    ),
    { code: 'NO_DATASET' }
  );
}

/** Find the train.mjs script inside a dataset directory. */
function resolveTrainScript(datasetDir) {
  const candidates = ['train.mjs', 'train.js', 'train.cjs'];
  for (const name of candidates) {
    const p = path.join(datasetDir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Guess where the trained artifact lives after running train.mjs.
 *
 *  Heuristic: look for a models/ subdirectory and return the newest file
 *  under it, or fall back to the dataset dir itself.
 */
function detectArtifact(datasetDir) {
  const modelsDir = path.join(datasetDir, 'models');
  if (!fs.existsSync(modelsDir)) return null;

  let newest = null;
  let newestMtime = 0;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        try {
          const mtime = fs.statSync(full).mtimeMs;
          if (mtime > newestMtime) { newestMtime = mtime; newest = full; }
        } catch (_) {}
      }
    }
  }

  try { walk(modelsDir); } catch (_) {}
  return newest;
}

// ---------------------------------------------------------------------------
// Dispatcher implementations
// ---------------------------------------------------------------------------

function spawnTrainer(cmd, args, cwd, dryRun) {
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      stdout: '',
      stderr: '',
      invocation: [cmd, ...args].join(' '),
    };
  }

  const result = spawnSync(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });

  const ok = result.status === 0 && !result.error;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  if (result.error) {
    const err = new Error(`Spawn failed: ${result.error.message}`);
    err.code = 'SPAWN_FAILED';
    err.stdout = stdout;
    err.stderr = stderr;
    throw err;
  }

  if (!ok) {
    const err = new Error(
      `Trainer exited with status ${result.status}.\n` +
      (stderr ? `stderr:\n${stderr.slice(0, 2000)}` : '')
    );
    err.code = 'TRAINER_FAILED';
    err.exitCode = result.status;
    err.stdout = stdout;
    err.stderr = stderr;
    throw err;
  }

  return { ok: true, dryRun: false, stdout, stderr };
}

// ── knn / intent ─────────────────────────────────────────────────────────────

function trainClassic(projectRoot, model, opts) {
  const datasetDir = resolveDatasetDir(projectRoot, model, opts);
  const trainScript = opts.trainerScript
    ? path.resolve(projectRoot, opts.trainerScript)
    : resolveTrainScript(datasetDir);

  if (!trainScript) {
    // No train.mjs: build a gap report but still useful info
    return gapReport(
      model.id,
      model.kind,
      path.join(datasetDir, 'train.mjs'),
      `Create .planning/data-dungeon/${path.basename(datasetDir)}/train.mjs using the task-skill trainer as a template.`
    );
  }

  const invocation = { cmd: 'node', args: [trainScript], cwd: projectRoot };
  if (opts.dryRun) {
    return {
      ok: true,
      kind: model.kind,
      mode: 'classic-ml',
      dryRun: true,
      datasetDir,
      trainScript,
      invocation: `${invocation.cmd} ${trainScript}`,
      message: `[dry-run] Would run: node ${trainScript}`,
    };
  }

  const { stdout, stderr } = spawnTrainer(invocation.cmd, invocation.args, invocation.cwd, false);

  // Detect artifact
  const artifactPath = detectArtifact(datasetDir);

  return {
    ok: true,
    kind: model.kind,
    mode: 'classic-ml',
    dryRun: false,
    datasetDir,
    trainScript,
    artifactPath: artifactPath || path.join(datasetDir, 'models'),
    stdout,
    stderr,
  };
}

// ── llm ──────────────────────────────────────────────────────────────────────

function trainLlm(projectRoot, model, opts) {
  const slmRoot = slmLearningRoot(projectRoot);

  // Script resolution: explicit override → train_qlora.py → train_lora.py
  let script = null;
  if (opts.trainerScript) {
    script = path.resolve(projectRoot, opts.trainerScript);
    if (!fs.existsSync(script)) {
      return gapReport(
        model.id, 'llm', script,
        'Provide a valid --trainer-script path or create the script at the given location.'
      );
    }
  } else {
    const candidates = [
      path.join(slmRoot, 'scripts', 'train_qlora.py'),
      path.join(slmRoot, 'scripts', 'train_lora.py'),
      path.join(slmRoot, 'scripts', 'train.py'),
    ];
    script = candidates.find((p) => fs.existsSync(p)) || null;
  }

  if (!script) {
    return gapReport(
      model.id,
      'llm',
      path.join(slmRoot, 'scripts', 'train_qlora.py'),
      `Create ../slm_learning/scripts/train_qlora.py. ` +
      `Per project memory, use local laptop CUDA (TRL+PEFT/QLoRA). Do not wire Modal.`
    );
  }

  const args = ['--model-id', model.id];
  if (model.base) args.push('--base', model.base);

  if (opts.dryRun) {
    return {
      ok: true,
      kind: 'llm',
      mode: 'slm-learning',
      dryRun: true,
      trainerScript: script,
      invocation: `python ${script} ${args.join(' ')}`,
      message: `[dry-run] Would run: python ${script} ${args.join(' ')}`,
    };
  }

  const { stdout, stderr } = spawnTrainer('python', [script, ...args], projectRoot, false);

  // LLM artifacts conventionally land in slm_learning/outputs/ or similar
  const artifactPath = path.join(slmRoot, 'outputs', model.id);

  return {
    ok: true,
    kind: 'llm',
    mode: 'slm-learning',
    dryRun: false,
    trainerScript: script,
    artifactPath: fs.existsSync(artifactPath) ? artifactPath : null,
    stdout,
    stderr,
  };
}

// ── mid ───────────────────────────────────────────────────────────────────────

function trainMid(projectRoot, model, opts) {
  const slmRoot = slmLearningRoot(projectRoot);

  let script = null;
  if (opts.trainerScript) {
    script = path.resolve(projectRoot, opts.trainerScript);
    if (!fs.existsSync(script)) {
      return gapReport(
        model.id, 'mid', script,
        'Provide a valid --trainer-script path or create the script.'
      );
    }
  } else {
    const candidates = [
      path.join(slmRoot, 'src', 'trainers', `${model.id}.py`),
      path.join(slmRoot, 'src', 'trainers', 'mid_trainer.py'),
      path.join(slmRoot, 'scripts', `train_${model.id}.py`),
    ];
    script = candidates.find((p) => fs.existsSync(p)) || null;
  }

  if (!script) {
    return gapReport(
      model.id,
      'mid',
      path.join(slmRoot, 'src', 'trainers', 'mid_trainer.py'),
      `Create ../slm_learning/src/trainers/mid_trainer.py for mid-tier model "${model.id}".`
    );
  }

  const args = ['--model-id', model.id];

  if (opts.dryRun) {
    return {
      ok: true,
      kind: 'mid',
      mode: 'slm-learning',
      dryRun: true,
      trainerScript: script,
      invocation: `python ${script} ${args.join(' ')}`,
      message: `[dry-run] Would run: python ${script} ${args.join(' ')}`,
    };
  }

  const { stdout, stderr } = spawnTrainer('python', [script, ...args], projectRoot, false);

  const artifactPath = path.join(slmRoot, 'outputs', model.id);

  return {
    ok: true,
    kind: 'mid',
    mode: 'slm-learning',
    dryRun: false,
    trainerScript: script,
    artifactPath: fs.existsSync(artifactPath) ? artifactPath : null,
    stdout,
    stderr,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * trainModel(projectRoot, modelId, opts?) -> DispatchResult
 *
 * opts:
 *   dryRun         {boolean}  — describe, do not execute
 *   datasetId      {string}   — override dataset dir for knn/intent
 *   trainerScript  {string}   — override trainer script path (relative to projectRoot or absolute)
 *
 * On success (and not dryRun):
 *   - Writes .planning/models/<modelId>/train-meta.json
 *   - Updates registry: last_train_at, status='staging', artifact_path
 *   - Appends a line to .planning/models/training-runs.jsonl (decision gad-392)
 *
 * On gap (trainer script missing):
 *   Returns { ok: true, mode: 'gap', ... } — operator decides next step.
 *   Registry is NOT mutated on a gap.
 *
 * On failure (trainer exited non-zero):
 *   Throws with err.code = 'TRAINER_FAILED' | 'SPAWN_FAILED'.
 */
function trainModel(projectRoot, modelId, opts = {}) {
  const model = registry.getModel(projectRoot, modelId);
  if (!model) {
    const err = new Error(`Model not found in registry: ${modelId}`);
    err.code = 'NO_MODEL';
    throw err;
  }

  const dryRun = !!opts.dryRun;

  let dispatchResult;
  switch (model.kind) {
    case 'knn':
    case 'intent':
      dispatchResult = trainClassic(projectRoot, model, { ...opts, dryRun });
      break;
    case 'llm':
      dispatchResult = trainLlm(projectRoot, model, { ...opts, dryRun });
      break;
    case 'mid':
      dispatchResult = trainMid(projectRoot, model, { ...opts, dryRun });
      break;
    default:
      throw Object.assign(
        new Error(`Unknown model kind: "${model.kind}". Expected llm|mid|knn|intent.`),
        { code: 'UNKNOWN_KIND' }
      );
  }

  // Gap or dry-run: return early without registry mutation
  if (dispatchResult.mode === 'gap' || dryRun) {
    return { modelId, ...dispatchResult };
  }

  // ── Persist: train-meta.json, registry, training-runs.jsonl ──────────────

  const now = new Date().toISOString();
  const runId = `${modelId}-${Math.floor(Date.now() / 1000)}`;

  const meta = {
    run_id: runId,
    model_id: modelId,
    kind: model.kind,
    mode: dispatchResult.mode,
    trained_at: now,
    artifact_path: dispatchResult.artifactPath || null,
    trainer_script: dispatchResult.trainerScript || dispatchResult.trainScript || null,
    dataset_dir: dispatchResult.datasetDir || null,
    stdout_tail: (dispatchResult.stdout || '').slice(-2000),
    stderr_tail: (dispatchResult.stderr || '').slice(-500),
  };

  const metaPath = writeTrainMeta(projectRoot, modelId, meta);

  // Update registry: mark staging + artifact_path + last_train_at
  const registryEntry = registry.upsertModel(projectRoot, modelId, {
    last_train_at: now,
    status: 'staging',
    ...(dispatchResult.artifactPath ? { artifact_path: dispatchResult.artifactPath } : {}),
  });

  // Append to training-runs.jsonl (decision gad-392)
  const runEntry = {
    run_id: runId,
    model_id: modelId,
    kind: model.kind,
    status: 'completed',
    started_at: now,
    base_model: model.base || null,
    artifact_path: dispatchResult.artifactPath || null,
    mode: dispatchResult.mode,
  };
  try { appendTrainingRun(projectRoot, runEntry); } catch (_) {}

  return {
    ok: true,
    modelId,
    runId,
    metaPath,
    registryEntry,
    ...dispatchResult,
  };
}

module.exports = { trainModel };
