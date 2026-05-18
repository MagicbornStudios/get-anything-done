'use strict';
/**
 * sources/planning-artifacts.cjs — ingest .planning/tasks/*.json and .planning/notes/*.md
 */

const fs = require('node:fs');
const path = require('node:path');

function safeRead(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

/**
 * @param {string} projectRoot
 * @param {object} opts
 * @param {string|null} opts.since  ISO timestamp
 * @returns {Array<{id,text,source,ts,sessionId}>}
 */
function ingestPlanningArtifacts(projectRoot, opts = {}) {
  const since = opts.since ? new Date(opts.since).getTime() : 0;
  const records = [];

  // Tasks
  const tasksDir = path.join(projectRoot, '.planning', 'tasks');
  if (fs.existsSync(tasksDir)) {
    const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
    for (const file of taskFiles) {
      const raw = safeRead(path.join(tasksDir, file));
      if (!raw) continue;
      let task;
      try { task = JSON.parse(raw); } catch { continue; }

      const ts = task.updated_at || task.created_at || task.ts || null;
      if (ts && new Date(ts).getTime() < since) continue;

      const parts = [];
      if (task.id) parts.push(`task:${task.id}`);
      if (task.goal || task.title || task.subject) parts.push(task.goal || task.title || task.subject);
      if (task.status) parts.push(`status:${task.status}`);
      if (task.phase) parts.push(`phase:${task.phase}`);
      if (Array.isArray(task.files) && task.files.length) parts.push(`files:${task.files.join(',')}`);

      const text = parts.join(' | ');
      if (!text.trim()) continue;

      records.push({
        id: `task:${task.id || file}`,
        text,
        source: 'planning-artifacts',
        ts: ts || new Date(0).toISOString(),
        sessionId: null,
      });
    }
  }

  // Notes
  const notesDir = path.join(projectRoot, '.planning', 'notes');
  if (fs.existsSync(notesDir)) {
    const noteFiles = fs.readdirSync(notesDir).filter(f => f.endsWith('.md'));
    for (const file of noteFiles) {
      const raw = safeRead(path.join(notesDir, file));
      if (!raw) continue;

      // Extract date from filename pattern YYYY-MM-DD*
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
      const ts = dateMatch ? new Date(dateMatch[1]).toISOString() : null;
      if (ts && new Date(ts).getTime() < since) continue;

      // First 800 chars of content as text
      const text = `note:${file.replace('.md', '')} | ${raw.slice(0, 800).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()}`;
      records.push({
        id: `note:${file}`,
        text,
        source: 'planning-artifacts',
        ts: ts || new Date(0).toISOString(),
        sessionId: null,
      });
    }
  }

  return records;
}

module.exports = { ingestPlanningArtifacts };
