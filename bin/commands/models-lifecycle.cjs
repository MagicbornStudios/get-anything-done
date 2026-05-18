'use strict';
/**
 * gad models lifecycle — retraining pipeline CLI.
 *
 * Subcommands:
 *   status [--id X] [--json]      show registry (all or one model)
 *   trigger <id> [--force]        evaluate triggers; queue training if fired
 *   train <id> [--dry-run]        invoke trainer (stub — wired in 253-05)
 *   bench <id> [--bench-set X]    run bench harness; update ELO (stub — 253-06)
 *   promote <id>                  bench-gate check; swap active pointer
 *   archive <id>                  local archive (HF push wired in 253-08)
 *
 * Auto-discovered by bin/commands/_loader.cjs via exports.register().
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

// ---------------------------------------------------------------------------
// Helpers (lazy-bound to avoid circular requires at load time)
// ---------------------------------------------------------------------------

function reg(projectRoot) { return require('../../lib/models/registry.cjs'); }
function trig() { return require('../../lib/retraining/triggers.cjs'); }

function resolveProjectRoot(deps) {
  try { return deps.findRepoRoot(process.cwd()); } catch (_) { return process.cwd(); }
}

function resolveProjectId(deps, projectRoot) {
  try {
    const roots = deps.resolveRoots({ projectRoot });
    return roots.projectId || null;
  } catch (_) { return null; }
}

function shouldJson(args) {
  return !!(args && (args.json || args.j));
}

function printJson(data) { console.log(JSON.stringify(data, null, 2)); }

function printModel(m) {
  const latestElo = (m.bench_results && m.bench_results.length > 0)
    ? m.bench_results[m.bench_results.length - 1].elo
    : null;
  console.log(`  id:          ${m.id}`);
  console.log(`  kind:        ${m.kind}`);
  console.log(`  base:        ${m.base || '(none)'}`);
  console.log(`  precision:   ${m.precision}`);
  console.log(`  status:      ${m.status || 'staging'}`);
  console.log(`  last_train:  ${m.last_train_at || '(never)'}`);
  console.log(`  last_bench:  ${m.last_bench_at || '(never)'}`);
  console.log(`  elo:         ${latestElo !== null ? latestElo : '(none)'}`);
  console.log(`  adapters:    ${(m.adapters || []).join(', ') || '(none)'}`);
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function buildStatus(deps) {
  return defineCommand({
    meta: { name: 'status', description: 'Show model registry state' },
    args: {
      id: { type: 'string', description: 'Filter to a single model id', required: false },
      json: { type: 'boolean', alias: 'j', description: 'Output JSON', default: false },
    },
    run({ args }) {
      const projectRoot = resolveProjectRoot(deps);
      const models = reg(projectRoot).listModels(projectRoot, { id: args.id || undefined });
      if (shouldJson(args)) { printJson(models); return; }
      if (models.length === 0) {
        console.log('No models registered. Use `gad models lifecycle register` or upsert via lib/models/registry.cjs.');
        return;
      }
      for (const m of models) {
        console.log(`\n--- ${m.id} ---`);
        printModel(m);
      }
    },
  });
}

function buildTrigger(deps) {
  return defineCommand({
    meta: { name: 'trigger', description: 'Check trigger conditions for a model; queue training if fired' },
    args: {
      id: { type: 'positional', description: 'Model id', required: true },
      force: { type: 'boolean', description: 'Force trigger regardless of conditions', default: false },
      json: { type: 'boolean', alias: 'j', description: 'Output JSON', default: false },
    },
    run({ args }) {
      const projectRoot = resolveProjectRoot(deps);
      const result = trig().checkTriggers(projectRoot, args.id, { force: args.force });
      if (shouldJson(args)) { printJson(result); return; }

      console.log(`Model:       ${args.id}`);
      console.log(`shouldTrain: ${result.shouldTrain}`);
      if (result.reasons.length > 0) {
        console.log('Reasons:');
        for (const r of result.reasons) console.log(`  - ${r}`);
      } else {
        console.log('Reasons:     (none — thresholds not met)');
      }

      if (result.shouldTrain) {
        // Write a queue entry to .planning/models/train-queue.json
        const queuePath = path.join(projectRoot, '.planning', 'models', 'train-queue.json');
        let queue = [];
        if (fs.existsSync(queuePath)) {
          try { queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')); } catch (_) {}
        }
        // Skip if already queued
        const alreadyQueued = queue.some((e) => e.id === args.id && e.status === 'pending');
        if (!alreadyQueued) {
          queue.push({ id: args.id, queued_at: new Date().toISOString(), reasons: result.reasons, status: 'pending' });
          fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2) + '\n', 'utf8');
          console.log(`\nQueued training for: ${args.id}`);
        } else {
          console.log(`\nAlready queued: ${args.id}`);
        }
      }
    },
  });
}

function buildTrain(deps) {
  return defineCommand({
    meta: { name: 'train', description: 'Invoke trainer for a model (routes to slm-learning for LLM, local for kNN/intent)' },
    args: {
      id: { type: 'positional', description: 'Model id', required: true },
      'dry-run': { type: 'boolean', description: 'Print invocation without executing', default: false },
    },
    run({ args }) {
      const projectRoot = resolveProjectRoot(deps);
      const model = reg(projectRoot).getModel(projectRoot, args.id);
      if (!model) { console.error(`Model not found: ${args.id}`); process.exit(1); }

      const invocation = model.kind === 'llm'
        ? `slm_learning/scripts/train_qlora.py --model-id ${args.id}`
        : model.kind === 'mid'
          ? `slm_learning/src/trainers/mid_trainer.py --model-id ${args.id}`
          : `slm_learning/src/trainers/knn_trainer.py --model-id ${args.id}`;

      if (args['dry-run']) {
        console.log(`[dry-run] Would invoke: python ${invocation}`);
        console.log('Trainer dispatch wired in task 253-05.');
        return;
      }
      // 253-05: actual subprocess invocation — stub for now
      console.log(`Training stub for: ${args.id} (kind=${model.kind})`);
      console.log(`Would invoke: python ${invocation}`);
      console.log('Actual TRL+PEFT invocation wired in task 253-05.');
    },
  });
}

function buildBench(deps) {
  return defineCommand({
    meta: { name: 'bench', description: 'Run bench harness; update ELO in registry' },
    args: {
      id: { type: 'positional', description: 'Model id', required: true },
      'bench-set': { type: 'string', description: 'Bench set id (default: model default)', required: false },
    },
    run({ args }) {
      const projectRoot = resolveProjectRoot(deps);
      const model = reg(projectRoot).getModel(projectRoot, args.id);
      if (!model) { console.error(`Model not found: ${args.id}`); process.exit(1); }
      const set = args['bench-set'] || `${model.kind}-default`;
      console.log(`Bench stub for: ${args.id} (set=${set})`);
      console.log('Actual bench harness invocation wired in task 253-06 (phase 247 harness).');
    },
  });
}

function buildPromote(deps) {
  return defineCommand({
    meta: { name: 'promote', description: 'Bench-gate check; swap active pointer; archive previous' },
    args: {
      id: { type: 'positional', description: 'Model id', required: true },
      'min-elo-improvement': { type: 'string', description: 'Min ELO improvement over current active (default: from settings)', required: false },
      force: { type: 'boolean', description: 'Skip ELO gate and promote unconditionally', default: false },
      json: { type: 'boolean', alias: 'j', description: 'Output gate decision as JSON', default: false },
    },
    run({ args }) {
      const projectRoot = resolveProjectRoot(deps);
      const registry = reg(projectRoot);
      const candidate = registry.getModel(projectRoot, args.id);
      if (!candidate) { console.error(`Model not found: ${args.id}`); process.exit(1); }

      // Find current active of same kind
      const allModels = registry.listModels(projectRoot, { kind: candidate.kind });
      const current = allModels.find((m) => m.status === 'active' && m.id !== args.id);

      if (!args.force) {
        const { shouldPromote } = require('../../lib/models/bench-gate.cjs');
        const gateOpts = {};
        if (args['min-elo-improvement'] !== undefined && args['min-elo-improvement'] !== '') {
          const n = Number(args['min-elo-improvement']);
          if (Number.isFinite(n)) gateOpts.minImprovement = n;
        }
        const decision = shouldPromote(projectRoot, args.id, current ? current.id : null, gateOpts);

        if (shouldJson(args)) { printJson({ ...decision, action: decision.pass ? 'promoting' : 'blocked' }); }

        if (!decision.pass) {
          if (!shouldJson(args)) {
            console.error(`Bench gate FAILED: ${decision.reasons.join('; ')}`);
            if (decision.regressions.length > 0) {
              console.error('Regressions:');
              for (const r of decision.regressions) console.error(`  - ${r}`);
            }
            console.error('Use --force to override or run `gad models lifecycle bench` first.');
          }
          process.exit(1);
        }
        if (!shouldJson(args)) {
          console.log(`Bench gate PASSED: ${decision.reasons.join('; ')}`);
        }
      }

      const promoted = registry.promoteModel(projectRoot, args.id);
      if (!shouldJson(args)) {
        console.log(`Promoted: ${promoted.id} → status=active`);
        if (current) {
          console.log(`Previous active: ${current.id} → status=staging`);
        }
      }
    },
  });
}

function buildArchive(deps) {
  return defineCommand({
    meta: { name: 'archive', description: 'Archive a model to local dir (HF push wired in 253-08)' },
    args: {
      id: { type: 'positional', description: 'Model id', required: true },
    },
    run({ args }) {
      const projectRoot = resolveProjectRoot(deps);
      const registry = reg(projectRoot);
      const model = registry.getModel(projectRoot, args.id);
      if (!model) { console.error(`Model not found: ${args.id}`); process.exit(1); }

      // Check HF config
      let hfRepo = null;
      try {
        const { getSetting } = require('../../lib/settings-registry.cjs');
        hfRepo = getSetting('training.hf_archive_repo');
      } catch (_) {}

      if (hfRepo) {
        console.log(`HF archive stub: would push ${args.id} to ${hfRepo}`);
        console.log('Actual HF push wired in task 253-08.');
      } else {
        const archiveDir = path.join(projectRoot, '.planning', 'models', 'archive', args.id);
        fs.mkdirSync(archiveDir, { recursive: true });
        const metaPath = path.join(archiveDir, 'meta.json');
        fs.writeFileSync(metaPath, JSON.stringify({ ...model, archived_at: new Date().toISOString() }, null, 2) + '\n', 'utf8');
        console.log(`Archived locally: ${metaPath}`);
      }

      registry.archiveModel(projectRoot, args.id);
      console.log(`Registry updated: ${args.id} → status=archived`);
    },
  });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

function createModelsLifecycleCommand(deps) {
  const status = buildStatus(deps);
  const trigger = buildTrigger(deps);
  const train = buildTrain(deps);
  const bench = buildBench(deps);
  const promote = buildPromote(deps);
  const archive = buildArchive(deps);

  return defineCommand({
    meta: { name: 'lifecycle', description: 'Retraining pipeline: status / trigger / train / bench / promote / archive' },
    subCommands: { status, trigger, train, bench, promote, archive },
  });
}

module.exports = { createModelsLifecycleCommand };

// dependsOn ensures models.cjs runs its register() before postWire fires.
module.exports.dependsOn = ['models'];

// register() returns nothing — lifecycle is injected into models.subCommands via postWire.
module.exports.register = (_ctx) => ({});

module.exports.postWire = ({ subCommands, common }) => {
  const deps = common || {};
  const lifecycle = createModelsLifecycleCommand(deps);
  // Attach 'lifecycle' as a subcommand of 'models'
  if (subCommands && subCommands.models && subCommands.models.subCommands) {
    subCommands.models.subCommands.lifecycle = lifecycle;
  }
};
