'use strict';

const path = require('path');
const { defineCommand } = require('citty');

function renderTask(task) {
  const lines = [];
  const preferred = [
    'id',
    'phase',
    'status',
    'type',
    'skill',
    'agent_id',
    'agent_role',
    'runtime',
    'model_profile',
    'resolved_model',
    'created_at',
    'updated_at',
  ];

  for (const key of preferred) {
    const value = task[key];
    if (value === undefined || value === null || value === '') continue;
    lines.push(`${key}: ${String(value)}`);
  }

  if (task.goal !== undefined) {
    lines.push('goal:');
    lines.push(String(task.goal || ''));
  }

  const remainingKeys = Object.keys(task).filter((key) => !preferred.includes(key) && key !== 'goal');
  for (const key of remainingKeys) {
    const value = task[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      if (value.length === 0) lines.push('[]');
      else value.forEach((item) => lines.push(`- ${String(item)}`));
      continue;
    }
    if (typeof value === 'object') {
      lines.push(`${key}:`);
      lines.push(JSON.stringify(value, null, 2));
      continue;
    }
    lines.push(`${key}: ${String(value)}`);
  }

  return lines.join('\n');
}

function createTasksShowCommand(deps) {
  return defineCommand({
    meta: { name: 'show', description: 'Show one task from per-task JSON or TASK-REGISTRY.xml.' },
    args: {
      id: { type: 'positional', description: 'Task id to show (e.g. 05-07)', required: true },
      projectid: { type: 'string', description: 'Project id to read from', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const resolved = deps.resolveSingleTaskRoot(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const planningDir = path.join(baseDir, root.path, root.planningDir);
      const taskFiles = require('../../../lib/task-files.cjs');

      let task = taskFiles.readOne(planningDir, String(args.id));
      if (!task) {
        const legacyTask = deps.readTasks(root, baseDir).find((entry) => entry.id === String(args.id));
        if (legacyTask) {
          task = {
            id: legacyTask.id,
            phase: legacyTask.phase || '',
            status: legacyTask.status || '',
            goal: legacyTask.goal || '',
            type: legacyTask.type || '',
            keywords: legacyTask.keywords || '',
            depends: legacyTask.depends ? String(legacyTask.depends).split(',').map((s) => s.trim()).filter(Boolean) : [],
            commands: Array.isArray(legacyTask.commands) ? legacyTask.commands : [],
            files: Array.isArray(legacyTask.files) ? legacyTask.files : [],
            agent_id: legacyTask.agentId || '',
            agent_role: legacyTask.agentRole || '',
            runtime: legacyTask.runtime || '',
            model_profile: legacyTask.modelProfile || '',
            resolved_model: legacyTask.resolvedModel || '',
            skill: legacyTask.skill || '',
          };
        }
      }

      if (!task) {
        deps.outputError(`Task not found: ${args.id}`);
        process.exit(1);
        return;
      }

      if (args.json || deps.shouldUseJson()) {
        console.log(JSON.stringify(task, null, 2));
        return;
      }

      console.log(renderTask(task));
    },
  });
}

module.exports = { createTasksShowCommand, renderTask };
