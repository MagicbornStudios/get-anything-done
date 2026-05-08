'use strict';
/**
 * GAD Framework Discipline Scoring — rule library.
 *
 * Each exported rule function returns:
 *   { rule_id, weight, applies, score, evidence?, notes? }
 *
 * score is in [0.0, 1.0]. applies=false means the rule is not relevant for
 * this audit item and is excluded from the weighted average.
 *
 * Phase 123, task 123-01 — shipped 2026-05-07.
 */

// ---------------------------------------------------------------------------
// DOMAIN_MAP for rule_one_file_per_concern (simplified phase 129 hotspot map).
// Keys are lowercase path fragments; values are canonical domain slugs.
// ---------------------------------------------------------------------------
let DOMAIN_MAP;
try {
  DOMAIN_MAP = require('./hotspot-domain-map.cjs');
} catch (e) {
  if (e && e.code !== 'MODULE_NOT_FOUND') throw e;
  // Inline fallback — covers the most common domains present in this repo.
  DOMAIN_MAP = {
    // Planning infra
    '.planning': 'planning',
    'planning/tasks': 'planning',
    'planning/handoffs': 'planning',
    'planning/notes': 'planning',
    'planning/team': 'planning-team',
    // GAD vendor / framework
    'vendor/get-anything-done/lib': 'gad-lib',
    'vendor/get-anything-done/bin': 'gad-bin',
    'vendor/get-anything-done/site': 'gad-site',
    'vendor/get-anything-done/tests': 'gad-tests',
    // Platform app
    'apps/platform': 'app-platform',
    'apps/desktop': 'app-desktop',
    // Packages
    'packages/gad-tui': 'pkg-tui',
    'packages/visual-context': 'pkg-visual-context',
    'packages/gad-ui': 'pkg-gad-ui',
    // Config / root
    '.opencode': 'config',
    '.agents': 'config',
    'pnpm-lock': 'config',
    'package.json': 'config',
    'tsconfig': 'config',
    // Tests
    'tests/': 'tests',
    '.test.': 'tests',
    '.spec.': 'tests',
    // Docs
    'docs/': 'docs',
    'references/': 'docs',
    '.md': 'docs',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function domainForPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  // Longest-match wins
  let best = null;
  let bestLen = 0;
  for (const [fragment, domain] of Object.entries(DOMAIN_MAP)) {
    if (normalized.includes(fragment.toLowerCase()) && fragment.length > bestLen) {
      best = domain;
      bestLen = fragment.length;
    }
  }
  return best || 'unknown';
}

function safeScore(value, fallback = 0) {
  if (typeof value !== 'number' || !isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

// ---------------------------------------------------------------------------
// Rule 1: SITREP format
//
// Resolution body must contain "SITREP" header AND a gaps/open section.
// ---------------------------------------------------------------------------

/**
 * @param {{ body?: string, resolution?: string }} handoffResolution
 *   Accepts either the raw body (from .md front-matter body) or a resolution
 *   field from a task.json. Both are checked.
 * @returns {{ rule_id, weight, applies, score, evidence?, notes? }}
 */
function rule_sitrep_format(handoffResolution) {
  const rule_id = 'sitrep_format';
  const weight = 1.0;

  if (!handoffResolution || typeof handoffResolution !== 'object') {
    return { rule_id, weight, applies: false, score: 0, notes: 'No handoff data provided' };
  }

  const body = String(handoffResolution.body || handoffResolution.resolution || '');
  if (!body.trim()) {
    return { rule_id, weight, applies: false, score: 0, notes: 'Empty resolution body' };
  }

  const hasSitrep = /\bSITREP\b/i.test(body);
  // Accept "## Gaps", "## Open", "Gaps:", "GAPS", or a line starting with "Gaps"
  const hasGaps = /(?:^|\n)(?:#{1,4}\s+)?(?:gaps|open)(?:\s*:|$)/im.test(body);

  const score = hasSitrep && hasGaps ? 1.0 : hasSitrep || hasGaps ? 0.5 : 0.0;
  const evidence = [];
  if (!hasSitrep) evidence.push('missing SITREP header');
  if (!hasGaps) evidence.push('missing Gaps/Open section');

  return {
    rule_id,
    weight,
    applies: true,
    score,
    evidence: evidence.length ? evidence.join('; ') : 'SITREP + Gaps sections present',
    notes: hasSitrep && hasGaps ? 'Fully compliant' : `Partial: ${evidence.join(', ')}`,
  };
}

// ---------------------------------------------------------------------------
// Rule 2: Standing skills check
//
// For worker logs that touched UI paths, did the worker invoke all three
// standing skills before the first edit?
// ---------------------------------------------------------------------------

const STANDING_SKILLS = [
  'frontend-design',
  'web-design-guidelines',
  'gad-visual-context-system',
];

const UI_PATH_PATTERNS = [
  /\.tsx$/i,
  /\.css$/i,
  /\/components\//i,
  /\/app\//i,
  /\\components\\/i,
  /\\app\\/i,
];

function isUiPath(filePath) {
  return UI_PATH_PATTERNS.some((re) => re.test(filePath));
}

/**
 * @param {Array<{kind: string, ts: string, data?: string, [k: string]: any}>} workerLog
 *   Parsed .jsonl log entries for the worker.
 * @param {string[]} fileEdits
 *   List of file paths touched during the run.
 * @returns {{ rule_id, weight, applies, score, evidence?, notes? }}
 */
function rule_standing_skills(workerLog, fileEdits) {
  const rule_id = 'standing_skills';
  const weight = 1.2; // Slightly higher weight — safety-critical for UI

  const edits = Array.isArray(fileEdits) ? fileEdits : [];
  const log = Array.isArray(workerLog) ? workerLog : [];

  const uiEdits = edits.filter(isUiPath);
  if (uiEdits.length === 0) {
    return { rule_id, weight, applies: false, score: 0, notes: 'No UI paths touched; rule not applicable' };
  }

  if (log.length === 0) {
    return {
      rule_id, weight, applies: true, score: 0,
      notes: 'UI edits present but no worker log available; cannot verify skill loading',
      evidence: `UI files: ${uiEdits.join(', ')}`,
    };
  }

  // Find timestamp of first UI-related edit in log
  // Look for subproc-stdout/data entries containing file paths, or work-start
  const firstEditEntry = log.find((e) =>
    (e.kind === 'tool-use' || e.kind === 'edit' || e.kind === 'write') &&
    edits.some((f) => (e.file || e.path || e.data || '').includes(f))
  ) || log.find((e) => e.kind === 'work-start');

  const firstEditTs = firstEditEntry ? new Date(firstEditEntry.ts).getTime() : Infinity;

  // Scan for skill invocations before the first edit
  const invokedBefore = new Set();
  for (const entry of log) {
    const entryTs = new Date(entry.ts).getTime();
    if (entryTs >= firstEditTs) break;
    // Skill invocations appear as skill-load, skill-invoke, or in subproc-stderr/data
    const raw = JSON.stringify(entry).toLowerCase();
    for (const skill of STANDING_SKILLS) {
      if (raw.includes(skill.toLowerCase())) {
        invokedBefore.add(skill);
      }
    }
  }

  const missing = STANDING_SKILLS.filter((s) => !invokedBefore.has(s));
  const score = missing.length === 0 ? 1.0 : missing.length === 1 ? 0.5 : missing.length === 2 ? 0.25 : 0.0;

  return {
    rule_id,
    weight,
    applies: true,
    score: safeScore(score),
    evidence: missing.length
      ? `Missing skills before first UI edit: ${missing.join(', ')}`
      : 'All 3 standing skills invoked before first UI edit',
    notes: `UI files: ${uiEdits.slice(0, 3).join(', ')}${uiEdits.length > 3 ? '...' : ''}`,
  };
}

// ---------------------------------------------------------------------------
// Rule 3: Token economy
//
// Worker stayed within the handoff's estimated_context tier.
// Tier baselines (rough approximation by tier name):
//   quick   → 8k tokens
//   light   → 32k tokens
//   medium  → 64k tokens
//   heavy   → 128k tokens
//   reasoning → 200k tokens
//   deep    → 400k tokens
// Score 0 if actual > 2× tier baseline.
// ---------------------------------------------------------------------------

const TIER_BASELINES = {
  quick: 8_000,
  light: 32_000,
  medium: 64_000,
  heavy: 128_000,
  reasoning: 200_000,
  deep: 400_000,
};

/**
 * @param {{ tier?: string, estimated_context?: string, total_tokens?: number, input_tokens?: number, output_tokens?: number }} workerRunStats
 * @returns {{ rule_id, weight, applies, score, evidence?, notes? }}
 */
function rule_token_economy(workerRunStats) {
  const rule_id = 'token_economy';
  const weight = 0.8;

  if (!workerRunStats || typeof workerRunStats !== 'object') {
    return { rule_id, weight, applies: false, score: 0, notes: 'No run stats provided' };
  }

  const tierKey = String(
    workerRunStats.tier || workerRunStats.estimated_context || ''
  ).toLowerCase().trim();

  if (!tierKey || !TIER_BASELINES[tierKey]) {
    return { rule_id, weight, applies: false, score: 0, notes: `Unknown or missing tier: "${tierKey}"` };
  }

  const totalTokens =
    (workerRunStats.total_tokens || 0) ||
    ((workerRunStats.input_tokens || 0) + (workerRunStats.output_tokens || 0));

  if (!totalTokens) {
    return { rule_id, weight, applies: false, score: 0, notes: 'No token usage data available' };
  }

  const baseline = TIER_BASELINES[tierKey];
  const ratio = totalTokens / baseline;

  let score;
  if (ratio <= 1.0) score = 1.0;
  else if (ratio <= 1.5) score = 0.75;
  else if (ratio <= 2.0) score = 0.5;
  else score = 0.0;

  return {
    rule_id,
    weight,
    applies: true,
    score: safeScore(score),
    evidence: `Tier="${tierKey}" baseline=${baseline}, actual=${totalTokens} (ratio=${ratio.toFixed(2)}x)`,
    notes: score === 0 ? 'Exceeded 2× tier baseline — context discipline failure' : 'Within budget',
  };
}

// ---------------------------------------------------------------------------
// Rule 4: Commit attribution
//
// task.json agent_id, runtime, and skill must all be populated (not "unknown").
// ---------------------------------------------------------------------------

/**
 * @param {string} taskJsonPath  Absolute path to the task JSON file.
 * @returns {{ rule_id, weight, applies, score, evidence?, notes? }}
 */
function rule_commit_attribution(taskJsonPath) {
  const rule_id = 'commit_attribution';
  const weight = 1.0;
  const fs = require('fs');

  if (!taskJsonPath) {
    return { rule_id, weight, applies: false, score: 0, notes: 'No taskJsonPath provided' };
  }

  let task;
  try {
    task = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
  } catch (e) {
    return { rule_id, weight, applies: false, score: 0, notes: `Cannot read task JSON: ${e.message}` };
  }

  const fields = ['agent_id', 'runtime', 'skill'];
  const UNKNOWN_VALUES = new Set(['', 'unknown', 'unknown-agent', null, undefined]);

  const missing = fields.filter((f) => UNKNOWN_VALUES.has(task[f]));

  const score = missing.length === 0 ? 1.0 : missing.length === 1 ? 0.5 : missing.length === 2 ? 0.25 : 0.0;

  return {
    rule_id,
    weight,
    applies: true,
    score: safeScore(score),
    evidence: missing.length
      ? `Missing/unknown: ${missing.map((f) => `${f}="${task[f] || ''}"`).join(', ')}`
      : `agent_id="${task.agent_id}", runtime="${task.runtime}", skill="${task.skill}"`,
    notes: missing.length === 0 ? 'Full attribution' : `${missing.length} attribution field(s) missing`,
  };
}

// ---------------------------------------------------------------------------
// Rule 5: One file per concern
//
// Diff touches files in >2 distinct domains → score 0.
// 1 domain → 1.0, 2 domains → 0.5, 3+ → 0.0.
// ---------------------------------------------------------------------------

/**
 * @param {{ files?: string[], raw?: string }} commitDiff
 *   files: array of file paths touched. raw: raw diff output (fallback for parsing).
 * @returns {{ rule_id, weight, applies, score, evidence?, notes? }}
 */
function rule_one_file_per_concern(commitDiff) {
  const rule_id = 'one_file_per_concern';
  const weight = 0.9;

  if (!commitDiff || typeof commitDiff !== 'object') {
    return { rule_id, weight, applies: false, score: 0, notes: 'No diff data provided' };
  }

  let files = commitDiff.files || [];

  // If files not provided, try to parse from raw diff
  if (!files.length && commitDiff.raw) {
    const matches = commitDiff.raw.match(/^(?:diff --git a\/.+? b\/(.+)|[+]{3} b\/(.+))$/gm) || [];
    files = [...new Set(
      matches.map((l) => {
        const m = l.match(/b\/(.+)$/);
        return m ? m[1].trim() : null;
      }).filter(Boolean)
    )];
  }

  if (!files.length) {
    return { rule_id, weight, applies: false, score: 0, notes: 'No file list available' };
  }

  const domains = new Set(files.map(domainForPath));
  // Remove 'unknown' from count if there are known domains (avoid inflating domain count)
  const knownDomains = new Set([...domains].filter((d) => d !== 'unknown'));
  const domainCount = knownDomains.size || domains.size;

  let score;
  if (domainCount <= 1) score = 1.0;
  else if (domainCount === 2) score = 0.5;
  else score = 0.0;

  return {
    rule_id,
    weight,
    applies: true,
    score: safeScore(score),
    evidence: `${domainCount} domain(s): ${[...knownDomains].join(', ')} — ${files.length} file(s)`,
    notes: domainCount <= 1 ? 'Single-concern commit' : domainCount === 2 ? 'Two-domain commit (borderline)' : 'Cross-cutting commit — concern mixing',
  };
}

// ---------------------------------------------------------------------------
// Rule 6: Free-tier verification
//
// If worker was on a free-tier lane, output must be reviewed by a paid lane
// (follow-up commit from paid runtime touching same files within 24h).
// ---------------------------------------------------------------------------

const FREE_TIER_RUNTIMES = new Set(['codex-free', 'gemini-free', 'opencode-free', 'free']);
const PAID_RUNTIMES = new Set(['claude-code', 'codex-cli', 'gemini-cli', 'opencode', 'claude']);

/**
 * @param {{
 *   runtime?: string,
 *   files?: string[],
 *   finished_at?: string,
 *   follow_up_commits?: Array<{ runtime?: string, files?: string[], committed_at?: string }>
 * }} workerRunMetadata
 * @returns {{ rule_id, weight, applies, score, evidence?, notes? }}
 */
function rule_free_tier_verification(workerRunMetadata) {
  const rule_id = 'free_tier_verification';
  const weight = 1.1;

  if (!workerRunMetadata || typeof workerRunMetadata !== 'object') {
    return { rule_id, weight, applies: false, score: 0, notes: 'No run metadata provided' };
  }

  const runtime = String(workerRunMetadata.runtime || '').toLowerCase();
  const isFree = FREE_TIER_RUNTIMES.has(runtime) || runtime.includes('free');

  if (!isFree) {
    return { rule_id, weight, applies: false, score: 0, notes: `Runtime "${runtime}" is not free-tier; rule not applicable` };
  }

  // Free tier confirmed — check for paid-lane follow-up
  const files = workerRunMetadata.files || [];
  const finishedAt = workerRunMetadata.finished_at ? new Date(workerRunMetadata.finished_at).getTime() : null;
  const followUps = Array.isArray(workerRunMetadata.follow_up_commits)
    ? workerRunMetadata.follow_up_commits
    : [];

  const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

  const review = followUps.find((c) => {
    const cRuntime = String(c.runtime || '').toLowerCase();
    const isPaid = PAID_RUNTIMES.has(cRuntime) || (!cRuntime.includes('free') && cRuntime.length > 0);
    if (!isPaid) return false;

    // Check time window
    if (finishedAt && c.committed_at) {
      const cTs = new Date(c.committed_at).getTime();
      if (cTs - finishedAt > WINDOW_MS) return false;
    }

    // Check file overlap
    if (files.length && c.files && c.files.length) {
      const cFiles = new Set(c.files);
      return files.some((f) => cFiles.has(f));
    }
    // If no file info, accept any paid-lane commit within window
    return true;
  });

  if (review) {
    return {
      rule_id, weight, applies: true, score: 1.0,
      evidence: `Reviewed by ${review.runtime} at ${review.committed_at}`,
      notes: 'Free-tier output verified by paid lane',
    };
  }

  return {
    rule_id, weight, applies: true, score: 0.0,
    evidence: `Free-tier runtime "${runtime}" — no paid-lane follow-up found within 24h`,
    notes: 'Free-tier policy requires paid-lane review; none detected',
  };
}

// ---------------------------------------------------------------------------
// Rule metadata (for `gad discipline rules` listing)
// ---------------------------------------------------------------------------

const RULE_META = [
  {
    rule_id: 'sitrep_format',
    weight: 1.0,
    fn: rule_sitrep_format,
    description: 'Resolution body must contain "SITREP" header AND a Gaps/Open section. Close with gaps discipline.',
    input: 'handoffResolution: { body?, resolution? }',
  },
  {
    rule_id: 'standing_skills',
    weight: 1.2,
    fn: rule_standing_skills,
    description: 'For worker logs that touched .tsx/.css/components/app paths, all 3 standing skills (frontend-design, web-design-guidelines, gad-visual-context-system) must be invoked before the first edit.',
    input: 'workerLog: Array<{kind, ts, ...}>, fileEdits: string[]',
  },
  {
    rule_id: 'token_economy',
    weight: 0.8,
    fn: rule_token_economy,
    description: 'Worker stayed within the handoff estimated_context tier. Score 0 if actual total tokens > 2× tier baseline.',
    input: 'workerRunStats: { tier|estimated_context, total_tokens?, input_tokens?, output_tokens? }',
  },
  {
    rule_id: 'commit_attribution',
    weight: 1.0,
    fn: rule_commit_attribution,
    description: 'Task JSON agent_id, runtime, and skill must all be populated (not blank/unknown).',
    input: 'taskJsonPath: string (absolute path to .planning/tasks/<id>.json)',
  },
  {
    rule_id: 'one_file_per_concern',
    weight: 0.9,
    fn: rule_one_file_per_concern,
    description: 'Commit diff touches ≤1 domain → 1.0, 2 domains → 0.5, 3+ domains → 0.0. Domain map covers planning/gad/platform/packages/config.',
    input: 'commitDiff: { files?: string[], raw?: string }',
  },
  {
    rule_id: 'free_tier_verification',
    weight: 1.1,
    fn: rule_free_tier_verification,
    description: 'Free-tier worker output must be reviewed by a paid-lane runtime touching the same files within 24h. Applies only to free-tier runtimes.',
    input: 'workerRunMetadata: { runtime, files?, finished_at?, follow_up_commits? }',
  },
];

module.exports = {
  rule_sitrep_format,
  rule_standing_skills,
  rule_token_economy,
  rule_commit_attribution,
  rule_one_file_per_concern,
  rule_free_tier_verification,
  RULE_META,
  TIER_BASELINES,
  STANDING_SKILLS,
  domainForPath,
};
