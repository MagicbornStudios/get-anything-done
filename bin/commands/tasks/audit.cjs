'use strict';

const { defineCommand } = require('citty');
const { auditTasks } = require('../../../lib/tasks-audit.cjs');

function createTasksAuditCommand(deps) {
  return defineCommand({
    meta: { name: 'audit', description: 'List tasks with stale-state heuristic flags' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', required: true },
      phase: { type: 'string', description: 'Filter by phase id', default: '' },
      all: { type: 'boolean', description: 'Show unflagged rows too', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const tasks = deps.readTasks(root, baseDir, args.phase ? { phase: args.phase } : {});
      const rows = auditTasks({ tasks, baseDir, root, phase: args.phase }).map(formatRow);
      const visibleRows = args.all ? rows : rows.filter((row) => row.flags);

      if (args.json || deps.shouldUseJson()) {
        console.log(JSON.stringify(visibleRows.map((row) => ({ ...row, flags: splitFlags(row.flags) })), null, 2));
        return;
      }

      if (visibleRows.length === 0) {
        console.log(args.all ? 'No tasks found.' : 'No flagged tasks.');
        return;
      }

      console.log(deps.render(visibleRows, {
        format: 'table',
        title: `Task Audit (${visibleRows.length})`,
        headers: ['id', 'phase', 'status', 'updated_at', 'age_days', 'flags'],
      }));
    },
  });
}

function formatRow(row) {
  return {
    ...row,
    flags: row.flags.join(','),
  };
}

function splitFlags(flags) {
  if (Array.isArray(flags)) return flags;
  return String(flags || '').split(',').filter(Boolean);
}

module.exports = { createTasksAuditCommand };
