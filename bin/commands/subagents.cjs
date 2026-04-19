'use strict';
/**
 * gad subagents — daily-subagent dispatch (phase 59 task 59-07, decision gad-258).
 *
 * Required deps: findRepoRoot, outputError, render
 */

const { defineCommand } = require('citty');

function createSubagentsCommand(deps) {
  const { findRepoRoot, outputError, render } = deps;

  const subagentsDispatchCmd = defineCommand({
    meta: {
      name: 'dispatch',
      description:
        'Emit daily-subagent prompts for every project flagged `dailySubagent = true` in gad-config.toml. Prompt-emit-only for this phase — writes .planning/subagent-runs/<projectid>/<today>-<taskid>.{prompt.md,json}. Real runtime dispatch is a follow-up task.',
    },
    args: {
      projectid: { type: 'string', description: 'Scope to a single project id (otherwise all flagged projects dispatch).', default: '' },
      all: { type: 'boolean', description: 'Dispatch for every flagged project (explicit; matches no-flag default).', default: false },
    },
    run({ args }) {
      const { dispatchAll } = require('../../lib/subagent-dispatch.cjs');
      const baseDir = findRepoRoot();
      const projectId = String(args.projectid || '').trim();
      const disp = dispatchAll({ baseDir, projectId: projectId || undefined });
      if (disp.exitCode !== 0) process.exitCode = disp.exitCode;
    },
  });

  const subagentsStatusCmd = defineCommand({
    meta: {
      name: 'status',
      description: "Show today's daily-subagent runs (pending / completed) across all projects with dailySubagent = true.",
    },
    args: {
      projectid: { type: 'string', description: 'Filter to one project id', default: '' },
      date: { type: 'string', description: 'YYYY-MM-DD (default: today, local tz)', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { listTodaysRuns } = require('../../lib/subagent-dispatch.cjs');
      const runs = listTodaysRuns({ baseDir, date: args.date || undefined });
      const filtered = args.projectid ? runs.filter((r) => r.projectId === args.projectid) : runs;
      if (args.json) { console.log(JSON.stringify(filtered, null, 2)); return; }
      if (filtered.length === 0) {
        console.log(args.projectid
          ? `No subagent runs for project=${args.projectid} on ${args.date || 'today'}.`
          : `No subagent runs for ${args.date || 'today'}.`);
        return;
      }
      const rows = filtered.map((r) => ({
        project: r.projectId,
        task: r.taskId || '-',
        status: r.status,
        started: r.startedAt ? r.startedAt.slice(11, 19) : '-',
        ended: r.endedAt ? r.endedAt.slice(11, 19) : '-',
        prompt: r.promptPath || '-',
      }));
      console.log(render(rows, { format: 'table', headers: ['project', 'task', 'status', 'started', 'ended', 'prompt'] }));
      const pending = filtered.filter((r) => r.status !== 'completed');
      if (pending.length > 0) {
        console.log('');
        console.log(`${pending.length} pending. After your subagent completes:`);
        for (const p of pending) {
          const taskFlag = p.taskId ? ` --task-id ${p.taskId}` : '';
          console.log(`  gad subagents mark-completed --projectid ${p.projectId}${taskFlag} --commit <sha>`);
        }
      }
    },
  });

  const subagentsMarkCompletedCmd = defineCommand({
    meta: {
      name: 'mark-completed',
      description: 'Mark a daily-subagent run as completed. Call this from the orchestrator after the subagent commits its work.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id', required: true },
      'task-id': { type: 'string', description: 'Task id (required if multiple pending runs for today)', default: '' },
      date: { type: 'string', description: 'YYYY-MM-DD (default: today, local tz)', default: '' },
      commit: { type: 'string', description: 'Commit sha landing the work (recorded on the run)', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { markCompleted } = require('../../lib/subagent-dispatch.cjs');
      try {
        const updated = markCompleted({
          baseDir,
          projectId: String(args.projectid),
          taskId: args['task-id'] || undefined,
          date: args.date || undefined,
          commit: args.commit || undefined,
        });
        for (const r of updated) {
          console.log(`Marked completed: ${r.projectId}:${r.taskId || '-'} (${r.date})`);
          if (r.commit) console.log(`  commit: ${r.commit}`);
          if (r.endedAt) console.log(`  endedAt: ${r.endedAt}`);
        }
      } catch (e) {
        outputError(e.message);
        process.exit(1);
      }
    },
  });

  return defineCommand({
    meta: {
      name: 'subagents',
      description:
        'Subagent dispatch + run-history CLI family (decision gad-258). Subcommands: dispatch, status, mark-completed.',
    },
    subCommands: {
      dispatch: subagentsDispatchCmd,
      status: subagentsStatusCmd,
      'mark-completed': subagentsMarkCompletedCmd,
    },
  });
}

module.exports = { createSubagentsCommand };
