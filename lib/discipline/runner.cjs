'use strict';
/**
 * GAD Discipline Scoring — runner.
 *
 * Exports scoreDiscipline({ projectid, sinceIso, scope }) which aggregates
 * rule scores across workers, teams, or the global project.
 *
 * Data sources (all local, gitignored runtime artifacts):
 *   worker logs  : .planning/team/workers/<id>/log.jsonl
 *   task JSON    : .planning/tasks/<id>.json
 *   gad-log      : .planning/.gad-log/<date>.jsonl
 *   commits      : git log --since=<since> --name-only
 *   handoffs     : .planning/handoffs/closed/*.md
 *
 * Missing data sources → rule returns applies:false (not penalised).
 *
 * Phase 123, task 123-01.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const {
  rule_sitrep_format,
  rule_standing_skills,
  rule_token_economy,
  rule_commit_attribution,
  rule_one_file_per_concern,
  rule_free_tier_verification,
  RULE_META,
} = require('./index.cjs');

// ---------------------------------------------------------------------------
// Helpers — data loaders
// ---------------------------------------------------------------------------

function findRepoRoot(startDir) {
  let dir = startDir || process.cwd();
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir || process.cwd();
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

function listWorkerIds(baseDir) {
  const workersDir = path.join(baseDir, '.planning', 'team', 'workers');
  if (!fs.existsSync(workersDir)) return [];
  try {
    return fs.readdirSync(workersDir)
      .filter((f) => /^w\d+$/.test(f))
      .sort();
  } catch { return []; }
}

function readWorkerLog(baseDir, workerId) {
  return readJsonl(path.join(baseDir, '.planning', 'team', 'workers', workerId, 'log.jsonl'));
}

function readWorkerStatus(baseDir, workerId) {
  const p = path.join(baseDir, '.planning', 'team', 'workers', workerId, 'status.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function listTaskJsonPaths(baseDir, sinceMs) {
  const tasksDir = path.join(baseDir, '.planning', 'tasks');
  if (!fs.existsSync(tasksDir)) return [];
  try {
    return fs.readdirSync(tasksDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const full = path.join(tasksDir, f);
        try {
          const st = fs.statSync(full);
          return sinceMs && st.mtimeMs < sinceMs ? null : full;
        } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

function listClosedHandoffs(baseDir, sinceMs) {
  const dir = path.join(baseDir, '.planning', 'handoffs', 'closed');
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const full = path.join(dir, f);
        try {
          const st = fs.statSync(full);
          if (sinceMs && st.mtimeMs < sinceMs) return null;
          const raw = fs.readFileSync(full, 'utf8');
          // Parse front-matter
          const fm = {};
          const body = raw.replace(/^---\n([\s\S]*?)\n---\n?/, (_, block) => {
            block.split('\n').forEach((line) => {
              const m = line.match(/^(\w[\w_-]*):\s*(.*)$/);
              if (m) fm[m[1].trim()] = m[2].trim();
            });
            return '';
          });
          return { path: full, fm, body: body.trim() };
        } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

/**
 * Parse git log output into commit objects with file lists.
 * Format: --format="%H %ae %s" --name-only
 */
