'use strict';
/**
 * lib/task-files.cjs — per-task JSON file layout.
 *
 * Decision 2026-04-20 D3 — migrate away from single-file TASK-REGISTRY.xml
 * to per-task JSON files under `<planningDir>/tasks/<task-id>.json`.
 * Eliminates the single-file multi-agent race class (same pattern handoffs
 * already use: one file per record → concurrent writes touch different
 * files → no clobber, no merge conflicts).
 *
 * Schema (canonical):
 *   {
 *     id:          "42.2-20",
 *     phase:       "42.2",
 *     status:      "planned" | "in-progress" | "done" | "cancelled",
 *     goal:        "…",
 *     type:        "code" | "site" | "design" | "migration" | "cleanup" | …,
 *     keywords:    "planning,scaffold",
 *     depends:     ["42.2-19"],
 *     commands:    ["gad …"],
 *     files:       ["path/to/file.cjs"],
 *     agent_id:    "" | "team-w1" (attribution stamp, set on completion),
 *     agent_role:  "",
 *     runtime:     "" | "claude-code" | …,
 *     model_profile:  "",
 *     resolved_model: "",
 *     skill:       "",
 *     claimed:     false,            // legacy — dropped by 63-10
 *     claimed_at:  "",               // legacy
 *     lease_expires_at: "",          // legacy
 *     resolution:  "",               // free-form completion note
 *     created_at:  ISO-timestamp,
 *     updated_at:  ISO-timestamp
 *   }
 *
 * I/O is per-file JSON so concurrent writes to different tasks never collide.
 * Filename = sanitized task id (filesystem-safe characters only).
 */

const fs = require('fs');
const path = require('path');

function sanitizeId(id) {
  return String(id || '').replace(/[^A-Za-z0-9._-]/g, '_');
}

function tasksDir(planningDir) {
  return path.join(planningDir, 'tasks');
}

function taskPath(planningDir, id) {
  return path.join(tasksDir(planningDir), `${sanitizeId(id)}.json`);
}

function hasTasksDir(planningDir) {
  try { return fs.statSync(tasksDir(planningDir)).isDirectory(); }
  catch { return false; }
}

/** Canonical Task shape with defaults applied. */
function normalizeTask(raw) {
  const t = raw && typeof raw === 'object' ? raw : {};
  const id = String(t.id || '');
  const phase = t.phase || (id.includes('-') ? id.split('-').slice(0, -1).join('-') || id.split('-')[0] : '');
  return {
    id,
    phase,
    status: String(t.status || 'planned').toLowerCase(),
    goal: String(t.goal || ''),
    type: t.type ? String(t.type) : '',
    keywords: t.keywords ? String(t.keywords) : '',
    depends: Array.isArray(t.depends) ? t.depends.slice() : (t.depends ? String(t.depends).split(',').map(s => s.trim()).filter(Boolean) : []),
    commands: Array.isArray(t.commands) ? t.commands.slice() : [],
    files: Array.isArray(t.files) ? t.files.slice() : [],
    agent_id: t.agent_id ? String(t.agent_id) : '',
    agent_role: t.agent_role ? String(t.agent_role) : '',
    runtime: t.runtime ? String(t.runtime) : '',
    model_profile: t.model_profile ? String(t.model_profile) : '',
    resolved_model: t.resolved_model ? String(t.resolved_model) : '',
    skill: t.skill ? String(t.skill) : '',
    claimed: Boolean(t.claimed),
    claimed_at: t.claimed_at ? String(t.claimed_at) : '',
    lease_expires_at: t.lease_expires_at ? String(t.lease_expires_at) : '',
    resolution: t.resolution ? String(t.resolution) : '',
    created_at: t.created_at ? String(t.created_at) : '',
    updated_at: t.updated_at ? String(t.updated_at) : '',
  };
}

/** Convert canonical Task → the shape task-registry-reader returns.
 * Keeps downstream callers working unchanged (they expect camelCase keys). */
function toReaderShape(t) {
  return {
    id: t.id,
    agentId: t.agent_id,
    agentRole: t.agent_role,
    runtime: t.runtime,
    modelProfile: t.model_profile,
    resolvedModel: t.resolved_model,
    claimed: t.claimed,
    claimedAt: t.claimed_at,
    leaseExpiresAt: t.lease_expires_at,
    skill: t.skill,
    type: t.type,
    goal: t.goal,
    status: t.status,
    phase: t.phase,
    keywords: t.keywords,
    depends: Array.isArray(t.depends) ? t.depends.join(',') : (t.depends || ''),
    commands: t.commands,
    files: t.files,
  };
}

function readOne(planningDir, id) {
  const p = taskPath(planningDir, id);
  if (!fs.existsSync(p)) return null;
  try { return normalizeTask(JSON.parse(fs.readFileSync(p, 'utf8'))); }
  catch { return null; }
}

function writeOne(planningDir, task) {
  const t = normalizeTask(task);
  if (!t.id) throw new Error('writeOne: task.id is required');
  const now = new Date().toISOString();
  if (!t.created_at) t.created_at = now;
  t.updated_at = now;
  const p = taskPath(planningDir, t.id);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(t, null, 2));
  try { fs.renameSync(tmp, p); }
  catch (err) {
    if (err.code === 'EPERM' || err.code === 'EEXIST') {
      // Windows: unlink target + retry
      try { fs.unlinkSync(p); fs.renameSync(tmp, p); }
      catch (inner) { try { fs.unlinkSync(tmp); } catch {}; throw inner; }
    } else { try { fs.unlinkSync(tmp); } catch {}; throw err; }
  }
  return t;
}

function updateOne(planningDir, id, patch) {
  const cur = readOne(planningDir, id);
  if (!cur) throw new Error(`updateOne: task not found: ${id}`);
  return writeOne(planningDir, { ...cur, ...patch, id });
}

function listAll(planningDir, filter = {}) {
  if (!hasTasksDir(planningDir)) return [];
  const dir = tasksDir(planningDir);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.tmp'));
  const out = [];
  for (const f of files) {
    let t;
    try { t = normalizeTask(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); }
    catch { continue; }
    if (!t.id) continue;
    if (filter.status && t.status !== String(filter.status).toLowerCase()) continue;
    if (filter.phase && t.phase !== filter.phase) continue;
    out.push(t);
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function deleteOne(planningDir, id) {
  const p = taskPath(planningDir, id);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

module.exports = {
  sanitizeId, tasksDir, taskPath, hasTasksDir,
  normalizeTask, toReaderShape,
  readOne, writeOne, updateOne, listAll, deleteOne,
};
