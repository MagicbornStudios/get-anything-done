'use strict';
/**
 * lib/team/auto-commit.cjs — task-scoped auto-commit for completed handoffs.
 *
 * Periodically scans closed handoffs and creates one commit per completed
 * handoff once either:
 *   - N uncommitted handoffs have accumulated, or
 *   - the oldest pending handoff is older than T minutes.
 *
 * Safety rules:
 *   - stage ONLY explicit task files[] pathspecs
 *   - commit inside the owning git repo (submodule-aware)
 *   - optionally skip whitespace-only / formatting-only diffs
 *   - persist processed handoff ids in .planning/team/auto-commit-state.json
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const handoffs = require('../handoffs.cjs');
const taskFiles = require('../task-files.cjs');
const { readConfig } = require('./config.cjs');
const { readJsonSafe, writeJson } = require('./io.cjs');
const { teamRoot } = require('./paths.cjs');

const DEFAULT_MAX_HANDOFFS = 3;
const DEFAULT_MAX_AGE_MINUTES = 15;
const DEFAULT_COAUTHOR_NAME = 'GAD Team Worker';
const DEFAULT_COAUTHOR_EMAIL = 'noreply@get-anything-done.local';

function autoCommitStatePath(baseDir) {
  return path.join(teamRoot(baseDir), 'auto-commit-state.json');
}

function normalizeIso(ts, fallback = null) {
  if (!ts) return fallback;
  const parsed = Date.parse(ts);
  if (Number.isNaN(parsed)) return fallback;
  return new Date(parsed).toISOString();
}

function readState(baseDir) {
  const raw = readJsonSafe(autoCommitStatePath(baseDir), null);
  const handoffsState = raw && raw.handoffs && typeof raw.handoffs === 'object'
    ? raw.handoffs
    : {};
  return {
    last_commit_at: normalizeIso(raw && raw.last_commit_at, ''),
    handoffs: handoffsState,
  };
}

function writeState(baseDir, state) {
  writeJson(autoCommitStatePath(baseDir), {
    last_commit_at: state.last_commit_at || '',
    handoffs: state.handoffs || {},
  });
}

function resolveSettings(cfg) {
  const raw = cfg && cfg.auto_commit && typeof cfg.auto_commit === 'object'
    ? cfg.auto_commit
    : {};
  const maxCompletedHandoffs = Number(raw.max_completed_handoffs);
  const maxAgeMinutes = Number(raw.max_age_minutes);
  return {
    enabled: raw.enabled !== false,
    maxCompletedHandoffs: Number.isFinite(maxCompletedHandoffs) && maxCompletedHandoffs > 0
      ? maxCompletedHandoffs
      : DEFAULT_MAX_HANDOFFS,
    maxAgeMinutes: Number.isFinite(maxAgeMinutes) && maxAgeMinutes > 0
      ? maxAgeMinutes
      : DEFAULT_MAX_AGE_MINUTES,
    coauthorName: String(raw.coauthor_name || DEFAULT_COAUTHOR_NAME),
    coauthorEmail: String(raw.coauthor_email || DEFAULT_COAUTHOR_EMAIL),
  };
}

function currentProjectPlanningDir(baseDir) {
  return path.join(baseDir, '.planning');
}

function loadTaskForHandoff(baseDir, handoffRow) {
  const taskId = handoffRow && handoffRow.frontmatter && handoffRow.frontmatter.task_id;
  if (!taskId) return null;
  const planningDir = currentProjectPlanningDir(baseDir);
  return taskFiles.readOne(planningDir, taskId);
}

function normalizeGitPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function unique(values) {
  return [...new Set(values)];
}

function runGit(cwd, args, options = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function resolveRepoRoot(baseDir, repoRelativePath, gitRunner = runGit) {
  const absPath = path.resolve(baseDir, repoRelativePath);
  const cwd = fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()
    ? absPath
    : path.dirname(absPath);
  return gitRunner(cwd, ['rev-parse', '--show-toplevel']);
}

function groupFilesByRepo(baseDir, files, gitRunner = runGit) {
  const groups = new Map();
  for (const rawFile of files) {
    const relFile = normalizeGitPath(rawFile);
    if (!relFile) continue;
    let repoRoot;
    try {
      repoRoot = resolveRepoRoot(baseDir, relFile, gitRunner);
    } catch {
      continue;
    }
    const repoRel = normalizeGitPath(path.relative(repoRoot, path.resolve(baseDir, relFile)));
    if (!repoRel) continue;
    if (!groups.has(repoRoot)) groups.set(repoRoot, []);
    groups.get(repoRoot).push(repoRel);
  }
  return [...groups.entries()].map(([repoRoot, repoFiles]) => ({
    repoRoot,
    files: unique(repoFiles),
  }));
}

function listPendingClosedHandoffs(baseDir, state) {
  const closed = handoffs.listHandoffs({ baseDir, bucket: 'closed' });
  return closed
    .filter((row) => row.frontmatter && row.frontmatter.completed_at)
    .filter((row) => {
      const status = state.handoffs[row.id] && state.handoffs[row.id].status;
      return status !== 'committed' && status !== 'skipped-format-only' && status !== 'skipped-no-files';
    })
    .sort((a, b) => Date.parse(a.frontmatter.completed_at) - Date.parse(b.frontmatter.completed_at));
}

function shouldTriggerCommit(pending, settings, state, nowMs) {
  if (pending.length === 0) return { trigger: false, reason: 'no-pending-handoffs' };
  if (pending.length >= settings.maxCompletedHandoffs) {
    return { trigger: true, reason: 'count-threshold' };
  }
  const oldest = pending[0].frontmatter && pending[0].frontmatter.completed_at;
  const oldestMs = Date.parse(oldest || '');
  if (!Number.isNaN(oldestMs) && (nowMs - oldestMs) >= settings.maxAgeMinutes * 60_000) {
    return { trigger: true, reason: 'time-threshold' };
  }
  return { trigger: false, reason: 'below-thresholds' };
}

function stagePaths(repoRoot, files, gitRunner = runGit) {
  if (!files.length) return;
  gitRunner(repoRoot, ['add', '--', ...files]);
}

function listStagedFiles(repoRoot, files, gitRunner = runGit) {
  const out = gitRunner(repoRoot, ['diff', '--cached', '--name-only', '--', ...files]);
  return out ? out.split(/\r?\n/).map(normalizeGitPath).filter(Boolean) : [];
}

function isFormattingOnly(repoRoot, repoFile, gitRunner = runGit) {
  try {
    gitRunner(repoRoot, ['diff', '--cached', '--quiet', '--', repoFile]);
    return false;
  } catch (err) {
    try {
      gitRunner(repoRoot, ['diff', '--cached', '-w', '--quiet', '--', repoFile]);
      return true;
    } catch {
      return false;
    }
  }
}

function unstagePaths(repoRoot, files, gitRunner = runGit) {
  if (!files.length) return;
  try {
    gitRunner(repoRoot, ['reset', 'HEAD', '--', ...files]);
  } catch {
    // Best effort. If nothing was staged yet/reset already clean, carry on.
  }
}

function filterMeaningfulFiles(repoRoot, stagedFiles, gitRunner = runGit) {
  const keep = [];
  const skipped = [];
  for (const repoFile of stagedFiles) {
    if (isFormattingOnly(repoRoot, repoFile, gitRunner)) skipped.push(repoFile);
    else keep.push(repoFile);
  }
  return { keep, skipped };
}

function buildCommitMessage(handoffRow, task, settings) {
  const taskId = task && task.id ? task.id : ((handoffRow.frontmatter && handoffRow.frontmatter.task_id) || 'unknown-task');
  const handoffId = handoffRow.id;
  const lines = [
    `task(${taskId}): auto-commit completed handoff ${handoffId}`,
    '',
    `Co-Authored-By: ${settings.coauthorName} <${settings.coauthorEmail}>`,
  ];
  return lines.join('\n');
}

function commitOneHandoff(baseDir, handoffRow, task, settings, gitRunner = runGit) {
  const repoGroups = groupFilesByRepo(baseDir, task.files || [], gitRunner);
  if (repoGroups.length === 0) {
    return { status: 'skipped-no-files', commits: [], warning: 'No git-addressable files in task scope.' };
  }

  const commitMessage = buildCommitMessage(handoffRow, task, settings);
  const commits = [];

  for (const repoGroup of repoGroups) {
    stagePaths(repoGroup.repoRoot, repoGroup.files, gitRunner);
    let stagedFiles = listStagedFiles(repoGroup.repoRoot, repoGroup.files, gitRunner);
    if (stagedFiles.length === 0) {
      continue;
    }

    const { keep, skipped } = filterMeaningfulFiles(repoGroup.repoRoot, stagedFiles, gitRunner);
    if (skipped.length > 0) {
      unstagePaths(repoGroup.repoRoot, skipped, gitRunner);
      stagedFiles = keep.slice();
    }

    if (stagedFiles.length === 0) {
      continue;
    }

    let committed = false;
    let lastError = null;
    for (let attempt = 0; attempt < 2 && !committed; attempt++) {
      try {
        if (attempt > 0) {
          stagePaths(repoGroup.repoRoot, stagedFiles, gitRunner);
        }
        gitRunner(repoGroup.repoRoot, ['commit', '-m', commitMessage]);
        committed = true;
      } catch (err) {
        lastError = err;
      }
    }
    if (!committed) {
      throw lastError || new Error(`Failed to commit scoped files for ${handoffRow.id}`);
    }

    let sha = '';
    try {
      sha = gitRunner(repoGroup.repoRoot, ['rev-parse', 'HEAD']);
    } catch {}
    commits.push({
      repo_root: repoGroup.repoRoot,
      files: stagedFiles,
      commit_sha: sha,
    });
  }

  if (commits.length === 0) {
    return { status: 'skipped-format-only', commits: [], warning: 'Only formatting-only changes were found in task scope.' };
  }

  return { status: 'committed', commits };
}

function runAutoCommitTick(baseDir, opts = {}) {
  const cfg = opts.cfg || readConfig(baseDir) || {};
  const settings = resolveSettings(cfg);
  const state = opts.state || readState(baseDir);
  const nowMs = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();
  const logWrite = typeof opts.logWrite === 'function' ? opts.logWrite : null;
  const gitRunner = opts.gitRunner || runGit;

  if (!settings.enabled) {
    return { triggered: false, reason: 'disabled', pending: 0, processed: 0 };
  }

  const pending = listPendingClosedHandoffs(baseDir, state);
  const decision = shouldTriggerCommit(pending, settings, state, nowMs);
  if (!decision.trigger) {
    return { triggered: false, reason: decision.reason, pending: pending.length, processed: 0 };
  }

  const outcomes = [];
  for (const handoffRow of pending) {
    const task = loadTaskForHandoff(baseDir, handoffRow);
    if (!task || !Array.isArray(task.files) || task.files.length === 0) {
      state.handoffs[handoffRow.id] = {
        status: 'skipped-no-files',
        task_id: (handoffRow.frontmatter && handoffRow.frontmatter.task_id) || '',
        updated_at: new Date(nowMs).toISOString(),
      };
      outcomes.push({ handoff_id: handoffRow.id, status: 'skipped-no-files' });
      if (logWrite) logWrite({ kind: 'auto-commit-skip', ref: handoffRow.id, reason: 'no-task-files' });
      continue;
    }

    try {
      const result = commitOneHandoff(baseDir, handoffRow, task, settings, gitRunner);
      state.handoffs[handoffRow.id] = {
        status: result.status,
        task_id: task.id,
        updated_at: new Date(nowMs).toISOString(),
        commits: result.commits || [],
        warning: result.warning || '',
      };
      outcomes.push({ handoff_id: handoffRow.id, task_id: task.id, ...result });
      if (logWrite) {
        logWrite({
          kind: 'auto-commit-result',
          ref: handoffRow.id,
          task_id: task.id,
          status: result.status,
          repos: (result.commits || []).map((entry) => ({
            repo_root: entry.repo_root,
            files: entry.files,
            commit_sha: entry.commit_sha,
          })),
          warning: result.warning || '',
        });
      }
    } catch (err) {
      outcomes.push({
        handoff_id: handoffRow.id,
        task_id: task.id,
        status: 'error',
        error: err && err.message ? err.message : String(err),
      });
      if (logWrite) {
        logWrite({
          kind: 'auto-commit-error',
          ref: handoffRow.id,
          task_id: task.id,
          error: err && err.message ? err.message : String(err),
        });
      }
    }
  }

  const committedCount = outcomes.filter((row) => row.status === 'committed').length;
  if (committedCount > 0) {
    state.last_commit_at = new Date(nowMs).toISOString();
  }
  writeState(baseDir, state);

  return {
    triggered: true,
    reason: decision.reason,
    pending: pending.length,
    processed: outcomes.length,
    committed: committedCount,
    outcomes,
  };
}

module.exports = {
  DEFAULT_MAX_HANDOFFS,
  DEFAULT_MAX_AGE_MINUTES,
  autoCommitStatePath,
  readState,
  writeState,
  resolveSettings,
  listPendingClosedHandoffs,
  shouldTriggerCommit,
  groupFilesByRepo,
  buildCommitMessage,
  commitOneHandoff,
  runAutoCommitTick,
};
