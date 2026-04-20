'use strict';

const path = require('path');
const { defineCommand } = require('citty');

function createTasksReleaseCommand(deps) {
  return defineCommand({
    meta: { name: 'release', description: 'Release a claimed task or mark it done' },
    args: {
      task: { type: 'positional', description: 'Task ID (e.g. 41-02)', required: true },
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      agentid: { type: 'string', description: 'Agent id performing the release', default: '' },
      status: { type: 'string', description: 'Status to apply when not using --done (default: planned)', default: '' },
      done: { type: 'boolean', description: 'Mark the task done and preserve attribution', default: false },
      skill: { type: 'string', description: 'Skill attribution to write when marking done', default: '' },
      'no-skill': { type: 'boolean', description: 'Explicitly mark the task done without a skill attribution', default: false },
      force: { type: 'boolean', description: 'Release even if task is owned by another lane', default: false },
      'release-agent': { type: 'boolean', description: 'Mark the lane released when it has no remaining claimed tasks', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const { baseDir, root } = deps.resolveSingleTaskRoot(deps, args.projectid);
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const allTasks = deps.readTasks(root, baseDir, {});
      const task = allTasks.find((row) => row.id === args.task);
      if (!task) deps.outputError(`Task not found: ${args.task}`);

      const actingAgentId = String(args.agentid || process.env.GAD_AGENT_ID || task.agentId || '').trim();
      if (task.agentId && actingAgentId && task.agentId !== actingAgentId && !args.force) {
        deps.outputError(`Task ${args.task} is claimed by ${task.agentId}. Re-run with --force to release it anyway.`);
      }

      const releaseOptions = { done: args.done === true, status: args.status || 'planned' };
      const rawSkillMatch = deps.RAW_ARGV.join(' ').match(/--skill(?:=|\s+)([^\s]+)/);
      const explicitNoSkill = deps.RAW_ARGV.includes('--no-skill') || deps.getRuntimeArg(args, 'no-skill', false) === true;
      const skillAttribution = String(args.skill || deps.readRawFlagValue('--skill') || (rawSkillMatch ? rawSkillMatch[1] : '') || '').trim();
      if (explicitNoSkill) {
        releaseOptions.skill = '';
      } else if (skillAttribution) {
        if (deps.SENTINEL_SKILL_VALUES.has(skillAttribution.toLowerCase())) {
          deps.outputError(
            `skill="${skillAttribution}" is a placeholder, not a real skill. Either:\n` +
            '  - Pass a real skill id (gad skill list shows valid options)\n' +
            '  - Pass --no-skill if no skill was used'
          );
        }
        releaseOptions.skill = skillAttribution;
      }

      deps.releaseTask(planDir, task.id, releaseOptions);
      if (actingAgentId) {
        deps.removeTaskClaim(
          planDir,
          actingAgentId,
          task.id,
          task.phase,
          deps.getRuntimeArg(args, 'release-agent', false) === true || args.done === true
        );
      }

      deps.maybeRebuildGraph(baseDir, root);

      const updatedTask = deps.readTasks(root, baseDir, {}).find((row) => row.id === task.id);
      const payload = {
        project: root.id,
        released: true,
        task: updatedTask,
        agentId: actingAgentId || null,
        done: args.done === true,
      };

      if (args.json || deps.shouldUseJson()) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }
      console.log(`${args.done ? 'Completed' : 'Released'} ${task.id}${actingAgentId ? ` from ${actingAgentId}` : ''}.`);
    },
  });
}

module.exports = { createTasksReleaseCommand };
