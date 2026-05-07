'use strict';

const { defineCommand } = require('citty');
const { getRuntimeArg } = require('../../../lib/runtime-args.cjs');
const { runRuntimeScriptJson } = require('../../../lib/runtime-substrate-scripts.cjs');
const {
  runBatchPreflight,
  RUNTIME_IDS,
} = require('../../../lib/runtime-health/index.cjs');

// Parse comma-separated runtime ids from CLI args
function resolveRuntimeIds(args) {
  if (args.runtime) return [String(args.runtime).trim()];
  if (args.runtimes) return String(args.runtimes).split(',').map((s) => s.trim()).filter(Boolean);
  return RUNTIME_IDS;
}

function createRuntimeCheckCommand({ resolveGadRuntimeContext, output, outputError, shouldUseJson }) {
  return defineCommand({
    meta: { name: 'check', description: 'Run runtime health checks — install/auth/json-contract preflight for each runtime.' },
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
        const timeoutMs = Number(getRuntimeArg(args, 'timeout-ms', '60000')) || 60000;
        const noSave = Boolean(getRuntimeArg(args, 'no-save', false));

        // Run preflight via lib/runtime-health (install/auth/json_contract per spec)
        const runtimeIds = resolveRuntimeIds(args);
        const preflight = runBatchPreflight(runtimeIds, {
          timeoutMs: Math.min(timeoutMs, 30000),
          repoRoot: context.runtimeRepoRoot,
        });

        // Also run substrate script for richer data (version, headless, etc.) when available
        let substrateRuntimes = null;
        try {
          const scriptArgs = ['--project-id', context.projectId, '--json'];
          runtimeIds.forEach((r) => { /* passed via --runtimes below */ });
          if (args.runtime) scriptArgs.push('--runtime', String(args.runtime));
          if (args.runtimes) scriptArgs.push('--runtimes', String(args.runtimes));
          if (args.smoke) scriptArgs.push('--smoke');
          scriptArgs.push('--timeout-ms', String(timeoutMs));
          if (noSave) scriptArgs.push('--no-save');
          const substratePayload = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-check.mjs', scriptArgs);
          substrateRuntimes = substratePayload.runtimes || null;
        } catch {
          // substrate not available — preflight-only mode
        }

        // Merge: lib preflight shape + substrate enrichment.
        // For auth: substrate's authConfigured (which handles browser login, oauth, etc.) takes
        // precedence over lib env-key check since substrate probes more auth modes.
        const mergedRuntimes = preflight.map((p) => {
          const sub = substrateRuntimes
            ? substrateRuntimes.find((s) => s.runtime === p.runtime)
            : null;
          // If substrate says auth is configured, trust it even if lib env-key check said missing
          const authStatus = sub && sub.authConfigured ? 'ok' : p.auth;
          return {
            runtime: p.runtime,
            install: p.install,
            auth: authStatus,
            json_contract: p.json_contract,
            version: p.version || sub?.version || null,
            path: p.path || sub?.executablePath || null,
            notes: p.notes,
            // substrate extras (if available)
            ...(sub ? {
              supportsHeadless: sub.supportsHeadless,
              supportsJsonOutput: sub.supportsJsonOutput,
              authConfigured: sub.authConfigured,
            } : {}),
          };
        });

        const payload = {
          checkedAt: new Date().toISOString(),
          saved: !noSave,
          runtimes: mergedRuntimes,
          gadContext: {
            projectId: context.projectId,
            sessionId: context.sessionId,
            sessionResolved: context.sessionResolved,
            handoffArtifacts: context.handoffArtifacts,
            contextProvenance: context.contextProvenance,
          },
        };

        if (args.json || shouldUseJson()) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }

        console.log(`Runtime check complete for project=${context.projectId} session=${context.sessionId || 'none'}`);
        const rows = mergedRuntimes.map((entry) => ({
          runtime: entry.runtime,
          install: entry.install,
          auth: entry.auth,
          json_contract: entry.json_contract,
          version: entry.version || 'n/a',
        }));
        output(rows, { title: 'Runtime health (install/auth/json_contract)', format: 'table' });
      } catch (err) {
        outputError(err.message);
      }
    },
  });
}

module.exports = { createRuntimeCheckCommand };
