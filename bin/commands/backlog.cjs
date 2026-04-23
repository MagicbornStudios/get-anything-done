'use strict';

const { execFileSync } = require('node:child_process');
const readline = require('node:readline');
const { defineCommand } = require('citty');
const { auditTasks, phaseRecommendations } = require('../../lib/tasks-audit.cjs');

function createBacklogCommand(deps) {
  const sweep = defineCommand({
    meta: { name: 'sweep', description: 'Report cross-phase close/cancel/review recommendations' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', required: true },
      json: { type: 'boolean', description: 'JSON output', default: false },
      apply: { type: 'boolean', description: 'Prompt and apply recommendations', default: false },
      yes: { type: 'boolean', description: 'Apply every supported recommendation without prompting', default: false },
    },
    async run({ args }) {
      const resolved = resolveSingleProject(deps, args.projectid);
      if (!resolved) return;
      const report = buildSweepReport(deps, resolved);

      if (args.json || deps.shouldUseJson()) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderMarkdown(report));
      }

      if (args.apply) {
        await applyRecommendations({ deps, projectid: args.projectid, report, yes: args.yes });
      }
    },
  });

  return defineCommand({
    meta: { name: 'backlog', description: 'Backlog audit and cross-phase sweeps' },
    subCommands: { sweep },
  });
}

function resolveSingleProject(deps, projectid) {
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);
  const roots = deps.resolveRoots({ projectid }, baseDir, config.roots);
  if (roots.length === 0) {
    deps.outputError(`Project not found: ${projectid}.`);
    process.exit(1);
    return null;
  }
  if (roots.length > 1) {
    deps.outputError('backlog sweep requires a single project. Pass --projectid <id>.');
    process.exit(1);
    return null;
  }
  return { baseDir, config, root: roots[0] };
}

function buildSweepReport(deps, { baseDir, root }) {
  const phases = deps.readPhases(root, baseDir);
  const tasks = deps.readTasks(root, baseDir, {});
  const auditRows = auditTasks({ tasks, baseDir, root });
  const recs = phaseRecommendations({ phases, tasks, auditRows });
  return {
    project: root.id,
    ready_to_close_phases: recs.readyToClose,
    superseded_phases: recs.superseded,
    empty_phases: recs.empty,
    stale_tasks: recs.staleTasks,
  };
}

function renderMarkdown(report) {
  const lines = [`# Backlog Sweep: ${report.project}`, ''];
  appendSection(lines, 'READY-TO-CLOSE phases', report.ready_to_close_phases, (row) => {
    return `- Phase ${row.id}: ${row.tasks} task(s) closed. Recommend \`${row.recommendation} --projectid ${report.project}\`.`;
  });
  appendSection(lines, 'SUPERSEDED phases', report.superseded_phases, (row) => {
    return `- Phase ${row.id}: dependencies cancelled (${row.depends.join(', ')}). Recommend \`${row.recommendation} --projectid ${report.project}\`.`;
  });
  appendSection(lines, 'EMPTY phases', report.empty_phases, (row) => {
    return `- Phase ${row.id}: zero tasks. Recommend review (either kickoff or cancel).`;
  });
  appendSection(lines, 'STALE TASKS', report.stale_tasks, (row) => {
    return `- ${row.id} (phase ${row.phase}, ${row.status}, age ${row.age_days || 'n/a'}d): ${row.flags.join(', ')}. Recommend review.`;
  });
  return lines.join('\n');
}

function appendSection(lines, title, rows, renderRow) {
  lines.push(`## ${title}`);
  if (rows.length === 0) {
    lines.push('- None');
  } else {
    for (const row of rows) lines.push(renderRow(row));
  }
  lines.push('');
}

async function applyRecommendations({ deps, projectid, report, yes }) {
  const actions = [
    ...report.ready_to_close_phases.map((row) => ({
      label: `close phase ${row.id}`,
      argv: ['phases', 'close', row.id, '--projectid', projectid],
    })),
    ...report.superseded_phases.map((row) => ({
      label: `cancel phase ${row.id} (dependency cascade)`,
      argv: ['phases', 'cancel', row.id, '--projectid', projectid, '--reason', 'dependency cascade'],
    })),
    ...report.stale_tasks.map((row) => ({
      label: `stamp ${row.id} for review (${row.flags.join(',')})`,
      argv: [
        'tasks',
        'stamp',
        row.id,
        '--projectid',
        projectid,
        '--resolution',
        `Backlog sweep review requested for flags: ${row.flags.join(',')}`,
      ],
    })),
  ];

  if (actions.length === 0) {
    console.log('No apply actions.');
    return;
  }

  let allYes = Boolean(yes);
  let allSkip = false;
  let rl = null;
  try {
    if (!yes) rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    for (const action of actions) {
      if (allSkip) continue;
      let answer = allYes ? 'y' : await ask(rl, `Apply ${action.label}? (y/N/skip/all-y/all-skip) `);
      answer = String(answer || '').trim().toLowerCase();
      if (answer === 'all-y') {
        allYes = true;
        answer = 'y';
      } else if (answer === 'all-skip') {
        allSkip = true;
        continue;
      } else if (answer === 'skip' || answer === 's') {
        continue;
      }
      if (answer !== 'y' && answer !== 'yes') continue;
      execFileSync(process.execPath, [process.argv[1], ...action.argv], {
        cwd: deps.findRepoRoot(),
        stdio: 'inherit',
        env: process.env,
      });
    }
  } finally {
    if (rl) rl.close();
  }
}

function ask(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

module.exports = { createBacklogCommand, buildSweepReport, renderMarkdown };
module.exports.register = (ctx) => ({ backlog: createBacklogCommand(ctx.common) });
