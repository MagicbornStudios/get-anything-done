'use strict';
/**
 * gad models lifecycle — retraining pipeline CLI.
 *
 * Subcommands:
 *   list [--kind X] [--json]      registry view incl. adapters + checkpoints (248-07)
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

function buildList(deps) {
  return defineCommand({
    meta: {
      name: 'list',
      description: 'Registry view: id, kind, status, ELO, adapters, checkpoints (248-07)',
    },
    args: {
      kind: { type: 'string', description: 'Filter by kind (llm|mid|knn|intent)', required: false },
      status: { type: 'string', description: 'Filter by status (active|staging|archived)', required: false },
      json: { type: 'boolean', alias: 'j', description: 'Output JSON', default: false },
    },
    run({ args }) {
      const projectRoot = resolveProjectRoot(deps);
      const registry = reg(projectRoot);
      let models = registry.listModels(projectRoot, { kind: args.kind || undefined });
      if (args.status) models = models.filter((m) => (m.status || 'staging') === args.status);

      if (shouldJson(args)) {
        // Project adapter + checkpoint fields so JSON consumers don't have to
        // poke through bench_results to find ELO.
        const projected = models.map((m) => {
          const latest = (m.bench_results && m.bench_results.length > 0)
            ? m.bench_results[m.bench_results.length - 1]
            : null;
          return {
            id: m.id,
            kind: m.kind,
            base: m.base || null,
            precision: m.precision,
            status: m.status || 'staging',
            adapters: Array.isArray(m.adapters) ? m.adapters : [],
            checkpoints: Array.isArray(m.checkpoints) ? m.checkpoints : [],
            artifact_path: m.artifact_path || null,
            latest_elo: latest ? latest.elo : null,
            latest_bench_set: latest ? latest.set : null,
            last_train_at: m.last_train_at || null,
            last_bench_at: m.last_bench_at || null,
            promoted_at: m.promoted_at || null,
            archived_at: m.archived_at || null,
          };
        });
        printJson(projected);
        return;
      }

      if (models.length === 0) {
        console.log('No models registered.');
        console.log('Filter applied:'
          + (args.kind ? ` kind=${args.kind}` : '')
          + (args.status ? ` status=${args.status}` : '')
          + (!args.kind && !args.status ? ' (none)' : ''));
        return;
      }

      // Compact tabular view: 1 line per model, adapters/checkpoints listed indented.
      const pad = (s, n) => String(s == null ? '' : s).padEnd(n).slice(0, n);
      console.log(`${pad('ID', 28)} ${pad('KIND', 6)} ${pad('STATUS', 9)} ${pad('ELO', 6)} ${pad('LAST_BENCH', 20)}`);
      console.log('-'.repeat(28 + 1 + 6 + 1 + 9 + 1 + 6 + 1 + 20));
      for (const m of models) {
        const latest = (m.bench_results && m.bench_results.length > 0)
          ? m.bench_results[m.bench_results.length - 1]
          : null;
        const elo = latest ? String(latest.elo) : '-';
        const last = m.last_bench_at || '-';
        console.log(`${pad(m.id, 28)} ${pad(m.kind, 6)} ${pad(m.status || 'staging', 9)} ${pad(elo, 6)} ${pad(last, 20)}`);
        const adapters = Array.isArray(m.adapters) ? m.adapters : [];
        const checkpoints = Array.isArray(m.checkpoints) ? m.checkpoints : [];
        if (adapters.length > 0) {
          console.log(`    adapters:    ${adapters.join(', ')}`);
        }
        if (checkpoints.length > 0) {
          console.log(`    checkpoints: ${checkpoints.join(', ')}`);
        }
        if (m.artifact_path) {
          console.log(`    artifact:    ${m.artifact_path}`);
        }
      }
    },
  });
}

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
      'dry-run': { type: 'boolean', description: 'Resolve set+contestant; skip actual run', default: false },
      json: { type: 'boolean', alias: 'j', description: 'Output JSON', default: false },
    },
    async run({ args }) {
      const projectRoot = resolveProjectRoot(deps);
      const { runBenchForModel } = require('../../lib/retraining/bench-runner.cjs');

      let result;
      try {
        result = await runBenchForModel(projectRoot, args.id, {
          set: args['bench-set'] || undefined,
          dryRun: !!args['dry-run'],
        });
      } catch (err) {
        if (shouldJson(args)) {
          printJson({ ok: false, code: err.code || 'BENCH_FAILED', error: err.message });
        } else {
          console.error(`Bench failed: ${err.message}`);
        }
        process.exit(1);
      }

      if (shouldJson(args)) { printJson(result); return; }

      if (result.dryRun) {
        console.log(`[dry-run] Would bench ${args.id} on set=${result.set} (problems=${result.problems}, contestant=${result.contestantId})`);
        return;
      }
      console.log(`Bench complete: ${args.id}`);
      console.log(`  set:           ${result.set}`);
      console.log(`  contestant:    ${result.contestantId}`);
      console.log(`  pass:          ${result.passCount}/${result.problems} (rate=${(result.passRate * 100).toFixed(1)}%)`);
      console.log(`  elo:           ${result.elo}`);
      console.log(`  result file:   ${result.writtenPath}`);
      console.log(`  registry:      ${args.id}.bench_results appended`);
    },
  });
}

function emitArchiveEvent(projectRoot, displacedId, promotedId, reasons) {
  // Append a JSON-line event for the archive watcher (desk-hook hf-archive-tick.mjs
  // already polls .planning/models/ events). Best-effort — never fails promote.
  try {
    const dir = path.join(projectRoot, '.planning', 'models');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const eventsPath = path.join(dir, 'archive-events.jsonl');
    const entry = {
      ts: new Date().toISOString(),
      type: 'displaced_by_promote',
      displaced_id: displacedId,
      promoted_id: promotedId,
      reasons: Array.isArray(reasons) ? reasons : [],
      status: 'pending',
    };
    fs.appendFileSync(eventsPath, JSON.stringify(entry) + '\n', 'utf8');
    return { ok: true, path: eventsPath, event: entry };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function buildPromote(deps) {
  return defineCommand({
    meta: { name: 'promote', description: 'Bench-gate check; swap active pointer; emit archive event for displaced model' },
    args: {
      id: { type: 'positional', description: 'Model id', required: true },
      'min-elo-improvement': { type: 'string', description: 'Min ELO improvement over current active (default: from settings)', required: false },
      force: { type: 'boolean', description: 'Skip ELO gate and promote unconditionally', default: false },
      'archive-displaced': { type: 'boolean', description: 'Inline call to archive subcommand for the displaced model', default: false },
      'skip-event': { type: 'boolean', description: 'Skip writing archive-events.jsonl entry for displaced model', default: false },
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

      let decision = null;
      if (!args.force) {
        const { shouldPromote } = require('../../lib/retraining/gate.cjs');
        const gateOpts = {};
        if (args['min-elo-improvement'] !== undefined && args['min-elo-improvement'] !== '') {
          const n = Number(args['min-elo-improvement']);
          if (Number.isFinite(n)) gateOpts.minImprovement = n;
        }
        decision = shouldPromote(projectRoot, args.id, current ? current.id : null, gateOpts);

        if (!decision.pass) {
          if (shouldJson(args)) {
            printJson({ ...decision, action: 'blocked' });
          } else {
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

      // Emit archive event for displaced model (default behavior; suppressed with --skip-event).
      let archiveEvent = null;
      if (current && !args['skip-event']) {
        archiveEvent = emitArchiveEvent(
          projectRoot,
          current.id,
          promoted.id,
          decision ? decision.reasons : ['force-promoted']
        );
      }

      // Optional inline archive (sync passthrough to archive subcommand logic).
      let archiveResult = null;
      if (current && args['archive-displaced']) {
        try {
          const { archiveModel: runArchive } = require('../../lib/retraining/archiver.cjs');
          archiveResult = runArchive(projectRoot, current.id, { forceLocal: true });
          registry.archiveModel(projectRoot, current.id);
        } catch (err) {
          archiveResult = { ok: false, error: err.message };
        }
      }

      if (shouldJson(args)) {
        printJson({
          ok: true,
          action: 'promoted',
          promoted_id: promoted.id,
          displaced_id: current ? current.id : null,
          decision: decision || { pass: true, reasons: ['force'] },
          archive_event: archiveEvent,
          archive_result: archiveResult,
        });
        return;
      }

      console.log(`Promoted: ${promoted.id} → status=active`);
      if (current) {
        console.log(`Previous active: ${current.id} → status=staging`);
        if (archiveEvent && archiveEvent.ok) {
          console.log(`Archive event emitted: ${archiveEvent.path}`);
        }
        if (archiveResult && archiveResult.mode) {
          console.log(`Archived inline (${archiveResult.mode}): ${archiveResult.metaPath || archiveResult.repoUrl}`);
        }
      }
    },
  });
}

function buildArchive(deps) {
  return defineCommand({
    meta: { name: 'archive', description: 'Archive a model: push to HF (if configured) or save locally' },
    args: {
      id: { type: 'positional', description: 'Model id', required: true },
      repo: { type: 'string', description: 'HF repo slug (e.g. owner/repo); overrides training.hf_archive_repo', required: false },
      'token-env': { type: 'string', description: 'Env var holding HF token (default: HF_TOKEN)', required: false },
      'commit-message': { type: 'string', description: 'HF commit message', required: false },
      'force-local': { type: 'boolean', description: 'Skip HF; archive locally only', default: false },
      'no-private': { type: 'boolean', description: 'Create HF repo as public (default: private)', default: false },
      'dry-run': { type: 'boolean', description: 'Describe the action without executing', default: false },
      json: { type: 'boolean', alias: 'j', description: 'Output JSON', default: false },
    },
    run({ args }) {
      const projectRoot = resolveProjectRoot(deps);
      const registry = reg(projectRoot);
      const model = registry.getModel(projectRoot, args.id);
      if (!model) {
        if (shouldJson(args)) { printJson({ ok: false, code: 'NO_MODEL', error: `model not found: ${args.id}` }); }
        else { console.error(`Model not found: ${args.id}`); }
        process.exit(1);
      }

      const { archiveModel: runArchive } = require('../../lib/retraining/archiver.cjs');
      let result;
      try {
        result = runArchive(projectRoot, args.id, {
          repo: args.repo || undefined,
          tokenEnv: args['token-env'] || undefined,
          commitMsg: args['commit-message'] || undefined,
          dryRun: !!args['dry-run'],
          private: !args['no-private'],
          forceLocal: !!args['force-local'],
        });
      } catch (err) {
        // HF push errors: fall back to local archive (best-effort) unless this
        // was a dry-run. NO_MODEL is unreachable here (we just checked).
        const fatalCodes = new Set(['NO_TOKEN', 'NO_REPO', 'NO_ARTIFACT', 'CLI_MISSING', 'CLI_FAILED']);
        if (fatalCodes.has(err.code) && !args['dry-run']) {
          if (shouldJson(args)) {
            printJson({
              ok: false,
              code: err.code,
              error: err.message,
              fallback: 'local',
            });
          } else {
            console.error(`HF archive failed (${err.code}): ${err.message}`);
            console.error('Falling back to local archive…');
          }
          try {
            result = runArchive(projectRoot, args.id, { forceLocal: true });
          } catch (err2) {
            if (shouldJson(args)) { printJson({ ok: false, code: err2.code || 'ARCHIVE_FAILED', error: err2.message }); }
            else { console.error(`Local archive also failed: ${err2.message}`); }
            process.exit(1);
          }
        } else {
          if (shouldJson(args)) { printJson({ ok: false, code: err.code || 'ARCHIVE_FAILED', error: err.message }); }
          else { console.error(`Archive failed: ${err.message}`); }
          process.exit(1);
        }
      }

      // Flip registry status to archived (skip on dry-run).
      if (!args['dry-run']) {
        registry.archiveModel(projectRoot, args.id);
      }

      if (shouldJson(args)) {
        printJson({ ok: true, id: args.id, ...result, registry_status: args['dry-run'] ? model.status : 'archived' });
        return;
      }

      if (result.mode === 'hf') {
        if (result.dryRun) {
          console.log(`[dry-run] Would push ${args.id} → ${result.repo} (${result.private ? 'private' : 'public'})`);
          console.log(`[dry-run] artifact: ${result.artifactPath}`);
          console.log(`[dry-run] huggingface-cli ${result.cliArgs.join(' ')}`);
        } else {
          console.log(`Pushed to HF: ${result.repoUrl} (path: ${result.pathInRepo})`);
          if (result.commitSha) console.log(`Commit sha: ${result.commitSha}`);
          if (result.output) console.log(result.output);
        }
      } else {
        if (result.dryRun) {
          console.log(`[dry-run] Would write meta to: ${result.metaPath}`);
        } else {
          console.log(`Archived locally: ${result.metaPath}`);
        }
      }

      if (!args['dry-run']) {
        console.log(`Registry updated: ${args.id} → status=archived`);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

function createModelsLifecycleCommand(deps) {
  const list = buildList(deps);
  const status = buildStatus(deps);
  const trigger = buildTrigger(deps);
  const train = buildTrain(deps);
  const bench = buildBench(deps);
  const promote = buildPromote(deps);
  const archive = buildArchive(deps);

  return defineCommand({
    meta: { name: 'lifecycle', description: 'Retraining pipeline: list / status / trigger / train / bench / promote / archive' },
    subCommands: { list, status, trigger, train, bench, promote, archive },
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
