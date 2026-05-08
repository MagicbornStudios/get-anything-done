'use strict';
/**
 * gad collisions — collision + regression observability (Phase 122).
 *
 * Subcommands:
 *   list          — list logged collision events with optional filters
 *   dismiss <id> — mark an event dismissed (non-destructive; appends dismiss record)
 *   scan          — manually run regression check for a task that's already done
 *   cycle-check   — manually walk the parent_handoff_id chain for a handoff
 *
 * Auto-loaded by _loader.cjs — no edits to bin/gad.cjs needed.
 */

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { defineCommand } = require('citty');

// ---------------------------------------------------------------------------
// Load library (lazy, so CLI startup doesn't pay for requires it doesn't use)
// ---------------------------------------------------------------------------

function loadLib() {
  return require('../../lib/collisions/index.cjs');
}

// ---------------------------------------------------------------------------
// Small render helpers
// ---------------------------------------------------------------------------

function padEnd(str, len) {
  const s = String(str == null ? '' : str);
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function truncate(str, len) {
  const s = String(str == null ? '' : str);
  return s.length <= len ? s : `${s.slice(0, len - 1)}…`;
}

function renderTable(rows) {
  if (rows.length === 0) {
    console.log('No collision events.');
    return;
  }
  const COL = { ts: 22, type: 20, severity: 9, source: 14, fingerprint: 18 };
  const header = [
    padEnd('TIMESTAMP', COL.ts),
    padEnd('TYPE', COL.type),
    padEnd('SEVERITY', COL.severity),
    padEnd('SOURCE', COL.source),
    padEnd('FINGERPRINT', COL.fingerprint),
    'PAYLOAD',
  ].join('  ');
  const sep = Object.values(COL).map((n) => '-'.repeat(n)).join('  ') + '  ' + '-'.repeat(30);
  console.log(header);
  console.log(sep);
  for (const ev of rows) {
    const payloadStr = ev.payload ? truncate(JSON.stringify(ev.payload), 40) : '';
    console.log([
      padEnd(ev.ts || '', COL.ts),
      padEnd(ev.type || '', COL.type),
      padEnd(ev.severity || '', COL.severity),
      padEnd(truncate(ev.source || '', COL.source), COL.source),
      padEnd(ev.fingerprint || '', COL.fingerprint),
      payloadStr,
    ].join('  '));
  }
}

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

function createCollisionsCommand(deps) {
  const { findRepoRoot, outputError } = deps;

  // -----------------------------------------------------------------------
  // list
  // -----------------------------------------------------------------------
  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List logged collision events' },
    args: {
      since: { type: 'string', description: 'ISO date lower bound (e.g. 2026-05-01)', default: '' },
      type: { type: 'string', description: 'Filter by type (double-claim|race-on-mailbox|regression-on-stamp|handoff-cycle|concurrent-edit)', default: '' },
      severity: { type: 'string', description: 'Minimum severity (low|medium|high|critical)', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
      projectid: { type: 'string', description: 'Scope (informational)', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { listCollisions } = loadLib();

      const events = listCollisions({
        baseDir,
        since: args.since || undefined,
        type: args.type || undefined,
        severity: args.severity || undefined,
      });

      if (args.json) {
        console.log(JSON.stringify(events, null, 2));
        return;
      }

      if (events.length === 0) {
        const filters = [
          args.since ? `since=${args.since}` : null,
          args.type ? `type=${args.type}` : null,
          args.severity ? `severity>=${args.severity}` : null,
        ].filter(Boolean).join(', ');
        console.log(`No collision events${filters ? ` matching [${filters}]` : ''}.`);
        return;
      }

      console.log(`\nCOLLISIONS (${events.length})\n`);
      renderTable(events);
    },
  });

  // -----------------------------------------------------------------------
  // dismiss
  // -----------------------------------------------------------------------
  const dismissCmd = defineCommand({
    meta: { name: 'dismiss', description: 'Dismiss a collision event by fingerprint (non-destructive — appends dismiss record)' },
    args: {
      id: { type: 'positional', description: 'Fingerprint of the event to dismiss', required: true },
      reason: { type: 'string', description: 'Reason for dismissal', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { listCollisions } = loadLib();
      const collisionsFilePath = path.join(baseDir, '.planning', '.collisions.jsonl');

      // Find the event by fingerprint
      const allEvents = listCollisions({ baseDir });
      // Also read dismissed ones
      let rawLines = [];
      if (fs.existsSync(collisionsFilePath)) {
        rawLines = fs.readFileSync(collisionsFilePath, 'utf8').split('\n').filter(Boolean);
      }

      const targetFingerprint = String(args.id).trim();
      let found = false;
      for (const line of rawLines) {
        try {
          const ev = JSON.parse(line);
          if (ev.fingerprint === targetFingerprint) {
            found = true;
            break;
          }
        } catch { /* skip */ }
      }

      if (!found) {
        outputError(`No collision event found with fingerprint: ${targetFingerprint}`);
        process.exit(1);
        return;
      }

      // Append a dismiss record (never delete history)
      const dismissRecord = {
        ts: new Date().toISOString(),
        type: '__dismiss__',
        dismissed: true,
        fingerprint: targetFingerprint,
        reason: args.reason || '',
        dismissed_by: process.env.GAD_AGENT || 'unknown',
      };

      // Also rewrite the original line with dismissed=true so listCollisions
      // can filter it out efficiently (forward scan won't re-read it anyway,
      // but appending a separate dismiss record is the non-destructive path).
      const dismissLine = JSON.stringify(dismissRecord) + '\n';
      fs.appendFileSync(collisionsFilePath, dismissLine, 'utf8');

      console.log(`Dismissed: ${targetFingerprint}`);
      if (args.reason) console.log(`Reason:    ${args.reason}`);
    },
  });

  // -----------------------------------------------------------------------
  // scan — regression check
  // -----------------------------------------------------------------------
  const scanCmd = defineCommand({
    meta: { name: 'scan', description: 'Run regression check for a completed task using stored checksum snapshot' },
    args: {
      'task-id': { type: 'string', description: 'Task id to scan', required: true },
      projectid: { type: 'string', description: 'Project id (informational)', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { detectRegressionAfterStamp, recordCollision } = loadLib();
      const taskId = String(args['task-id']).trim();

      const result = detectRegressionAfterStamp({ taskId, baseDir });

      if (args.json) {
        console.log(JSON.stringify({ taskId, ...result }, null, 2));
        return;
      }

      if (!result.snapshotTs) {
        console.log(`No checksum snapshot found for task ${taskId}.`);
        console.log('Tip: snapshots are written automatically when a task is stamped done');
        console.log('     via `gad tasks stamp --status done`. Run stamp with --evidence first.');
        return;
      }

      console.log(`\nREGRESSION SCAN — task: ${taskId}`);
      console.log(`Snapshot taken: ${result.snapshotTs}`);

      if (result.regressed.length === 0) {
        console.log('No regressions detected.');
      } else {
        console.log(`\nREGRESSED FILES (${result.regressed.length}):`);
        for (const fp of result.regressed) {
          console.log(`  ${fp}`);
        }

        // Auto-record a collision event
        recordCollision({
          type: 'regression-on-stamp',
          severity: 'high',
          source: process.env.GAD_AGENT || 'cli-scan',
          payload: { taskId, regressedFiles: result.regressed, snapshotTs: result.snapshotTs },
          baseDir,
        });
        console.log('\nCollision event recorded (regression-on-stamp).');
      }
    },
  });

  // -----------------------------------------------------------------------
  // cycle-check
  // -----------------------------------------------------------------------
  const cycleCheckCmd = defineCommand({
    meta: { name: 'cycle-check', description: 'Walk the parent_handoff_id chain for a handoff and report if a cycle is detected' },
    args: {
      id: { type: 'positional', description: 'Handoff id to start from', required: true },
      depth: { type: 'string', description: 'Max chain depth before declaring cycle (default: 5)', default: '5' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { detectCycle, recordCollision } = loadLib();
      const handoffId = String(args.id).trim();
      const maxDepth = Math.max(1, parseInt(String(args.depth || '5'), 10) || 5);

      const result = detectCycle({ handoffId, depth: maxDepth, baseDir });

      if (args.json) {
        console.log(JSON.stringify({ handoffId, ...result }, null, 2));
        return;
      }

      console.log(`\nCYCLE CHECK — handoff: ${handoffId}`);
      console.log(`Chain (depth ${result.depth}): ${result.chain.join(' → ')}`);

      if (result.cycle) {
        console.log(`CYCLE DETECTED${result.message ? `: ${result.message}` : ''}`);

        // Auto-record a collision event
        recordCollision({
          type: 'handoff-cycle',
          severity: 'critical',
          source: process.env.GAD_AGENT || 'cli-cycle-check',
          payload: { handoffId, chain: result.chain, depth: result.depth },
          baseDir,
        });
        console.log('Collision event recorded (handoff-cycle).');
      } else {
        console.log('No cycle detected.');
      }
    },
  });

  // -----------------------------------------------------------------------
  // Root command
  // -----------------------------------------------------------------------
  return defineCommand({
    meta: {
      name: 'collisions',
      description: 'Collision + regression observability — list/dismiss events, scan regressions, check handoff cycles (Phase 122)',
    },
    subCommands: {
      list: listCmd,
      dismiss: dismissCmd,
      scan: scanCmd,
      'cycle-check': cycleCheckCmd,
    },
  });
}

module.exports = { createCollisionsCommand };
module.exports.register = (ctx) => ({
  collisions: createCollisionsCommand(ctx.common),
});
