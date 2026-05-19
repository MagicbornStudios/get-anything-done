'use strict';
/**
 * lib/tasks-dedupe.cjs — detect & merge duplicate task entries.
 *
 * Problem: phase 245 surfaced "task-ID duplication" — a wave was given the
 * legacy short-form IDs (`245-07.json`) but registered new canonical IDs
 * (`GLOBAL-T-245-07.json`) and stamped those. Both task files exist; the
 * legacy ones stay `planned` forever while the canonical ones are `done`.
 * Curator pipelines + audits see both, and humans can't tell which is real.
 *
 * Strategy: group all task files by their **suffix** (`<phase>-<n>` part).
 * Canonical form (`<NS>-T-<suffix>`) is always preferred when both exist.
 *
 * Module pure — exports planning-dir level functions; CLI lives in
 * `bin/commands/tasks/dedupe.cjs`.
 */

const fs = require('fs');
const path = require('path');
const taskFiles = require('./task-files.cjs');

const CANONICAL_RE = /^([A-Z][A-Z0-9]*)-T-(.+)$/;

/**
 * Extract the "<phase>-<n>" suffix from a task id, regardless of canonical
 * or legacy form. Returns the original id unchanged if it doesn't match
 * the canonical pattern.
 */
function suffixOf(taskId) {
  const m = CANONICAL_RE.exec(String(taskId || ''));
  return m ? m[2] : String(taskId || '');
}

function isCanonical(taskId) {
  return CANONICAL_RE.test(String(taskId || ''));
}

function canonicalNamespace(taskId) {
  const m = CANONICAL_RE.exec(String(taskId || ''));
  return m ? m[1] : null;
}

/**
 * Group all tasks under <planningDir>/tasks/ by suffix. Returns only the
 * groups with >1 task (i.e. actual duplicates). Each group has:
 *   {
 *     suffix: "245-07",
 *     canonical: <task or null>,   // <NS>-T-<suffix>
 *     legacy: [<task>, ...],       // everything else with same suffix
 *     all: [<task>, ...],          // all members
 *   }
 */
function findDuplicateGroups(planningDir) {
  const tasks = taskFiles.listAll(planningDir);
  const bySuffix = new Map();
  for (const t of tasks) {
    const suffix = suffixOf(t.id);
    if (!bySuffix.has(suffix)) bySuffix.set(suffix, []);
    bySuffix.get(suffix).push(t);
  }

  const groups = [];
  for (const [suffix, members] of bySuffix) {
    if (members.length < 2) continue;
    // Canonical preferred = the one whose id matches `<NS>-T-<suffix>`.
    // If multiple namespaces are present (shouldn't happen but defensive),
    // pick the first canonical.
    const canonical = members.find((m) => isCanonical(m.id)) || null;
    const legacy = members.filter((m) => m !== canonical);
    groups.push({ suffix, canonical, legacy, all: members });
  }

  groups.sort((a, b) => a.suffix.localeCompare(b.suffix));
  return groups;
}

const TERMINAL_STATUSES = new Set(['done', 'cancelled']);
const STATUS_WEIGHT = { done: 4, 'in-progress': 3, planned: 2, cancelled: 1 };

function preferredStatus(...statuses) {
  let best = '';
  let bestWeight = -1;
  for (const s of statuses) {
    const w = STATUS_WEIGHT[s] ?? 0;
    if (w > bestWeight) {
      best = s;
      bestWeight = w;
    }
  }
  return best;
}

