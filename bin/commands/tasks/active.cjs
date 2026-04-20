'use strict';

const path = require('path');
const { defineCommand } = require('citty');

function createTasksActiveCommand(deps) {
  return defineCommand({
    meta: { name: 'active', description: 'List active claimed tasks and agent lanes' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      all: { type: 'boolean', description: 'Show all configured projects', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = deps.findRepoRoot();
      const config = deps.gadConfig.load(baseDir);
      const roots = deps.resolveRoots(args, baseDir, config.roots);
      const projects = [];
      const tableRows = [];

      for (const root of roots) {
        const planDir = path.join(baseDir, root.path, root.planningDir);
        const tasks = deps.readTasks(root, baseDir, {});
        const activeTasks = tasks.filter((task) => task.status !== 'done' && task.agentId);
        const lanes = deps.listAgentLanes(planDir);
        const taskMap = new Map(tasks.map((task) => [task.id, task]));
        const projectPayload = {
          project: root.id,
          activeTasks,
          activeAgents: lanes.activeAgents.map((agent) => deps.simplifyAgentLane(agent, taskMap)),
          staleAgents: lanes.staleAgents.map((agent) => deps.simplifyAgentLane(agent, taskMap)),
        };
        projects.push(projectPayload);

        for (const task of activeTasks) {
          tableRows.push({
            project: root.id,
            task: task.id,
            status: task.status,
            'agent-id': task.agentId || '',
            'agent-role': task.agentRole || '',
            runtime: task.runtime || '',
            claimed: task.claimedAt || '',
          });
        }
      }

      if (args.json || deps.shouldUseJson()) {
        console.log(JSON.stringify({
          projects,
          totalProjects: projects.length,
          totalActiveTasks: projects.reduce((sum, project) => sum + project.activeTasks.length, 0),
          totalActiveAgents: projects.reduce((sum, project) => sum + project.activeAgents.length, 0),
        }, null, 2));
        return;
      }

      if (tableRows.length === 0) {
        console.log('No active task claims.');
        return;
      }
      console.log(deps.render(tableRows, { format: 'table', title: `Active task claims (${tableRows.length})` }));
    },
  });
}

module.exports = { createTasksActiveCommand };
