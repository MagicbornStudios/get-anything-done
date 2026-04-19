'use strict';
/**
 * gad tasks — show, claim, release, add, update, promote, and inspect tasks
 *
 * Required deps: outputError, resolveSingleTaskRoot, readTasks,
 *   resolveSnapshotAgentInputs, resolveSnapshotRuntime, ensureAgentLane,
 *   detectRuntimeSessionId, claimTask, addTaskClaim, nowIso, maybeRebuildGraph,
 *   shouldUseJson, releaseTask, removeTaskClaim, RAW_ARGV, getRuntimeArg,
 *   readRawFlagValue, SENTINEL_SKILL_VALUES, findRepoRoot, gadConfig,
 *   resolveRoots, listAgentLanes, simplifyAgentLane, render, runTasksListView
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createTasksCommand(deps) {
  const {
    outputError, resolveSingleTaskRoot, readTasks,
    resolveSnapshotAgentInputs, resolveSnapshotRuntime, ensureAgentLane,
    detectRuntimeSessionId, claimTask, addTaskClaim, nowIso, maybeRebuildGraph,
    shouldUseJson, releaseTask, removeTaskClaim, RAW_ARGV, getRuntimeArg,
    readRawFlagValue, SENTINEL_SKILL_VALUES, findRepoRoot, gadConfig,
    resolveRoots, listAgentLanes, simplifyAgentLane, render, runTasksListView,
  } = deps;

  const claim = defineCommand({
    meta: { name: 'claim', description: 'Claim a task for an active agent lane' },
    args: {
      task: { type: 'positional', description: 'Task ID (e.g. 41-02)', required: true },
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      agentid: { type: 'string', description: 'Existing agent id to reuse', default: '' },
      role: { type: 'string', description: 'Logical agent role for auto-registration', default: '' },
      runtime: { type: 'string', description: 'Runtime identity override', default: '' },
      'parent-agentid': { type: 'string', description: 'Parent agent id for spawned subagents', default: '' },
      'model-profile': { type: 'string', description: 'Model profile attached to the lane', default: '' },
      'resolved-model': { type: 'string', description: 'Resolved model attached to the lane', default: '' },
      'lease-minutes': { type: 'string', description: 'Optional soft lease duration in minutes', default: '0' },
      force: { type: 'boolean', description: 'Steal a task already claimed by another lane', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const { baseDir, root } = resolveSingleTaskRoot(args.projectid);
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const allTasks = readTasks(root, baseDir, {});
      const task = allTasks.find((row) => row.id === args.task);
      if (!task) outputError(`Task not found: ${args.task}`);
      if (task.status === 'done') outputError(`Task ${args.task} is already done and cannot be claimed.`);
      if (task.agentId && task.agentId !== (args.agentid || process.env.GAD_AGENT_ID || '') && !args.force) {
        outputError(`Task ${args.task} is already claimed by ${task.agentId}. Re-run with --force to take it over.`);
      }

      const agentInputs = resolveSnapshotAgentInputs(args);
      const runtimeIdentity = resolveSnapshotRuntime(args.runtime, { humanFallback: true });
      const leaseMinutes = Math.max(0, parseInt(args['lease-minutes'], 10) || 0);
      const leaseExpiresAt = leaseMinutes > 0
        ? new Date(Date.now() + (leaseMinutes * 60 * 1000)).toISOString()
        : null;
      let agentBootstrap;
      try {
        agentBootstrap = ensureAgentLane(planDir, {
          requestedAgentId: agentInputs.requestedAgentId,
          role: agentInputs.role,
          runtime: runtimeIdentity.id,
          runtimeSessionId: detectRuntimeSessionId(),
          parentAgentId: agentInputs.parentAgentId,
          modelProfile: agentInputs.modelProfile,
          resolvedModel: agentInputs.resolvedModel || runtimeIdentity.model || null,
          leaseExpiresAt,
        });
      } catch (error) {
        outputError(error && error.message ? error.message : String(error));
      }

      claimTask(planDir, task.id, {
        agentId: agentBootstrap.agent.agentId,
        agentRole: agentBootstrap.agent.agentRole,
        runtime: agentBootstrap.agent.runtime,
        modelProfile: agentBootstrap.agent.modelProfile,
        resolvedModel: agentBootstrap.agent.resolvedModel,
        claimedAt: nowIso(),
        leaseExpiresAt,
      });
      addTaskClaim(planDir, agentBootstrap.agent.agentId, task.id, task.phase);

      maybeRebuildGraph(baseDir, root);

      const updatedTask = readTasks(root, baseDir, {}).find((row) => row.id === task.id);
      const payload = {
        project: root.id,
        claimed: true,
        task: updatedTask,
        agent: {
          agentId: agentBootstrap.agent.agentId,
          agentRole: agentBootstrap.agent.agentRole,
          runtime: agentBootstrap.agent.runtime,
          parentAgentId: agentBootstrap.agent.parentAgentId || null,
          rootAgentId: agentBootstrap.agent.rootAgentId || agentBootstrap.agent.agentId,
          depth: agentBootstrap.agent.depth,
          modelProfile: agentBootstrap.agent.modelProfile || null,
          resolvedModel: agentBootstrap.agent.resolvedModel || null,
        },
        force: args.force === true,
      };

      if (args.json || shouldUseJson()) { console.log(JSON.stringify(payload, null, 2)); return; }
      console.log(`Claimed ${task.id} for ${agentBootstrap.agent.agentId} (${agentBootstrap.agent.runtime}).`);
    },
  });

  const release = defineCommand({
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
      const { baseDir, root } = resolveSingleTaskRoot(args.projectid);
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const allTasks = readTasks(root, baseDir, {});
      const task = allTasks.find((row) => row.id === args.task);
      if (!task) outputError(`Task not found: ${args.task}`);

      const actingAgentId = String(args.agentid || process.env.GAD_AGENT_ID || task.agentId || '').trim();
      if (task.agentId && actingAgentId && task.agentId !== actingAgentId && !args.force) {
        outputError(`Task ${args.task} is claimed by ${task.agentId}. Re-run with --force to release it anyway.`);
      }

      const releaseOptions = { done: args.done === true, status: args.status || 'planned' };
      const rawSkillMatch = RAW_ARGV.join(' ').match(/--skill(?:=|\s+)([^\s]+)/);
      const explicitNoSkill = RAW_ARGV.includes('--no-skill') || getRuntimeArg(args, 'no-skill', false) === true;
      const skillAttribution = String(args.skill || readRawFlagValue('--skill') || (rawSkillMatch ? rawSkillMatch[1] : '') || '').trim();
      if (explicitNoSkill) {
        releaseOptions.skill = '';
      } else if (skillAttribution) {
        if (SENTINEL_SKILL_VALUES.has(skillAttribution.toLowerCase())) {
          outputError(
            `skill="${skillAttribution}" is a placeholder, not a real skill. Either:\n` +
            '  - Pass a real skill id (gad skill list shows valid options)\n' +
            '  - Pass --no-skill if no skill was used'
          );
        }
        releaseOptions.skill = skillAttribution;
      }
      releaseTask(planDir, task.id, releaseOptions);
      if (actingAgentId) {
        removeTaskClaim(
          planDir,
          actingAgentId,
          task.id,
          task.phase,
          getRuntimeArg(args, 'release-agent', false) === true || args.done === true,
        );
      }

      maybeRebuildGraph(baseDir, root);

      const updatedTask = readTasks(root, baseDir, {}).find((row) => row.id === task.id);
      const payload = {
        project: root.id,
        released: true,
        task: updatedTask,
        agentId: actingAgentId || null,
        done: args.done === true,
      };

      if (args.json || shouldUseJson()) { console.log(JSON.stringify(payload, null, 2)); return; }
      console.log(`${args.done ? 'Completed' : 'Released'} ${task.id}${actingAgentId ? ` from ${actingAgentId}` : ''}.`);
    },
  });

  const active = defineCommand({
    meta: { name: 'active', description: 'List active claimed tasks and agent lanes' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      all: { type: 'boolean', description: 'Show all configured projects', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      const projects = [];
      const tableRows = [];

      for (const root of roots) {
        const planDir = path.join(baseDir, root.path, root.planningDir);
        const tasks = readTasks(root, baseDir, {});
        const activeTasks = tasks.filter((task) => task.status !== 'done' && task.agentId);
        const lanes = listAgentLanes(planDir);
        const projectPayload = {
          project: root.id,
          activeTasks,
          activeAgents: lanes.activeAgents.map((agent) => simplifyAgentLane(agent, new Map(tasks.map((task) => [task.id, task])))),
          staleAgents: lanes.staleAgents.map((agent) => simplifyAgentLane(agent, new Map(tasks.map((task) => [task.id, task])))),
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

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify({
          projects,
          totalProjects: projects.length,
          totalActiveTasks: projects.reduce((sum, project) => sum + project.activeTasks.length, 0),
          totalActiveAgents: projects.reduce((sum, project) => sum + project.activeAgents.length, 0),
        }, null, 2));
        return;
      }

      if (tableRows.length === 0) { console.log('No active task claims.'); return; }
      console.log(render(tableRows, { format: 'table', title: `Active task claims (${tableRows.length})` }));
    },
  });

  const list = defineCommand({
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
    run({ args }) { runTasksListView(args); },
  });

  const add = defineCommand({
    meta: {
      name: 'add',
      description: 'Register a new task in TASK-REGISTRY.xml. The canonical write path — no more hand-editing XML.',
    },
    args: {
      id: { type: 'positional', description: 'Task id (e.g. 60-05a)', required: true },
      projectid: { type: 'string', description: 'Project id whose TASK-REGISTRY.xml to write into', required: true },
      phase: { type: 'string', description: 'Existing phase id to nest under (must already exist in ROADMAP.xml)', required: true },
      goal: { type: 'string', description: 'One-sentence or longer description of the task outcome', required: true },
      type: { type: 'string', description: 'Optional category (code | site | design | migration | cleanup | framework | …)', default: '' },
      depends: { type: 'string', description: 'Comma-separated list of prerequisite task ids (no spaces)', default: '' },
      status: { type: 'string', description: 'Initial status (default: planned)', default: 'planned' },
      print: { type: 'boolean', description: 'Print the mutated XML to stdout instead of writing the file', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const root = config.roots.find((r) => r.id === args.projectid);
      if (!root) {
        outputError(`Project not found: ${args.projectid}. Run \`gad ls\` to see registered projects.`);
        process.exit(1);
        return;
      }
      const xmlPath = path.join(baseDir, root.path, root.planningDir, 'TASK-REGISTRY.xml');
      if (!fs.existsSync(xmlPath)) { outputError(`TASK-REGISTRY.xml not found at ${xmlPath}`); process.exit(1); return; }
      const { appendTaskToFile, addTaskToXml, TaskWriterError } = require('../../lib/task-registry-writer.cjs');
      const def = {
        id: String(args.id), phase: String(args.phase), goal: String(args.goal),
        type: String(args.type || ''), depends: String(args.depends || ''),
        status: String(args.status || 'planned'),
      };
      try {
        if (args.print) {
          const xml = fs.readFileSync(xmlPath, 'utf8');
          const mutated = addTaskToXml(xml, def);
          process.stdout.write(mutated);
          return;
        }
        appendTaskToFile({ filePath: xmlPath, def });
        console.log(`Added task ${def.id} to phase ${def.phase} (${args.projectid}).`);
      } catch (e) {
        if (e instanceof TaskWriterError) { outputError(`${e.code}: ${e.message}`); process.exit(1); return; }
        throw e;
      }
    },
  });

  const promote = defineCommand({
    meta: {
      name: 'promote',
      description: 'Promote a .planning/todos/*.md file into a real task entry. Filename derives the id unless --id is set; first H1/prose line becomes the goal; full file body is preserved as the <implementation> block. Move the todo to .planning/todos/promoted/ after success unless --keep.',
    },
    args: {
      todo: { type: 'positional', description: 'Path to the todo markdown file (absolute or relative to cwd)', required: true },
      projectid: { type: 'string', description: 'Project id whose TASK-REGISTRY.xml to write into', required: true },
      phase: { type: 'string', description: 'Existing phase id to nest under', required: true },
      id: { type: 'string', description: 'Override the auto-derived task id', default: '' },
      type: { type: 'string', description: 'Optional category', default: '' },
      depends: { type: 'string', description: 'Comma-separated prerequisite task ids', default: '' },
      status: { type: 'string', description: 'Initial status (default: planned)', default: 'planned' },
      keep: { type: 'boolean', description: 'Do not move the todo into .planning/todos/promoted/', default: false },
      print: { type: 'boolean', description: 'Print the mutated XML without writing files', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const root = config.roots.find((r) => r.id === args.projectid);
      if (!root) { outputError(`Project not found: ${args.projectid}.`); process.exit(1); return; }
      const todoPath = path.isAbsolute(args.todo) ? args.todo : path.resolve(process.cwd(), args.todo);
      if (!fs.existsSync(todoPath)) { outputError(`Todo file not found: ${todoPath}`); process.exit(1); return; }
      const todoContent = fs.readFileSync(todoPath, 'utf8');

      const basename = path.basename(todoPath, '.md');
      const derivedId = args.id ? String(args.id) : basename.replace(/^\d{4}-\d{2}-\d{2}-/, '').slice(0, 80);

      const firstLine = todoContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 0 && !l.startsWith('---')) || '';
      const goal = firstLine.replace(/^#+\s*/, '').trim() || `Promoted from ${path.basename(todoPath)}`;

      const xmlPath = path.join(baseDir, root.path, root.planningDir, 'TASK-REGISTRY.xml');
      if (!fs.existsSync(xmlPath)) { outputError(`TASK-REGISTRY.xml not found at ${xmlPath}`); process.exit(1); return; }
      const { appendTaskToFile, addTaskToXml, TaskWriterError } = require('../../lib/task-registry-writer.cjs');
      const def = {
        id: derivedId, phase: String(args.phase), goal,
        type: String(args.type || ''), depends: String(args.depends || ''),
        status: String(args.status || 'planned'),
      };
      try {
        if (args.print) {
          const xml = fs.readFileSync(xmlPath, 'utf8');
          const mutated = addTaskToXml(xml, def);
          process.stdout.write(mutated);
          return;
        }
        appendTaskToFile({ filePath: xmlPath, def });
        console.log(`Promoted ${path.relative(baseDir, todoPath)} → task ${def.id} (phase ${def.phase}).`);
        if (!args.keep) {
          const promotedDir = path.join(path.dirname(todoPath), 'promoted');
          fs.mkdirSync(promotedDir, { recursive: true });
          const dest = path.join(promotedDir, path.basename(todoPath));
          fs.renameSync(todoPath, dest);
          console.log(`  moved → ${path.relative(baseDir, dest)}`);
        }
      } catch (e) {
        if (e instanceof TaskWriterError) { outputError(`${e.code}: ${e.message}`); process.exit(1); return; }
        throw e;
      }
    },
  });

  const update = defineCommand({
    meta: {
      name: 'update',
      description: 'Update task fields in TASK-REGISTRY.xml (currently supports --goal).',
    },
    args: {
      id: { type: 'positional', description: 'Task id to update (e.g. 63-06)', required: true },
      projectid: { type: 'string', description: 'Project id whose TASK-REGISTRY.xml to update', required: true },
      goal: { type: 'string', description: 'Replacement goal text for the task', default: '' },
      print: { type: 'boolean', description: 'Print the mutated XML to stdout instead of writing the file', default: false },
    },
    run({ args }) {
      if (!String(args.goal || '').trim()) { outputError('tasks update currently requires --goal <text>.'); process.exit(1); return; }

      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const root = config.roots.find((r) => r.id === args.projectid);
      if (!root) {
        outputError(`Project not found: ${args.projectid}. Run \`gad ls\` to see registered projects.`);
        process.exit(1);
        return;
      }
      const xmlPath = path.join(baseDir, root.path, root.planningDir, 'TASK-REGISTRY.xml');
      if (!fs.existsSync(xmlPath)) { outputError(`TASK-REGISTRY.xml not found at ${xmlPath}`); process.exit(1); return; }

      const { TaskWriterError, updateTaskGoalInXml, updateTaskGoalInFile } = require('../../lib/task-registry-writer.cjs');
      try {
        if (args.print) {
          const xml = fs.readFileSync(xmlPath, 'utf8');
          const mutated = updateTaskGoalInXml(xml, { id: String(args.id), goal: String(args.goal) });
          process.stdout.write(mutated);
          return;
        }
        updateTaskGoalInFile({ filePath: xmlPath, id: String(args.id), goal: String(args.goal) });
        console.log(`Updated task ${args.id} goal (${args.projectid}).`);
        maybeRebuildGraph(baseDir, root);
      } catch (e) {
        if (e instanceof TaskWriterError) { outputError(`${e.code}: ${e.message}`); process.exit(1); return; }
        throw e;
      }
    },
  });

  return defineCommand({
    meta: { name: 'tasks', description: 'Show, claim, release, add, update, promote, and inspect tasks' },
    subCommands: { list, claim, release, active, add, update, promote },
  });
}

module.exports = { createTasksCommand };
