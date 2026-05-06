'use strict';
/**
 * gad bridge — cross-instance / cross-project handoff coordination.
 *
 * Operator request 2026-05-07: "we use a schedule checker or something.
 * i dunno. whatever is effective and efficient." — for two Claude
 * Code instances (gad-monorepo + slm-learning) to coordinate without
 * each having to manually `gad handoffs list --projectid <theirs>`.
 *
 * Subcommands:
 *   inbox              — one-shot list of open handoffs across all
 *                        registered planning roots (gad-config.toml)
 *   watch              — long-running poll (30s default), prints diffs
 *                        as new handoffs appear in any project's
 *                        .planning/handoffs/open/
 *   send <to-project>  — quick handoff create against another project's
 *                        queue with sensible defaults
 *
 * No new fs primitives — wraps the existing handoffs queue (no new
 * syncing model, no new schema). The bridge is the operator's shortcut
 * for what `gad handoffs list --projectid <X>` already does, just done
 * across every X automatically.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

const gadConfig = require('../gad-config.cjs');

function listAllRoots(baseDir) {
  // gad-config.toml [[planning.roots]] are exposed as cfg.roots (not
  // cfg.planning.roots — the loader flattens). Each root has
  // {id, path, planningDir?} where planningDir defaults to ".planning".
  const cfg = gadConfig.load(baseDir);
  const roots = Array.isArray(cfg.roots) ? cfg.roots : [];
  return roots.map((r) => ({
    id: r.id || path.basename(r.path),
    absPath: path.resolve(baseDir, r.path),
    relPath: r.path,
    planningDir: r.planningDir || '.planning',
  })).filter((r) => fs.existsSync(path.join(r.absPath, r.planningDir, 'handoffs')));
}

function listOpenHandoffs(rootInfo) {
  const dir = path.join(rootInfo.absPath, rootInfo.planningDir || '.planning', 'handoffs', 'open');
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const fp = path.join(dir, f);
        const stat = fs.statSync(fp);
        const head = fs.readFileSync(fp, 'utf8').slice(0, 4096);
        const taskMatch = head.match(/^task_id:\s*(.+)$/m);
        const runtimeMatch = head.match(/^runtime_preference:\s*(.+)$/m);
        const priorityMatch = head.match(/^priority:\s*(.+)$/m);
        const titleMatch = head.match(/\n# (.+)/);
        return {
          project: rootInfo.id,
          id: f.replace(/\.md$/, ''),
          mtime: stat.mtime.toISOString(),
          mtimeMs: stat.mtimeMs,
          taskId: taskMatch ? taskMatch[1].trim() : null,
          runtime: runtimeMatch ? runtimeMatch[1].trim() : null,
          priority: priorityMatch ? priorityMatch[1].trim() : null,
          title: titleMatch ? titleMatch[1].trim() : '(no title)',
        };
      });
  } catch (e) { return []; }
}

function fmtRow(h) {
  const mt = h.mtime.replace('T', ' ').replace('Z', '').slice(5, 16);
  const proj = (h.project || '?').padEnd(15);
  const pri = (h.priority || 'normal').padEnd(7);
  const rt = (h.runtime || 'any').padEnd(13);
  const task = (h.taskId || '?').padEnd(18);
  return `${mt}  ${proj}  ${pri}  ${rt}  ${task}  ${h.title.slice(0, 60)}`;
}

function createInboxCommand() {
  return defineCommand({
    meta: {
      name: 'inbox',
      description: 'One-shot list of open handoffs across all registered planning roots. Sorted newest-first.',
    },
    args: {
      'mine-runtime': { type: 'string', description: 'Filter to runtime_preference == this' },
      since: { type: 'string', description: 'Only show handoffs newer than ISO ts' },
      json: { type: 'boolean', description: 'JSON output' },
    },
    run: ({ args }) => {
      const baseDir = process.cwd();
      const roots = listAllRoots(baseDir);
      let all = [];
      for (const r of roots) all = all.concat(listOpenHandoffs(r));
      if (args['mine-runtime']) {
        all = all.filter((h) => h.runtime === args['mine-runtime']);
      }
      if (args.since) {
        const sinceMs = Date.parse(args.since);
        if (!Number.isNaN(sinceMs)) all = all.filter((h) => h.mtimeMs >= sinceMs);
      }
      all.sort((a, b) => b.mtimeMs - a.mtimeMs);
      if (args.json) {
        console.log(JSON.stringify(all, null, 2));
        return;
      }
      if (all.length === 0) {
        console.log('Inbox empty across all projects.');
        return;
      }
      console.log(`Inbox: ${all.length} open handoffs across ${roots.length} project(s)\n`);
      console.log('mtime         project         priority runtime       task               title');
      console.log('---------------------------------------------------------------------------------------------');
      for (const h of all) console.log(fmtRow(h));
    },
  });
}

function createWatchCommand() {
  return defineCommand({
    meta: {
      name: 'watch',
      description: 'Long-running poll loop. Prints new/closed handoff diffs every --interval seconds. Ctrl-C to stop.',
    },
    args: {
      interval: { type: 'string', description: 'Poll interval seconds (default 30)' },
      'mine-runtime': { type: 'string', description: 'Filter watch output to runtime_preference == this' },
      'notify-cmd': { type: 'string', description: 'Optional shell command piped the handoff json on stdin per new handoff.' },
    },
    run: async ({ args }) => {
      const baseDir = process.cwd();
      const intervalMs = (Number(args.interval) || 30) * 1000;
      const filterRuntime = args['mine-runtime'] || null;
      const notifyCmd = args['notify-cmd'] || null;

      const roots = listAllRoots(baseDir);
      console.log(`[bridge watch] watching ${roots.length} project(s): ${roots.map((r) => r.id).join(', ')}`);
      console.log(`[bridge watch] interval=${intervalMs}ms ${filterRuntime ? `filter=runtime:${filterRuntime}` : '(no filter)'}`);
      console.log(`[bridge watch] Ctrl-C to stop`);

      let known = new Set();
      const initial = [];
      for (const r of roots) initial.push(...listOpenHandoffs(r));
      for (const h of initial) known.add(`${h.project}:${h.id}`);
      console.log(`[bridge watch] baseline: ${known.size} open handoffs`);

      while (true) {
        await new Promise((res) => setTimeout(res, intervalMs));
        const current = [];
        for (const r of roots) current.push(...listOpenHandoffs(r));
        const currentKeys = new Set(current.map((h) => `${h.project}:${h.id}`));

        const fresh = current.filter((h) => !known.has(`${h.project}:${h.id}`));
        const toShow = filterRuntime ? fresh.filter((h) => h.runtime === filterRuntime) : fresh;
        for (const h of toShow) {
          console.log(`[NEW]    ${fmtRow(h)}`);
          if (notifyCmd) spawnNotify(notifyCmd, h);
        }

        for (const k of known) {
          if (!currentKeys.has(k)) {
            const [proj, id] = k.split(':', 2);
            console.log(`[CLOSED] ${new Date().toISOString().slice(11,16)}     ${proj.padEnd(15)}  ${id}`);
          }
        }

        known = currentKeys;
      }
    },
  });
}

function spawnNotify(cmd, handoff) {
  try {
    const { spawn } = require('child_process');
    const p = spawn(cmd, [], { shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
    p.stdin.end(JSON.stringify(handoff));
  } catch (e) {
    process.stderr.write(`[bridge watch] notify cmd failed: ${e.message}\n`);
  }
}

function createSendCommand() {
  return defineCommand({
    meta: {
      name: 'send',
      description: 'Quick-create a handoff in another project queue. Wraps gad handoffs create. Use --quick to bypass quality gate.',
    },
    args: {
      to: { type: 'string', description: 'Target projectid (must be a registered planning root)', required: true },
      'task-id': { type: 'string', description: 'Task id to link (must exist in target project)', required: true },
      phase: { type: 'string', description: 'Phase number', required: true },
      'runtime-preference': { type: 'string', description: 'Target runtime: claude-code | codex-cli | gemini-cli | opencode' },
      priority: { type: 'string', description: 'low | normal | high (default normal)' },
      body: { type: 'string', description: 'Markdown body (must include ## Acceptance gate)', required: true },
    },
    run: ({ args }) => {
      const { createHandoff } = require('../../lib/handoffs.cjs');
      const baseDir = process.cwd();
      const roots = listAllRoots(baseDir);
      const target = roots.find((r) => r.id === args.to);
      if (!target) {
        console.error(`Target project '${args.to}' not registered in gad-config.toml. Known: ${roots.map((r) => r.id).join(', ')}`);
        process.exit(1);
      }
      const result = createHandoff({
        baseDir: target.absPath,
        projectid: args.to,
        phase: args.phase,
        taskId: args['task-id'],
        priority: args.priority || 'normal',
        runtimePreference: args['runtime-preference'] || 'any',
        body: args.body,
      });
      console.log(`Sent handoff to ${args.to}: ${result.id}`);
      console.log(`Path: ${result.path}`);
    },
  });
}

function createBridgeCommand() {
  return defineCommand({
    meta: { name: 'bridge', description: 'Cross-project handoff bridge — inbox, watch, send.' },
    subCommands: {
      inbox: createInboxCommand(),
      watch: createWatchCommand(),
      send: createSendCommand(),
    },
  });
}

module.exports = { createBridgeCommand };
module.exports.register = () => ({ bridge: createBridgeCommand() });