function getGitCommits(baseDir, sinceIso) {
  try {
    const since = sinceIso ? `--since=${sinceIso}` : '--since=7 days ago';
    const raw = execSync(
      `git log ${since} --name-only --format="%H %ae %s"`,
      { cwd: baseDir, encoding: 'utf8', timeout: 10000 }
    );
    const commits = [];
    let current = null;
    for (const line of raw.split('\n')) {
      if (!line.trim()) {
        if (current) { commits.push(current); current = null; }
        continue;
      }
      if (/^[0-9a-f]{40} /.test(line)) {
        if (current) commits.push(current);
        const parts = line.split(' ');
        current = { sha: parts[0], author: parts[1] || '', subject: parts.slice(2).join(' '), files: [] };
      } else if (current) {
        current.files.push(line.trim());
      }
    }
    if (current) commits.push(current);
    return commits;
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Per-entity scoring — applies all relevant rules and computes weighted avg
// ---------------------------------------------------------------------------

/**
 * Score a single worker over the audit window.
 */
function scoreWorker(workerId, baseDir, sinceMs, commits) {
  const log = readWorkerLog(baseDir, workerId);
  const status = readWorkerStatus(baseDir, workerId);
  const runtime = status ? (status.runtime || '') : '';

  // Collect files touched by this worker from log + commits
  const workerFiles = new Set();
  for (const entry of log) {
    if (entry.ts && sinceMs && new Date(entry.ts).getTime() < sinceMs) continue;
    if (entry.file) workerFiles.add(entry.file);
    if (entry.path) workerFiles.add(entry.path);
  }

  // Closed handoffs processed by this worker
  const handoffs = listClosedHandoffs(baseDir, sinceMs);
  const workerHandoffs = handoffs.filter((h) =>
    h.fm.claimed_by === workerId || h.fm.worker === workerId
  );

  const results = [];

  // Rule: SITREP format — for each handoff this worker closed
  for (const h of workerHandoffs) {
    results.push(rule_sitrep_format({ body: h.body, resolution: h.body }));
  }
  if (workerHandoffs.length === 0) {
    // No handoffs → still emit applies:false entry so caller sees it
    results.push({ ...rule_sitrep_format({}), _no_handoffs: true });
  }

  // Rule: Standing skills
  results.push(rule_standing_skills(
    log.filter((e) => !sinceMs || new Date(e.ts).getTime() >= sinceMs),
    [...workerFiles]
  ));

  // Rule: Token economy — try to derive from log
  const lastEntry = log.filter((e) => e.total_tokens || e.input_tokens).slice(-1)[0];
  const tierEntry = workerHandoffs[0] ? workerHandoffs[0].fm : null;
  const runStats = lastEntry
    ? { tier: tierEntry ? tierEntry.estimated_context : null, ...lastEntry }
    : null;
  results.push(rule_token_economy(runStats));

  // Rule: Commit attribution — for each task associated via this worker's handoffs
  const taskIds = workerHandoffs.map((h) => h.fm.task_id).filter(Boolean);
  const taskPaths = listTaskJsonPaths(baseDir, sinceMs)
    .filter((p) => {
      const base = path.basename(p, '.json');
      return taskIds.includes(base) || taskIds.includes(`GLOBAL-T-${base}`);
    });
  if (taskPaths.length) {
    for (const tp of taskPaths) {
      results.push(rule_commit_attribution(tp));
    }
  } else {
    // Score all recently-updated tasks as fallback
    const recentTasks = listTaskJsonPaths(baseDir, sinceMs).slice(0, 5);
    for (const tp of recentTasks) {
      results.push(rule_commit_attribution(tp));
    }
  }

  // Rule: One file per concern — per commit by this worker's runtime
  const workerCommits = commits.filter((c) =>
    c.author && runtime && c.author.toLowerCase().includes(runtime.split('-')[0])
  );
  if (workerCommits.length) {
    for (const c of workerCommits) {
      results.push(rule_one_file_per_concern({ files: c.files }));
    }
  } else if (commits.length) {
    // No worker-attributed commits — use all commits
    for (const c of commits.slice(0, 10)) {
      results.push(rule_one_file_per_concern({ files: c.files }));
    }
  }

  // Rule: Free-tier verification
  const workerRunMeta = {
    runtime,
    files: [...workerFiles],
    finished_at: status ? status.last_heartbeat : null,
    follow_up_commits: commits.map((c) => ({ runtime: 'claude-code', files: c.files, committed_at: new Date().toISOString() })),
  };
  results.push(rule_free_tier_verification(workerRunMeta));

  return computeScore(workerId, results);
}

/**
 * Weighted average across applies=true rules.
 */
function computeScore(id, ruleResults) {
  const applied = ruleResults.filter((r) => r.applies);
  if (!applied.length) {
    return { id, score: null, rules: ruleResults };
  }
  const totalWeight = applied.reduce((s, r) => s + (r.weight || 1), 0);
  const weightedSum = applied.reduce((s, r) => s + (r.weight || 1) * r.score, 0);
  const score = totalWeight > 0 ? weightedSum / totalWeight : null;
  return { id, score: score !== null ? Math.round(score * 1000) / 1000 : null, rules: ruleResults };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * @param {{ projectid?: string, sinceIso?: string, scope?: 'worker'|'team'|'global', baseDir?: string }} opts
 * @returns {{
 *   scope: string,
 *   since: string,
 *   items: Array<{ id: string, score: number|null, rules: any[] }>,
 *   overall_score: number|null,
 *   rule_summary: Record<string, { applied_count: number, avg_score: number }>
 * }}
 */
function scoreDiscipline({ projectid, sinceIso, scope, baseDir: _baseDir } = {}) {
  const baseDir = _baseDir || findRepoRoot();
  scope = scope || 'global';

  // Normalise since
  let sinceMs = null;
  let normalizedSince = sinceIso || '';
  if (sinceIso) {
    if (/^\d+d$/.test(sinceIso)) {
      const days = parseInt(sinceIso, 10);
      sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
      normalizedSince = new Date(sinceMs).toISOString();
    } else {
      sinceMs = new Date(sinceIso).getTime();
      normalizedSince = sinceIso;
    }
  } else {
    // Default: last 7 days
    sinceMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    normalizedSince = new Date(sinceMs).toISOString();
  }

  const commits = getGitCommits(baseDir, normalizedSince);
  const items = [];

  if (scope === 'worker') {
    const workerIds = listWorkerIds(baseDir);
    for (const wid of workerIds) {
      items.push(scoreWorker(wid, baseDir, sinceMs, commits));
    }
  } else if (scope === 'team') {
    // Group workers by lane
    const workerIds = listWorkerIds(baseDir);
    const teams = {};
    for (const wid of workerIds) {
      const st = readWorkerStatus(baseDir, wid);
      const lane = st ? (st.lane || 'default') : 'default';
      if (!teams[lane]) teams[lane] = [];
      teams[lane].push(wid);
    }
    for (const [lane, wids] of Object.entries(teams)) {
      const teamResults = [];
      for (const wid of wids) {
        const ws = scoreWorker(wid, baseDir, sinceMs, commits);
        teamResults.push(...ws.rules);
      }
      items.push(computeScore(lane, teamResults));
    }
    if (items.length === 0) {
      // Fall through to global if no workers
      items.push(scoreGlobal(baseDir, sinceMs, commits));
    }
  } else {
    // global
    items.push(scoreGlobal(baseDir, sinceMs, commits));
  }

  // Overall score
  const scored = items.filter((i) => i.score !== null);
  const overall_score = scored.length
    ? Math.round((scored.reduce((s, i) => s + i.score, 0) / scored.length) * 1000) / 1000
    : null;

  // Rule summary
  const rule_summary = {};
  for (const item of items) {
    for (const r of item.rules || []) {
      if (!r.rule_id) continue;
      if (!rule_summary[r.rule_id]) {
        rule_summary[r.rule_id] = { applied_count: 0, total_score: 0, avg_score: 0 };
      }
      if (r.applies) {
        rule_summary[r.rule_id].applied_count++;
        rule_summary[r.rule_id].total_score += r.score;
      }
    }
  }
  for (const [, rs] of Object.entries(rule_summary)) {
    rs.avg_score = rs.applied_count > 0
      ? Math.round((rs.total_score / rs.applied_count) * 1000) / 1000
      : 0;
    delete rs.total_score;
  }

  return {
    scope,
    since: normalizedSince,
    items,
    overall_score,
    rule_summary,
  };
}

function scoreGlobal(baseDir, sinceMs, commits) {
  const allRules = [];

  // SITREP: all closed handoffs
  const handoffs = listClosedHandoffs(baseDir, sinceMs);
  for (const h of handoffs) {
    allRules.push(rule_sitrep_format({ body: h.body }));
  }
  if (!handoffs.length) allRules.push(rule_sitrep_format({}));

  // Standing skills: aggregate from all workers
  const workerIds = listWorkerIds(baseDir);
  for (const wid of workerIds) {
    const log = readWorkerLog(baseDir, wid);
    allRules.push(rule_standing_skills(
      log.filter((e) => !sinceMs || new Date(e.ts).getTime() >= sinceMs),
      []
    ));
  }

  // Token economy: no global aggregate (per-worker only)
  allRules.push(rule_token_economy(null));

  // Commit attribution: all recent tasks
  const taskPaths = listTaskJsonPaths(baseDir, sinceMs);
  for (const tp of taskPaths.slice(0, 20)) {
    allRules.push(rule_commit_attribution(tp));
  }
  if (!taskPaths.length) allRules.push(rule_commit_attribution(null));

  // One file per concern: all commits
  for (const c of commits.slice(0, 20)) {
    allRules.push(rule_one_file_per_concern({ files: c.files }));
  }
  if (!commits.length) allRules.push(rule_one_file_per_concern(null));

  // Free-tier verification: no global aggregate
  allRules.push(rule_free_tier_verification(null));

  return computeScore('global', allRules);
}

module.exports = { scoreDiscipline, RULE_META };
