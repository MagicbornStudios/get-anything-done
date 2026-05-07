'use strict';
/**
 * gad team-health — worker + dispatcher liveness check (Phase 156).
 *
 * Read-only diagnostic. Pairs with the existing `gad team` family but
 * doesn't restart anything by default; --restart-stalled flag added
 * later when auto-restart logic lives behind a feature flag.
 */

const path = require('node:path');
const { defineCommand } = require('citty');
const { checkProject } = require('../../lib/team/health.cjs');

function resolveProjectInfo(deps) {
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);
  const projects = (config.roots || []).map((r) => ({
    projectId: r.id,
    rootPath: path.resolve(baseDir, r.path || '.'),
    planningDir: r.planningDir || '.planning',
  }));
  return { baseDir, projects };
}

function colorVerdict(v) {
  switch (v) {
    case 'healthy': return `\x1b[32m${v}\x1b[0m`;
    case 'stalled': return `\x1b[1;91m${v}\x1b[0m`;
    case 'rate_limited': return `\x1b[1;33m${v}\x1b[0m`;
    case 'not_started': return `\x1b[2;37m${v}\x1b[0m`;
    case 'missing': return `\x1b[2;37m${v}\x1b[0m`;
    case 'down': return `\x1b[1;91m${v}\x1b[0m`;
    default: return v;
  }
}

function createTeamHealthCommand(deps) {
  return defineCommand({
    meta: {
      name: 'team-health',
      description: 'Health check for team workers + dispatcher across project(s). Phase 156 — alarm-on-stall, the load-bearing pre-condition for the autonomous loop.',
    },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      'stall-seconds': { type: 'string', description: 'Worker stall threshold', default: '120' },
      'dispatcher-stall-seconds': { type: 'string', description: 'Dispatcher stall threshold', default: '180' },
      json: { type: 'boolean', description: 'JSON output', default: false },
      'only-bad': { type: 'boolean', description: 'Only print non-healthy entries', default: false },
    },
    run({ args }) {
      const { projects } = resolveProjectInfo(deps);
      const targets = args.projectid
        ? projects.filter((p) => p.projectId === args.projectid)
        : projects;
      const stallSeconds = parseInt(args['stall-seconds'], 10) || 120;
      const dispatcherStallSeconds = parseInt(args['dispatcher-stall-seconds'], 10) || 180;

      const results = [];
      for (const project of targets) {
        const planningDir = path.join(project.rootPath, project.planningDir);
        const report = checkProject({ planningDir, stallSeconds, dispatcherStallSeconds });
        if (report.workers.length === 0 && (!report.dispatcher || !report.dispatcher.last_heartbeat)) continue;
        results.push({ project: project.projectId, ...report });
      }

      if (args.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      let totalStalled = 0;
      for (const r of results) {
        const dv = r.dispatcher.health ? r.dispatcher.health.verdict : 'missing';
        const summaryLine = `[${r.project}]  workers=${r.summary.worker_count}  ` +
          `healthy=${r.summary.healthy}  stalled=${r.summary.stalled}  ` +
          `rate_limited=${r.summary.rate_limited}  not_started=${r.summary.not_started}  ` +
          `dispatcher=${colorVerdict(dv)}`;
        const hasIssue = r.summary.stalled > 0 || r.summary.missing > 0 || dv !== 'healthy';
        if (args['only-bad'] && !hasIssue) continue;
        console.log(summaryLine);
        for (const w of r.workers) {
          if (args['only-bad'] && w.health.verdict === 'healthy') continue;
          const stateStr = w.status ? `state=${w.status.state}` : 'no-status';
          const ageStr = w.health.age_seconds === Infinity ? 'never' : `${w.health.age_seconds}s ago`;
          console.log(`  ${w.id.padEnd(6)}  ${colorVerdict(w.health.verdict).padEnd(20)}  runtime=${(w.status && w.status.runtime) || '?'}  ${stateStr}  hb=${ageStr}`);
          if (w.health.reason) console.log(`         reason: ${w.health.reason}`);
        }
        if (r.dispatcher.last_heartbeat) {
          console.log(`  dispatcher  ${colorVerdict(dv).padEnd(20)}  pid=${r.dispatcher.pid}  hb=${r.dispatcher.health.age_seconds}s ago`);
        }
        totalStalled += r.summary.stalled;
      }
      if (results.length === 0) console.log('No team workers configured.');
      if (totalStalled > 0) {
        process.exitCode = 1;  // signal alarm to caller (cron/monitor)
      }
    },
  });
}

module.exports = { createTeamHealthCommand };
module.exports.register = (ctx) => {
  const cmd = createTeamHealthCommand(ctx.common);
  return { 'team-health': cmd };
};
