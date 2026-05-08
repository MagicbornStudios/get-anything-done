'use strict';

/**
 * cross-project-handoffs.cjs — scan all planning roots listed in gad-config.toml
 * and return handoffs whose `recipient` or `to_agent` field targets the current
 * snapshot's projectid. Does NOT duplicate handoffs already in the local project's
 * own queue (those are already surfaced by buildHandoffsSection).
 *
 * Exports:
 *   RECIPIENT_ALIASES  — Map: recipient string patterns → canonical projectid
 *   scanCrossProjectHandoffs({ baseDir, projectid, gadConfig }) → Array<HandoffRecord>
 *
 * HandoffRecord shape:
 *   { id, bucket, from_project, from_path, frontmatter }
 *
 * Time-bound: file-system reads only, skips unreadable roots silently.
 * Walks only open/ and claimed/ (not closed/).
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('./handoffs.cjs');

// ---------------------------------------------------------------------------
// Recipient alias map — keys are lowercased patterns to match against the
// handoff's `recipient` field. Values are the canonical projectid they resolve to.
// ---------------------------------------------------------------------------
const RECIPIENT_ALIASES = {
  monorepo: 'global',
  'platform-team': 'global',
  'platform team': 'global',
  'platform team dispatcher': 'global',
  'monorepo / platform team dispatcher': 'global',
  'monorepo / platform team': 'global',
  'framework-team': 'get-anything-done',
  framework: 'get-anything-done',
  'framework team': 'get-anything-done',
};

/**
 * Resolve a recipient string to a canonical projectid (or null if no match).
 */
function resolveRecipient(recipientStr) {
  if (!recipientStr) return null;
  const lower = String(recipientStr).toLowerCase().trim();
  // Exact key match first
  if (RECIPIENT_ALIASES[lower] !== undefined) return RECIPIENT_ALIASES[lower];
  // Substring match — allow "monorepo / platform team dispatcher (Marshal-tbd)" to still match
  for (const [pattern, target] of Object.entries(RECIPIENT_ALIASES)) {
    if (lower.includes(pattern)) return target;
  }
  return null;
}

/**
 * Resolve the current agent slug (used for `to_agent` matching).
 * Reads GAD_AGENT_NAME env, falls back to projectid.
 */
function resolveAgentSlug(projectid) {
  return String(process.env.GAD_AGENT_NAME || process.env.GAD_AGENT || projectid || '').trim() || projectid;
}

const SCAN_BUCKETS = ['open', 'claimed'];

/**
 * Scan all planning roots for handoffs that target `projectid`.
 * Skips the root whose id === projectid (already surfaced locally).
 *
 * @param {object} opts
 * @param {string} opts.baseDir       — repo root (used to resolve relative root paths)
 * @param {string} opts.projectid     — current snapshot projectid
 * @param {object} opts.gadConfig     — loaded gad-config module (the .load(baseDir) result)
 * @returns {Array<HandoffRecord>}
 */
function scanCrossProjectHandoffs({ baseDir, projectid, gadConfig }) {
  if (!baseDir || !projectid) return [];

  const config = gadConfig;
  if (!config || !Array.isArray(config.roots)) return [];

  const agentSlug = resolveAgentSlug(projectid);
  const results = [];

  for (const rootEntry of config.roots) {
    // Skip the current project's own root
    if (rootEntry.id === projectid) continue;
    if (rootEntry.enabled === false) continue;

    // Resolve absolute path for this root
    const rootAbs = path.isAbsolute(rootEntry.path)
      ? rootEntry.path
      : path.resolve(baseDir, rootEntry.path);

    const planningDir = rootEntry.planningDir || '.planning';
    const handoffsDir = path.join(rootAbs, planningDir, 'handoffs');

    for (const bucket of SCAN_BUCKETS) {
      const bucketDir = path.join(handoffsDir, bucket);
      let files;
      try {
        files = fs.readdirSync(bucketDir);
      } catch {
        continue; // directory missing or unreadable — skip silently
      }

      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(bucketDir, file);
        let text;
        try {
          text = fs.readFileSync(filePath, 'utf8');
        } catch {
          continue;
        }

        const { frontmatter } = parseFrontmatter(text);

        // Match by recipient field
        const recipientProjectid = resolveRecipient(frontmatter.recipient);
        const recipientMatches = recipientProjectid === projectid;

        // Match by to_agent field
        const toAgent = String(frontmatter.to_agent || '').trim();
        const toAgentMatches = toAgent && (toAgent === agentSlug || toAgent === projectid);

        if (!recipientMatches && !toAgentMatches) continue;

        const id = file.replace(/\.md$/, '');
        results.push({
          id,
          bucket,
          from_project: rootEntry.id,
          from_path: rootAbs,
          frontmatter,
        });
      }
    }
  }

  return results;
}

module.exports = {
  RECIPIENT_ALIASES,
  resolveRecipient,
  scanCrossProjectHandoffs,
};
