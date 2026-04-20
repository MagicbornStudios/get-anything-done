'use strict';

const { defineCommand } = require('citty');

function createTasksListCommand(deps) {
  return defineCommand({
    meta: { name: 'list', description: 'Show tasks from TASK-REGISTRY.xml (falls back to STATE.md)' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      status: { type: 'string', description: 'Filter by status (e.g. in-progress, planned)', default: '' },
      phase: { type: 'string', description: 'Filter by phase id (e.g. 03)', default: '' },
      full: { type: 'boolean', description: 'Show full goal text (no truncation)', default: false },
      graph: { type: 'boolean', description: 'Use graph-backed query (auto-enabled when useGraphQuery=true)', default: false },
      stalled: { type: 'boolean', description: 'Show only in-progress tasks without attribution (no agent / skill / runtime) — stall heuristic', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      deps.runTasksListView(deps, args);
    },
  });
}

module.exports = { createTasksListCommand };
