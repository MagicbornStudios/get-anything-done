'use strict';
/**
 * gad phases — list / add subcommands.
 *
 * Required deps:
 *   findRepoRoot, gadConfig, resolveRoots, outputError,
 *   render, shouldUseJson, readPhases, writePhase, maybeRebuildGraph
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createPhasesCommand(deps) {
  const {
    findRepoRoot, gadConfig, resolveRoots, outputError,
    render, shouldUseJson, readPhases, readTasks, writePhase, maybeRebuildGraph,
  } = deps;

  function resolveSingleProject(args) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
    if (roots.length === 0) {
      outputError('No project resolved. Pass --projectid <id> or run from a project root.');
      return null;
    }
    if (roots.length > 1) {
      outputError('This phases subcommand requires a single project. Pass --projectid <id>.');
      return null;
    }
    return { baseDir, root: roots[0] };
  }

  function escapeXmlText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeXmlAttr(s) {
    return escapeXmlText(s).replace(/"/g, '&quot;');
  }

  function findPhaseBlock(xml, phaseId) {
    const phaseRe = /<phase\b([^>]*)>[\s\S]*?<\/phase>/g;
    let m;
    while ((m = phaseRe.exec(xml)) !== null) {
      const idMatch = m[1].match(/\bid="([^"]*)"/);
      if (idMatch && idMatch[1] === String(phaseId)) {
        return { start: m.index, end: m.index + m[0].length, block: m[0] };
      }
    }
    return null;
  }

  function writeRoadmapPhase(root, baseDir, phaseId, mutateBlock) {
    const filePath = path.join(baseDir, root.path, root.planningDir, 'ROADMAP.xml');
    if (!fs.existsSync(filePath)) {
      throw new Error(`ROADMAP.xml not found at ${path.relative(baseDir, filePath)}`);
    }
    const original = fs.readFileSync(filePath, 'utf8');
    const found = findPhaseBlock(original, phaseId);
    if (!found) throw new Error(`Phase ${phaseId} not found in ROADMAP.xml`);
    const nextBlock = mutateBlock(found.block);
    fs.writeFileSync(filePath, original.slice(0, found.start) + nextBlock + original.slice(found.end), 'utf8');
    return filePath;
  }

  function setPhaseStatus(root, baseDir, phaseId, status) {
    return writeRoadmapPhase(root, baseDir, phaseId, (block) => {
      if (/<status>[\s\S]*?<\/status>/.test(block)) {
        return block.replace(/(<status>)[\s\S]*?(<\/status>)/, `$1${escapeXmlText(status)}$2`);
      }
      return block.replace(/(\s*)<\/phase>$/, `$1  <status>${escapeXmlText(status)}</status>$1</phase>`);
    });
  }

  function cancelRoadmapPhase(root, baseDir, phaseId, reason) {
    const date = new Date().toISOString().slice(0, 10);
    const note = `[CANCELLED ${date}: ${reason}]`;
    return writeRoadmapPhase(root, baseDir, phaseId, (block) => {
      let next = setStatusInBlock(block, 'cancelled');
      if (/<goal>[\s\S]*?<\/goal>/.test(next)) {
        next = next.replace(/(<goal>)([\s\S]*?)(<\/goal>)/, (_m, open, goal, close) => {
          const sep = goal.trim() ? ' ' : '';
          return `${open}${goal}${sep}${escapeXmlText(note)}${close}`;
        });
      } else {
        next = next.replace(/(\s*)<\/phase>$/, `$1  <goal>${escapeXmlText(note)}</goal>$1</phase>`);
      }
      return next;
    });
  }

  function setStatusInBlock(block, status) {
    if (/<status>[\s\S]*?<\/status>/.test(block)) {
      return block.replace(/(<status>)[\s\S]*?(<\/status>)/, `$1${escapeXmlText(status)}$2`);
    }
    return block.replace(/(\s*)<\/phase>$/, `$1  <status>${escapeXmlText(status)}</status>$1</phase>`);
  }

  function appendStateLog(root, baseDir, message, tags = 'phases') {
    const stateXml = path.join(baseDir, root.path, root.planningDir, 'STATE.xml');
    if (!fs.existsSync(stateXml)) return null;
    const agent = String(process.env.GAD_AGENT_NAME || 'unknown');
    const at = new Date().toISOString();
    const tagsAttr = tags ? ` tags="${escapeXmlAttr(tags)}"` : '';
    const entry = `    <entry agent="${escapeXmlAttr(agent)}" at="${at}"${tagsAttr}>${escapeXmlText(message)}</entry>\n`;
    let xml = fs.readFileSync(stateXml, 'utf8');
    if (/<state-log>/.test(xml)) {
      xml = xml.replace(/<state-log>\s*\n/, (m) => m + entry);
    } else {
      xml = xml.replace(/<\/state>/, `  <state-log>\n${entry}  </state-log>\n</state>`);
    }
    fs.writeFileSync(stateXml, xml, 'utf8');
    return stateXml;
  }

  function phaseTaskCounts(tasks) {
    const counts = { total: tasks.length, done: 0, planned: 0, cancelled: 0, inProgress: 0 };
    for (const task of tasks) {
      const status = String(task.status || 'planned').toLowerCase();
      if (status === 'done') counts.done += 1;
      else if (status === 'cancelled' || status === 'canceled') counts.cancelled += 1;
      else if (status === 'in-progress' || status === 'active') counts.inProgress += 1;
      else if (status === 'planned') counts.planned += 1;
    }
    return counts;
  }

  function verdictFor(phase, counts) {
    if (phase.status === 'done') return 'DONE';
    if (phase.status === 'cancelled') return 'CANCELLED';
    if (phase.status === 'planned' && counts.planned === 0 && counts.inProgress === 0 && counts.done >= 1) return 'READY-TO-CLOSE';
    if (phase.status === 'planned' && counts.planned === 0 && counts.done === 0) return 'STALE';
    if (phase.status === 'planned' && (counts.planned >= 1 || counts.inProgress >= 1)) return 'ACTIVE';
    return String(phase.status || 'unknown').toUpperCase();
  }

  function buildAuditRows(root, baseDir) {
    const tasks = readTasks(root, baseDir, {});
    return readPhases(root, baseDir).map((phase) => {
      const counts = phaseTaskCounts(tasks.filter((task) => String(task.phase) === String(phase.id)));
      const donePct = counts.total === 0 ? 0 : Math.round((counts.done / counts.total) * 100);
      return {
        id: phase.id,
        title: phase.title.length > 48 ? phase.title.slice(0, 45) + '...' : phase.title,
        status: phase.status,
        total: counts.total,
        done: counts.done,
        planned: counts.planned,
        cancelled: counts.cancelled,
        inProgress: counts.inProgress,
        donePct,
        verdict: verdictFor(phase, counts),
      };
    });
  }

  const phasesListCmd = defineCommand({
    meta: { name: 'list', description: 'List phases from ROADMAP.xml' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
      full: { type: 'boolean', description: 'Show complete goal text for each phase', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;

      const rows = [];
      for (const root of roots) {
        const phases = readPhases(root, baseDir);
        if (phases.length === 0) continue;
        for (const phase of phases) {
          const isActive = phase.status === 'active' || phase.status === 'in-progress';
          const useJson = args.json || shouldUseJson();
          const row = {
            project: root.id,
            id: phase.id,
            status: phase.status,
            title: phase.title.length > 60 ? phase.title.slice(0, 57) + '...' : phase.title,
          };
          if (useJson || args.full) {
            row.goal = phase.goal || phase.title;
            row.depends = phase.depends || '';
            row.milestone = phase.milestone || '';
            row.plans = phase.plans || '';
            row.requirements = phase.requirements || '';
          } else if (isActive) {
            row.goal = phase.goal || phase.title;
          }
          rows.push(row);
        }
      }

      if (rows.length === 0) {
        console.log('No phases found. Create ROADMAP.md files in your .planning/ directories.');
        return;
      }

      if (args.full && !args.json && !shouldUseJson()) {
        for (const r of rows) {
          console.log(`\n[${r.project}] Phase ${r.id} — ${r.title}  (${r.status})`);
          if (r.goal) console.log(`  Goal: ${r.goal}`);
        }
        console.log(`\n${rows.length} phase(s)`);
        return;
      }

      const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
      console.log(render(rows, { format: fmt, title: `Phases (${rows.length})` }));
    },
  });

  const phasesAddCmd = defineCommand({
    meta: { name: 'add', description: 'Append a <phase> to ROADMAP.xml. Fails if id collides.' },
    args: {
      id: { type: 'positional', description: 'Phase id (e.g. 47, 47.1)', required: true },
      title: { type: 'string', description: 'Short phase title', required: true },
      goal: { type: 'string', description: 'Phase goal text (the outcome)', required: true },
      status: { type: 'string', description: 'Phase status', default: 'planned' },
      depends: { type: 'string', description: 'Comma-separated phase ids this depends on', default: '' },
      milestone: { type: 'string', description: 'Milestone (optional)', default: '' },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or run from a project root.');
        return;
      }
      if (roots.length > 1) {
        outputError('phases add requires a single project. Pass --projectid <id>.');
        return;
      }
      const root = roots[0];
      const taskRegistryPath = path.join(baseDir, root.path, root.planningDir, 'TASK-REGISTRY.xml');
      if (!fs.existsSync(taskRegistryPath)) {
        outputError(`TASK-REGISTRY.xml not found at ${path.relative(baseDir, taskRegistryPath)}`);
        process.exit(1);
        return;
      }
      const roadmapPath = path.join(baseDir, root.path, root.planningDir, 'ROADMAP.xml');
      let roadmapBackup = null;
      let phaseWritten = false;
      try {
        roadmapBackup = fs.readFileSync(roadmapPath, 'utf8');
        const result = writePhase(root, baseDir, {
          id: String(args.id),
          title: String(args.title),
          goal: String(args.goal),
          status: String(args.status || 'planned'),
          depends: String(args.depends || ''),
          milestone: String(args.milestone || ''),
        });
        phaseWritten = true;
        const { ensurePhaseInFile } = require('../../lib/task-registry-writer.cjs');
        const registrySync = ensurePhaseInFile({
          filePath: taskRegistryPath,
          phaseId: String(args.id),
        });
        console.log(`Added phase ${args.id}: ${args.title}`);
        console.log(`File:    ${path.relative(baseDir, result.filePath)}`);
        console.log(`Total:   ${result.count} phase(s)`);
        console.log(`Task registry phase sync: ${registrySync.inserted ? 'inserted' : 'already-present'}`);
        maybeRebuildGraph(baseDir, root);
      } catch (e) {
        if (phaseWritten && roadmapBackup != null) {
          try { fs.writeFileSync(roadmapPath, roadmapBackup, 'utf8'); } catch {}
        }
        outputError(e.message);
        process.exit(1);
      }
    },
  });

  const phasesAuditCmd = defineCommand({
    meta: { name: 'audit', description: 'Audit per-phase task completion and close/cancel readiness' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;
      const rows = [];
      for (const root of roots) {
        for (const row of buildAuditRows(root, baseDir)) {
          rows.push({
            project: root.id,
            id: row.id,
            title: row.title,
            status: row.status,
            tasks: `${row.total}/${row.done}/${row.planned}/${row.cancelled}`,
            in_progress: row.inProgress,
            done_pct: `${row.donePct}%`,
            verdict: row.verdict,
          });
        }
      }
      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }
      if (rows.length === 0) {
        console.log('No phases found. Create ROADMAP.xml files in your .planning/ directories.');
        return;
      }
      console.log(render(rows, {
        format: 'table',
        title: `Phase Audit (${rows.length})`,
        headers: ['project', 'id', 'title', 'status', 'tasks', 'in_progress', 'done_pct', 'verdict'],
      }));
      console.log('\nTasks column: total/done/planned/cancelled');
    },
  });

  const phasesCloseCmd = defineCommand({
    meta: { name: 'close', description: 'Mark a phase done when all tasks are done or cancelled' },
    args: {
      id: { type: 'positional', description: 'Phase id to close', required: true },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    },
    run({ args }) {
      const resolved = resolveSingleProject(args);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const phaseId = String(args.id);
      const phase = readPhases(root, baseDir).find((p) => String(p.id) === phaseId);
      if (!phase) {
        outputError(`Phase ${phaseId} not found in ROADMAP.xml`);
        process.exit(1);
        return;
      }
      const tasks = readTasks(root, baseDir, { phase: phaseId });
      const blocking = tasks.filter((task) => {
        const status = String(task.status || 'planned').toLowerCase();
        return status !== 'done' && status !== 'cancelled' && status !== 'canceled';
      });
      if (blocking.length > 0) {
        const planned = blocking.filter((task) => String(task.status || '').toLowerCase() === 'planned').length;
        const inProgress = blocking.filter((task) => {
          const status = String(task.status || '').toLowerCase();
          return status === 'in-progress' || status === 'active';
        }).length;
        console.error(`Cannot close phase ${phaseId}: ${blocking.length} tasks still planned or in-progress (${planned} planned, ${inProgress} in-progress)`);
        for (const task of blocking) {
          const goal = task.goal && task.goal.length > 78 ? task.goal.slice(0, 75) + '...' : (task.goal || '');
          console.error(`  ${task.id}: ${goal}`);
        }
        console.error('Close or cancel these tasks first.');
        process.exit(1);
        return;
      }
      const counts = phaseTaskCounts(tasks);
      let filePath;
      try {
        filePath = setPhaseStatus(root, baseDir, phaseId, 'done');
        appendStateLog(root, baseDir, `Closed phase ${phaseId} via gad phases close - ${counts.done} tasks done, ${counts.cancelled} cancelled.`, 'phases,close');
        maybeRebuildGraph(baseDir, root);
      } catch (e) {
        outputError(e.message);
        process.exit(1);
        return;
      }
      console.log(`Closed phase ${phaseId}.`);
      console.log(`File: ${path.relative(baseDir, filePath)}`);
      console.log(`Tasks: ${counts.done} done, ${counts.cancelled} cancelled`);
    },
  });

  const phasesCancelCmd = defineCommand({
    meta: { name: 'cancel', description: 'Mark a phase cancelled and record the reason in its goal' },
    args: {
      id: { type: 'positional', description: 'Phase id to cancel', required: true },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      reason: { type: 'string', description: 'Cancellation reason', required: true },
    },
    run({ args }) {
      const resolved = resolveSingleProject(args);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const phaseId = String(args.id);
      const reason = String(args.reason || '').trim();
      if (!reason) {
        outputError('cancel requires --reason "text".');
        process.exit(1);
        return;
      }
      const phase = readPhases(root, baseDir).find((p) => String(p.id) === phaseId);
      if (!phase) {
        outputError(`Phase ${phaseId} not found in ROADMAP.xml`);
        process.exit(1);
        return;
      }
      let filePath;
      try {
        filePath = cancelRoadmapPhase(root, baseDir, phaseId, reason);
        appendStateLog(root, baseDir, `Cancelled phase ${phaseId} via gad phases cancel - ${reason}`, 'phases,cancel');
        maybeRebuildGraph(baseDir, root);
      } catch (e) {
        outputError(e.message);
        process.exit(1);
        return;
      }
      console.log(`Cancelled phase ${phaseId}.`);
      console.log(`File: ${path.relative(baseDir, filePath)}`);
    },
  });

  return defineCommand({
    meta: { name: 'phases', description: 'Manage phases — list (default), add, audit, close, cancel' },
    subCommands: {
      list: phasesListCmd,
      add: phasesAddCmd,
      audit: phasesAuditCmd,
      close: phasesCloseCmd,
      cancel: phasesCancelCmd,
    },
  });
}

module.exports = { createPhasesCommand };
module.exports.register = (ctx) => ({ phases: createPhasesCommand(ctx.common) });
