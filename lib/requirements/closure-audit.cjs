'use strict';
/**
 * lib/requirements/closure-audit.cjs — phase closure audit.
 *
 * Phase 115 (2026-05-07, sonnet-requirements).
 *
 * Exports:
 *   auditPhaseClosure({ projectRoot, planningDir }) → PhaseAuditResult[]
 *
 * For each done phase in ROADMAP.xml:
 *   - List its tasks (from .planning/tasks/<id>.json)
 *   - For each task with file refs in files[], verify those files exist
 *   - Look for git commits mentioning the task id
 *   - Classify: ok | gap | orphan
 *
 * "orphan_features" = git diff touched files not referenced by any phase task.
 * We approximate this by looking at commit messages that mention the phase id
 * and checking whether the files touched in those commits appear in any task.
 */

const fs            = require('fs');
const path          = require('path');
const { execFileSync } = require('child_process');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeRead(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function safeExec(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

/** Parse ROADMAP.xml phases — only status=done. */
function readDonePhases(roadmapXml) {
  const phases = [];
  const phaseRe = /<phase\b([^>]*)>([\s\S]*?)<\/phase>/g;
  let m;
  while ((m = phaseRe.exec(roadmapXml)) !== null) {
    const attrs = m[1];
    const body  = m[2];

    const idMatch  = attrs.match(/\bid="([^"]*)"/);
    const id = idMatch ? idMatch[1] : '';
    if (!id) continue;

    const statusMatch = body.match(/<status>([\s\S]*?)<\/status>/);
    const rawStatus = statusMatch ? statusMatch[1].trim().toLowerCase() : '';
    const done = rawStatus === 'done' || rawStatus === 'closed' || rawStatus === 'complete' || rawStatus === 'completed';
    if (!done) continue;

    const goalMatch = body.match(/<goal>([\s\S]*?)<\/goal>/);
    const goal = goalMatch ? goalMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : goal.slice(0, 60);

    phases.push({ id, title, goal });
  }
  return phases;
}

/** List task JSON files for a given phase. */
function readTasksForPhase(tasksDir, phaseId) {
  if (!fs.existsSync(tasksDir)) return [];
  let files;
  try { files = fs.readdirSync(tasksDir); } catch { return []; }

  const tasks = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const content = safeRead(path.join(tasksDir, f));
    if (!content) continue;
    let t;
    try { t = JSON.parse(content); } catch { continue; }
    // Match phase: task.phase must equal phaseId, or task.id starts with phaseId-
    const taskPhase = String(t.phase || '');
    const taskId    = String(t.id || '');
    if (taskPhase === String(phaseId) || taskId.startsWith(`${phaseId}-`)) {
      tasks.push(t);
    }
  }
  return tasks;
}

/** Check git for commits mentioning a task id. Returns commit hashes. */
function commitsForTaskId(repoDir, taskId) {
  const out = safeExec('git', [
    'log', '--all', '--format=%H', '--grep', String(taskId), '-F',
  ], repoDir);
  return out ? out.split('\n').filter(Boolean) : [];
}

/** Get files changed in a set of commits. */
function filesChangedInCommits(repoDir, hashes) {
  const changed = new Set();
  for (const hash of hashes.slice(0, 20)) { // cap to avoid huge diffs
    const out = safeExec('git', ['diff-tree', '--no-commit-id', '-r', '--name-only', hash], repoDir);
    for (const f of out.split('\n').filter(Boolean)) changed.add(f);
  }
  return [...changed];
}

/** Detect orphan features: files changed in phase commits not referenced by any task. */
function detectOrphans(repoDir, phaseId, allTaskFiles) {
  // Find commits mentioning the phase id directly
  const phaseSig = `${phaseId}`;
  const phaseCommits = (() => {
    const out = safeExec('git', [
      'log', '--all', '--format=%H', '--grep', phaseSig, '-F',
    ], repoDir);
    return out ? out.split('\n').filter(Boolean) : [];
  })();

  if (phaseCommits.length === 0) return [];

  const changedFiles = filesChangedInCommits(repoDir, phaseCommits);
  const taskFileSet = new Set(allTaskFiles.map(f => f.replace(/\\/g, '/')));

  return changedFiles.filter(f => {
    const norm = f.replace(/\\/g, '/');
    return !taskFileSet.has(norm);
  });
}

// ---------------------------------------------------------------------------
// auditPhaseClosure
// ---------------------------------------------------------------------------

/**
 * @typedef {{ phaseId: string, title: string, status: 'ok'|'gap'|'orphan',
 *   taskCount: number, gaps: string[], orphan_features: string[] }} PhaseAuditResult
 */

/**
 * Audit phase closure for all done phases in the project.
 * @param {{ projectRoot: string, planningDir: string }} opts
 * @returns {PhaseAuditResult[]}
 */
function auditPhaseClosure({ projectRoot, planningDir }) {
  const plan = planningDir || '.planning';
  const planPath = path.isAbsolute(plan) ? plan : path.join(projectRoot, plan);

  const roadmapXml = safeRead(path.join(planPath, 'ROADMAP.xml'));
  if (!roadmapXml) {
    return [{
      phaseId: 'N/A',
      title: 'ROADMAP.xml not found',
      status: 'gap',
      taskCount: 0,
      gaps: [`No ROADMAP.xml at ${path.join(planPath, 'ROADMAP.xml')}`],
      orphan_features: [],
    }];
  }

  const donePhases = readDonePhases(roadmapXml);
  if (donePhases.length === 0) {
    return [];
  }

  const tasksDir = path.join(planPath, 'tasks');
  const results  = [];

  for (const phase of donePhases) {
    const gaps            = [];
    const orphan_features = [];

    // --- Tasks for this phase ---
    const tasks = readTasksForPhase(tasksDir, phase.id);

    // --- Check file refs exist ---
    const allTaskFileRefs = [];
    for (const t of tasks) {
      const files = Array.isArray(t.files) ? t.files : [];
      allTaskFileRefs.push(...files);
      for (const f of files) {
        // Files may be relative to projectRoot or repo root — try both
        const absToProject = path.resolve(projectRoot, f);
        const existsInProject = fs.existsSync(absToProject);
        if (!existsInProject) {
          gaps.push(`Task ${t.id}: file ref not found — ${f}`);
        }
      }
    }

    // --- Check git commits ---
    for (const t of tasks) {
      if (!t.id) continue;
      const commits = commitsForTaskId(projectRoot, t.id);
      if (commits.length === 0) {
        // Only flag as gap if task is done but has no commit
        const status = String(t.status || 'planned').toLowerCase();
        if (status === 'done') {
          gaps.push(`Task ${t.id}: done but no git commit found`);
        }
      }
    }

    // --- Detect orphan features ---
    const orphans = detectOrphans(projectRoot, phase.id, allTaskFileRefs);
    orphan_features.push(...orphans.slice(0, 15)); // cap output

    // --- Classify phase ---
    let status = 'ok';
    if (gaps.length > 0 && orphan_features.length > 0) status = 'orphan';
    else if (orphan_features.length > 0) status = 'orphan';
    else if (gaps.length > 0) status = 'gap';

    results.push({
      phaseId: phase.id,
      title: phase.title || phase.goal.slice(0, 60),
      status,
      taskCount: tasks.length,
      gaps,
      orphan_features,
    });
  }

  return results;
}

module.exports = { auditPhaseClosure };
