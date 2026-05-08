'use strict';

/**
 * snapshot-cross-project-section.cjs — formatter for CROSS-PROJECT HANDOFFS
 * snapshot section.
 *
 * Exports:
 *   buildCrossProjectHandoffsSection({ baseDir, projectid, gadConfig, render })
 *     → { title, content, cross_project_handoffs: [...] } | null
 *
 * Returns null when no cross-project handoffs match (section omitted).
 */

const { scanCrossProjectHandoffs } = require('./cross-project-handoffs.cjs');

const LIMIT = 10; // show at most this many rows

/**
 * Compute approximate age string from a created_at ISO timestamp.
 */
function ageString(createdAt) {
  if (!createdAt) return '?';
  const ts = new Date(createdAt);
  if (Number.isNaN(ts.getTime())) return '?';
  const ms = Date.now() - ts.getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Build the CROSS-PROJECT HANDOFFS snapshot section.
 *
 * @param {object} opts
 * @param {string} opts.baseDir       — repo root
 * @param {string} opts.projectid     — current snapshot projectid
 * @param {object} opts.gadConfig     — loaded config (result of gadConfig.load(baseDir))
 * @param {Function} opts.render      — render(rows, { format, headers }) → string
 * @returns {{ title: string, content: string, cross_project_handoffs: Array } | null}
 */
function buildCrossProjectHandoffsSection({ baseDir, projectid, gadConfig, render }) {
  const matches = scanCrossProjectHandoffs({ baseDir, projectid, gadConfig });
  if (matches.length === 0) return null;

  const visible = matches.slice(0, LIMIT);
  const rows = visible.map((h) => ({
    from_project: h.from_project,
    id: h.id,
    priority: h.frontmatter.priority || '',
    recipient: h.frontmatter.recipient || '',
    to_agent: h.frontmatter.to_agent || '',
    context: h.frontmatter.estimated_context || '',
    runtime: h.frontmatter.runtime_preference || '',
    age: ageString(h.frontmatter.created_at),
  }));

  let content = render(rows, {
    format: 'table',
    headers: ['from_project', 'id', 'priority', 'recipient', 'to_agent', 'context', 'runtime', 'age'],
  });

  if (matches.length > visible.length) {
    content += `\n+${matches.length - visible.length} more`;
  }

  return {
    title: `CROSS-PROJECT HANDOFFS (${matches.length} filed against this project from other roots)`,
    content,
    cross_project_handoffs: matches.map((h) => ({
      id: h.id,
      bucket: h.bucket,
      from_project: h.from_project,
      priority: h.frontmatter.priority || '',
      recipient: h.frontmatter.recipient || '',
      to_agent: h.frontmatter.to_agent || '',
      estimated_context: h.frontmatter.estimated_context || '',
      runtime_preference: h.frontmatter.runtime_preference || '',
      created_at: h.frontmatter.created_at || '',
    })),
  };
}

module.exports = { buildCrossProjectHandoffsSection };
