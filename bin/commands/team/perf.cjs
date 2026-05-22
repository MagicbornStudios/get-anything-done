'use strict';
/**
 * gad team perf - aggregate worker throughput and token usage since a timestamp.
 */

const path = require('path');
const { defineCommand } = require('citty');
const { summarizeTeamPerf } = require('../../../lib/team/perf.cjs');

function createPerfCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid, outputError } = deps;

  function resolveTeamBaseDir(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return { baseDir: repoRoot, projectid: pidArg || null };
    return {
      baseDir: path.join(repoRoot, root.path),
      projectid: pidArg || root.projectid || null,
    };
  }

  return defineCommand({
    meta: { name: 'perf', description: 'Summarize per-worker handoff throughput and token usage since an ISO timestamp.' },
    args: {
      projectid: { type: 'string', description: 'Target project id (resolves .planning/team/ path)', default: '' },
      since: { type: 'string', required: true, description: 'Only include entries at/after this ISO timestamp.' },
      json: { type: 'boolean', default: false },
    },
    run({ args }) {
      const since = String(args.since || '').trim();
      if (!since || Number.isNaN(Date.parse(since))) {
        outputError('--since must be a valid ISO timestamp');
        process.exit(1);
      }

      const { baseDir, projectid } = resolveTeamBaseDir(args);
      const report = summarizeTeamPerf({ baseDir, since, projectid });
      console.log(JSON.stringify(report, null, args.json ? 2 : 2));
    },
  });
}

module.exports = { createPerfCommand };
