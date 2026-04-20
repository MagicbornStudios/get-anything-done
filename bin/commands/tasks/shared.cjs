'use strict';

const path = require('path');

function resolveSingleTaskRoot(deps, projectid) {
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);
  const roots = deps.resolveRoots({ projectid }, baseDir, config.roots);
  if (roots.length === 0) {
    deps.outputError('No projects configured. Run `gad projects sync` first.');
  }
  return { baseDir, config, root: roots[0] };
}

function resolveProjectRootById(deps, projectid) {
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);
  const root = config.roots.find((entry) => entry.id === projectid);
  if (!root) {
    deps.outputError(`Project not found: ${projectid}. Run \`gad ls\` to see registered projects.`);
    process.exit(1);
    return null;
  }
  return { baseDir, config, root };
}

function runTasksListView(deps, args) {
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);

  let roots = config.roots;
  if (args.projectid) {
    roots = roots.filter((root) => root.id === args.projectid);
    if (roots.length === 0) {
      const ids = config.roots.map((root) => root.id);
      console.error(`\nProject not found: ${args.projectid}\n\nAvailable projects:\n`);
      for (const id of ids) console.error(`  ${id}`);
      console.error(`\nRerun with: --projectid ${ids[0]}`);
      process.exit(1);
    }
  }

  const filter = {};
  if (args.status) filter.status = args.status;
  if (args.phase) filter.phase = args.phase;

  const useGraph = args.graph || roots.some((root) => deps.graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path)));

  const rows = [];
  for (const root of roots) {
    if (useGraph) {
      const { graph } = deps.graphExtractor.loadOrBuildGraph(root, baseDir, { gadDir: deps.repoRoot });
      const query = { type: 'task' };
      if (filter.status) query.status = filter.status;
      if (filter.phase) query.phase = filter.phase;
      const result = deps.graphExtractor.queryGraph(graph, query);

      for (const match of result.matches) {
        const taskId = match.id.replace(/^task:/, '');
        const limit = args.full ? Infinity : 200;
        const goalText = match.goal || match.label || '';
        rows.push({
          project: root.id,
          id: deps.formatId(root.id, 'T', taskId),
          'legacy-id': taskId,
          goal: goalText.length > limit ? `${goalText.slice(0, limit - 1)}…` : goalText,
          status: match.status || '',
          phase: taskId.replace(/-\d+$/, ''),
          'agent-id': '',
          'agent-role': '',
          runtime: '',
        });
      }
      continue;
    }

    const tasks = deps.readTasks(root, baseDir, filter);
    for (const task of tasks) {
      const limit = args.full ? Infinity : 200;
      rows.push({
        project: root.id,
        id: deps.formatId(root.id, 'T', task.id),
        'legacy-id': task.id,
        goal: task.goal.length > limit ? `${task.goal.slice(0, limit - 1)}…` : task.goal,
        status: task.status,
        phase: task.phase,
        'agent-id': task.agentId || '',
        'agent-role': task.agentRole || '',
        runtime: task.runtime || '',
      });
    }
  }

  let filteredRows = rows;
  if (args.stalled) {
    filteredRows = rows.filter((row) => {
      const attributed = Boolean(
        (row['agent-id'] && String(row['agent-id']).trim()) ||
        (row['agent-role'] && String(row['agent-role']).trim()) ||
        (row.runtime && String(row.runtime).trim())
      );
      return row.status === 'in-progress' && !attributed;
    });
  }

  if (filteredRows.length === 0) {
    console.log(args.stalled ? 'No stalled tasks.' : 'No tasks found.');
    return;
  }

  const fmt = args.json ? 'json' : 'table';
  const modeLabel = useGraph ? ' (graph)' : '';
  const stalledLabel = args.stalled ? ' stalled' : '';
  console.log(deps.render(filteredRows, { format: fmt, title: `Tasks${stalledLabel}${modeLabel} (${filteredRows.length})` }));
}

module.exports = {
  resolveProjectRootById,
  resolveSingleTaskRoot,
  runTasksListView,
};