function unionFiles(...arrays) {
  const seen = new Set();
  const out = [];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const key = String(entry || '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

function pickNonEmpty(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

/**
 * Merge a duplicate group. Canonical wins on identity/attribution; legacy
 * contributes status (if better — i.e. legacy "done" beats canonical
 * "planned"), file-list (union), and goal/skill/runtime when canonical is
 * empty.
 *
 * Returns the merged Task (canonical-shaped, normalized).
 */
function mergeGroup(group) {
  if (!group.canonical) {
    // No canonical exists. We can't dedupe — only canonical is the
    // dedupe target. Return null to signal "skip".
    return null;
  }
  const c = group.canonical;
  const legacies = group.legacy;

  // Status: pick best across canonical + all legacies. Terminal beats
  // non-terminal; "done" beats anything else.
  const status = preferredStatus(c.status, ...legacies.map((t) => t.status));

  // Goal: prefer canonical; fall back to first legacy with non-empty goal.
  const goal = pickNonEmpty(c.goal, ...legacies.map((t) => t.goal));

  // Files: union of canonical + all legacy.
  const files = unionFiles(c.files, ...legacies.map((t) => t.files));

  // Attribution: prefer canonical's stamp UNLESS canonical is unstamped
  // (no agent_id) and a legacy has one (e.g. legacy was the real done).
  const agent_id = pickNonEmpty(c.agent_id, ...legacies.map((t) => t.agent_id));
  const agent_role = pickNonEmpty(c.agent_role, ...legacies.map((t) => t.agent_role));
  const runtime = pickNonEmpty(c.runtime, ...legacies.map((t) => t.runtime));
  const skill = pickNonEmpty(c.skill, ...legacies.map((t) => t.skill));
  const resolved_model = pickNonEmpty(c.resolved_model, ...legacies.map((t) => t.resolved_model));
  const model_profile = pickNonEmpty(c.model_profile, ...legacies.map((t) => t.model_profile));
  const resolution = pickNonEmpty(c.resolution, ...legacies.map((t) => t.resolution));
  const completed_at = pickNonEmpty(c.completed_at, ...legacies.map((t) => t.completed_at));

  // Created_at: earliest; updated_at: latest.
  const created_candidates = [c.created_at, ...legacies.map((t) => t.created_at)].filter(Boolean);
  const updated_candidates = [c.updated_at, ...legacies.map((t) => t.updated_at)].filter(Boolean);
  const created_at = created_candidates.length
    ? created_candidates.sort()[0]
    : c.created_at;
  const updated_at = updated_candidates.length
    ? updated_candidates.sort().reverse()[0]
    : c.updated_at;

  return {
    ...c,
    status,
    goal,
    files,
    agent_id,
    agent_role,
    runtime,
    skill,
    resolved_model,
    model_profile,
    resolution,
    completed_at,
    created_at,
    updated_at,
  };
}

/**
 * Diff summary for a group — fields where canonical and any legacy
 * differ. Used by the dry-run renderer.
 */
function describeDivergence(group) {
  if (!group.canonical) {
    return { canonical: null, legacies: group.legacy.map((t) => ({ id: t.id, status: t.status })) };
  }
  const c = group.canonical;
  const out = {
    canonical: { id: c.id, status: c.status, agent_id: c.agent_id, files: c.files.length },
    legacies: group.legacy.map((t) => ({
      id: t.id,
      status: t.status,
      agent_id: t.agent_id,
      files: t.files.length,
      status_differs: t.status !== c.status,
      attribution_differs: t.agent_id !== c.agent_id,
    })),
  };
  return out;
}

/**
 * Apply dedupe: for each group with a canonical, write the merged task to
 * canonical's path and DELETE the legacy files. Returns a report.
 */
function applyDedupe(planningDir, groups) {
  const report = { merged: [], skipped: [] };
  for (const group of groups) {
    if (!group.canonical) {
      report.skipped.push({ suffix: group.suffix, reason: 'no-canonical', members: group.all.map((t) => t.id) });
      continue;
    }
    const merged = mergeGroup(group);
    taskFiles.writeOne(planningDir, merged);
    const deleted = [];
    for (const legacy of group.legacy) {
      const ok = taskFiles.deleteOne(planningDir, legacy.id);
      if (ok) deleted.push(legacy.id);
    }
    report.merged.push({
      suffix: group.suffix,
      canonical: merged.id,
      status: merged.status,
      deleted,
    });
  }
  return report;
}

module.exports = {
  suffixOf,
  isCanonical,
  canonicalNamespace,
  findDuplicateGroups,
  mergeGroup,
  describeDivergence,
  applyDedupe,
  preferredStatus,
  unionFiles,
};
