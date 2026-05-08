'use strict';
/**
 * gad sync — cross-repo planning data engine + cloud sync (Phase 132).
 *
 * Subcommands:
 *   gad sync push   [--projectid X] [--all-projects] [--dry-run]
 *   gad sync pull   [--projectid X] [--instance Y] [--mode merge|overwrite] [--dry-run]
 *   gad sync status [--projectid X] [--json]
 *   gad sync list-instances [--projectid X] [--json]
 *
 * Loaded automatically by bin/commands/_loader.cjs via module.exports.register.
 *
 * Required deps (from ctx.common):
 *   findRepoRoot, gadConfig, resolveRoots, outputError, render, shouldUseJson
 *
 * Supabase env vars:
 *   SUPABASE_URL              — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (not anon key; needed for storage writes)
 *
 * instanceId defaults to hostname. Override via $GAD_SYNC_INSTANCE_ID.
 */

const path = require('path');
const os = require('os');
const { defineCommand } = require('citty');

const { collectPlanningData, applyPlanningData, syncFingerprint } = require('../../lib/sync/index.cjs');

// Lazy-load backends so missing env vars produce a clear error, not a crash.
function requireSupabaseBackend() {
  return require('../../lib/sync/supabase-backend.cjs');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive the instance id for this machine:
 *   1. $GAD_SYNC_INSTANCE_ID (explicit override)
 *   2. os.hostname()
 */
function getInstanceId() {
  return process.env.GAD_SYNC_INSTANCE_ID || os.hostname();
}

/**
 * Return the local status file path where we record last-push/pull info.
 * Stored per-project under .planning/.gad-sync-status.json.
 */
function statusFilePath(projectRoot, planningDir) {
  return path.join(projectRoot, planningDir, '.gad-sync-status.json');
}

function loadLocalStatus(projectRoot, planningDir) {
  const fp = statusFilePath(projectRoot, planningDir);
  try {
    const raw = require('fs').readFileSync(fp, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return { lastPush: null, lastPull: null, lastFingerprint: null };
  }
}

function saveLocalStatus(projectRoot, planningDir, status) {
  const fp = statusFilePath(projectRoot, planningDir);
  require('fs').writeFileSync(fp, JSON.stringify(status, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// createSyncCommand factory
// ---------------------------------------------------------------------------

function createSyncCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError } = deps;

  /**
   * Resolve one or more roots given CLI args.
   * Returns array of { root, projectRoot, planningDir }.
   */
  function resolveTargets(args) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    let roots;
    if (args['all-projects']) {
      roots = resolveRoots({}, baseDir, config.roots);
    } else {
      roots = resolveRoots({ projectid: args.projectid || '' }, baseDir, config.roots);
    }
    if (!Array.isArray(roots) || roots.length === 0) {
      return [];
    }
    return roots.map((root) => ({
      root,
      projectRoot: path.resolve(baseDir, root.path || '.'),
      planningDir: root.planningDir || '.planning',
    }));
  }

  // ─── push ────────────────────────────────────────────────────────────────

  const pushCmd = defineCommand({
    meta: { name: 'push', description: 'Push local planning data to Supabase cloud sync.' },
    args: {
      projectid: { type: 'string', description: 'Project id to push', default: '' },
      'all-projects': { type: 'boolean', description: 'Push all configured projects', default: false },
      'dry-run': { type: 'boolean', description: 'Print payload size + fingerprint without uploading', default: false },
    },
    async run({ args }) {
      const targets = resolveTargets(args);
      if (targets.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or --all-projects.');
        process.exit(1);
        return;
      }

      let backend;
      if (!args['dry-run']) {
        try {
          backend = requireSupabaseBackend();
          // Trigger credential resolution early for clear error
          require('../../lib/supabase-client.cjs').getSupabaseClient();
        } catch (e) {
          outputError(`Supabase credentials error: ${e.message}\nSet SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in your shell or .env file.`);
          process.exit(1);
          return;
        }
      }

      const instanceId = getInstanceId();

      for (const { root, projectRoot, planningDir } of targets) {
        const projectId = root.id;
        console.log(`\n[${projectId}] Collecting planning data from ${projectRoot} ...`);
        const payload = collectPlanningData({ projectRoot, planningDir, projectId });
        const fingerprint = syncFingerprint(payload);
        const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');

        console.log(`  decisions:  ${payload.decisions.length}`);
        console.log(`  state_log:  ${payload.state_log.length}`);
        console.log(`  handoffs:   open=${payload.handoffs.open.length} claimed=${payload.handoffs.claimed.length} closed=${payload.handoffs.closed.length}`);
        console.log(`  gad_log:    ${payload.gad_log.length}`);
        console.log(`  size:       ${(bytes / 1024).toFixed(1)} KB`);
        console.log(`  fingerprint: ${fingerprint}`);

        if (args['dry-run']) {
          console.log(`  [dry-run] Skipping upload.`);
          continue;
        }

        console.log(`  Pushing to Supabase (instance=${instanceId}) ...`);
        const result = await backend.pushPayload({ payload, projectId, instanceId });

        if (!result.ok) {
          console.error(`  [ERROR] Push failed: ${result.error}`);
          continue;
        }
        if (result.indexWarning) {
          console.warn(`  [WARN] ${result.indexWarning}`);
        }
        console.log(`  Uploaded: ${result.key} (${result.bytes} bytes)`);

        // Update local status
        const status = loadLocalStatus(projectRoot, planningDir);
        status.lastPush = new Date().toISOString();
        status.lastFingerprint = fingerprint;
        status.instanceId = instanceId;
        saveLocalStatus(projectRoot, planningDir, status);
        console.log(`  Local status updated.`);
      }
    },
  });

  // ─── pull ────────────────────────────────────────────────────────────────

  const pullCmd = defineCommand({
    meta: { name: 'pull', description: 'Pull planning data from Supabase and apply to local disk.' },
    args: {
      projectid: { type: 'string', description: 'Project id to pull', default: '' },
      instance: { type: 'string', description: 'Pull from a specific instance id', default: '' },
      mode: { type: 'string', description: '"merge" (default) or "overwrite"', default: 'merge' },
      'dry-run': { type: 'boolean', description: 'Print what would be applied without writing', default: false },
    },
    async run({ args }) {
      const targets = resolveTargets(args);
      if (targets.length === 0) {
        outputError('No project resolved. Pass --projectid <id>.');
        process.exit(1);
        return;
      }

      const mode = args.mode || 'merge';
      if (!['merge', 'overwrite'].includes(mode)) {
        outputError(`Invalid --mode "${mode}". Use "merge" or "overwrite".`);
        process.exit(1);
        return;
      }

      let backend;
      try {
        backend = requireSupabaseBackend();
        require('../../lib/supabase-client.cjs').getSupabaseClient();
      } catch (e) {
        outputError(`Supabase credentials error: ${e.message}\nSet SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in your shell or .env file.`);
        process.exit(1);
        return;
      }

      for (const { root, projectRoot, planningDir } of targets) {
        const projectId = root.id;
        const instanceId = args.instance || undefined;
        console.log(`\n[${projectId}] Pulling from Supabase${instanceId ? ` (instance=${instanceId})` : ''} ...`);

        const result = await backend.pullPayload({ projectId, instanceId });

        if (!result.ok) {
          console.error(`  [ERROR] Pull failed: ${result.error}`);
          continue;
        }

        const { payload, key, fingerprint, pushedAt } = result;
        const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
        console.log(`  Key:        ${key}`);
        console.log(`  Pushed at:  ${pushedAt}`);
        console.log(`  Fingerprint: ${fingerprint}`);
        console.log(`  Size:       ${(bytes / 1024).toFixed(1)} KB`);

        if (args['dry-run']) {
          console.log(`  [dry-run] Skipping apply (mode=${mode}).`);
          continue;
        }

        console.log(`  Applying (mode=${mode}) ...`);
        const applied = applyPlanningData({ projectRoot, planningDir, payload, mode });
        console.log(`  Applied: decisions=${applied.decisions} state_log=${applied.state_log} handoffs=${applied.handoffs} gad_log=${applied.gad_log}`);

        // Update local status
        const status = loadLocalStatus(projectRoot, planningDir);
        status.lastPull = new Date().toISOString();
        status.lastFingerprint = fingerprint;
        saveLocalStatus(projectRoot, planningDir, status);
        console.log(`  Local status updated.`);
      }
    },
  });

  // ─── status ──────────────────────────────────────────────────────────────

  const statusCmd = defineCommand({
    meta: { name: 'status', description: 'Show last push/pull timestamps and fingerprint for a project.' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const targets = resolveTargets(args);
      if (targets.length === 0) {
        outputError('No project resolved. Pass --projectid <id>.');
        process.exit(1);
        return;
      }

      const rows = targets.map(({ root, projectRoot, planningDir }) => {
        const status = loadLocalStatus(projectRoot, planningDir);
        return {
          projectId: root.id,
          instanceId: status.instanceId || getInstanceId(),
          lastPush: status.lastPush || null,
          lastPull: status.lastPull || null,
          lastFingerprint: status.lastFingerprint || null,
        };
      });

      if (args.json) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }

      for (const r of rows) {
        console.log(`\n[${r.projectId}]`);
        console.log(`  instance:    ${r.instanceId}`);
        console.log(`  last push:   ${r.lastPush || '(never pushed)'}`);
        console.log(`  last pull:   ${r.lastPull || '(never pulled)'}`);
        console.log(`  fingerprint: ${r.lastFingerprint || '(none)'}`);
      }
    },
  });

  // ─── list-instances ───────────────────────────────────────────────────────

  const listInstancesCmd = defineCommand({
    meta: { name: 'list-instances', description: 'List all instance IDs that have synced planning data for a project.' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const targets = resolveTargets(args);
      if (targets.length === 0) {
        outputError('No project resolved. Pass --projectid <id>.');
        process.exit(1);
        return;
      }

      let backend;
      try {
        backend = requireSupabaseBackend();
        require('../../lib/supabase-client.cjs').getSupabaseClient();
      } catch (e) {
        outputError(`Supabase credentials error: ${e.message}\nSet SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in your shell or .env file.`);
        process.exit(1);
        return;
      }

      for (const { root } of targets) {
        const projectId = root.id;
        console.log(`\n[${projectId}] Fetching instances ...`);

        let instances;
        try {
          instances = await backend.listInstances({ projectId });
        } catch (e) {
          console.error(`  [ERROR] ${e.message}`);
          continue;
        }

        if (args.json) {
          console.log(JSON.stringify({ projectId, instances }, null, 2));
          continue;
        }

        if (instances.length === 0) {
          console.log('  (no instances have synced yet)');
        } else {
          console.log(`  ${instances.length} instance(s):`);
          for (const id of instances) {
            console.log(`    - ${id}`);
          }
        }
      }
    },
  });

  // ─── root command ─────────────────────────────────────────────────────────

  return defineCommand({
    meta: {
      name: 'sync',
      description: 'Cross-repo planning data engine — push/pull planning data via Supabase cloud sync.',
    },
    subCommands: {
      push: pushCmd,
      pull: pullCmd,
      status: statusCmd,
      'list-instances': listInstancesCmd,
    },
  });
}

// ---------------------------------------------------------------------------
// Loader contract
// ---------------------------------------------------------------------------

module.exports = { createSyncCommand };
module.exports.register = (ctx) => ({ sync: createSyncCommand(ctx.common) });
