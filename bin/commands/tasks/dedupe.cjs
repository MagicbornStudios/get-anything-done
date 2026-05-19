'use strict';
/**
 * gad tasks dedupe — find & merge duplicate task entries (legacy short-form
 * vs canonical `<NS>-T-<phase>-<n>`). Default is dry-run; pass --apply to
 * merge legacy into canonical + delete the legacy files.
 *
 * Problem (caught in phase 245): a wave was given legacy IDs `245-07..10`
 * but stamped done against newly-created `GLOBAL-T-245-07..10`. Both files
 * exist; the legacy ones stay `planned` forever.
 *
 * Merge rules (see lib/tasks-dedupe.cjs):
 *   - canonical id wins
 *   - status: best across all members (done > in-progress > planned > cancelled)
 *   - files[]: union
 *   - goal/skill/runtime/agent: canonical preferred, fall back to legacy
 *     when canonical is empty
 *   - created_at: earliest; updated_at: latest
 */

const path = require('path');
const { defineCommand } = require('citty');
const dedupe = require('../../../lib/tasks-dedupe.cjs');

function createTasksDedupeCommand(deps) {
  return defineCommand({
    meta: {
      name: 'dedupe',
      description: 'Find & merge duplicate task entries (legacy short-form vs canonical <NS>-T-<phase>-<n>)',
    },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', required: true },
      apply: { type: 'boolean', description: 'Apply merge + delete legacy files (default: dry-run report only)', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const planningDir = path.join(baseDir, root.path, root.planningDir);

      const groups = dedupe.findDuplicateGroups(planningDir);
      const wantJson = args.json || deps.shouldUseJson();

      if (groups.length === 0) {
        if (wantJson) {
          console.log(JSON.stringify({ groups: [], merged: [], skipped: [], apply: args.apply }, null, 2));
        } else {
          console.log('No duplicate task entries found.');
        }
        return;
      }

      // Dry-run path — report only.
      if (!args.apply) {
        const summaries = groups.map((g) => ({
          suffix: g.suffix,
          canonical: g.canonical ? g.canonical.id : null,
          canonical_status: g.canonical ? g.canonical.status : null,
          legacy: g.legacy.map((t) => ({ id: t.id, status: t.status, agent_id: t.agent_id })),
          mergeable: Boolean(g.canonical),
          divergence: dedupe.describeDivergence(g),
        }));

        if (wantJson) {
          console.log(JSON.stringify({ groups: summaries, apply: false }, null, 2));
          return;
        }

        console.log(`Found ${groups.length} duplicate group(s). (dry-run — no changes)\n`);
        for (const s of summaries) {
          console.log(`  suffix: ${s.suffix}`);
          if (s.canonical) {
            console.log(`    canonical: ${s.canonical} [${s.canonical_status}]`);
          } else {
            console.log(`    canonical: <none — cannot merge>`);
          }
          for (const legacy of s.legacy) {
            const marker = legacy.status_differs ? ' status-differs' : '';
            console.log(`    legacy:    ${legacy.id} [${legacy.status}]${marker}`);
          }
          if (!s.mergeable) {
            console.log(`    action:    SKIP (no canonical to merge into)`);
          } else {
            console.log(`    action:    merge ${s.legacy.length} legacy → ${s.canonical} (rerun with --apply)`);
          }
          console.log('');
        }
        return;
      }

      // Apply path — merge + delete.
      const report = dedupe.applyDedupe(planningDir, groups);

      if (wantJson) {
        console.log(JSON.stringify({ groups: groups.length, ...report, apply: true }, null, 2));
        return;
      }

      console.log(`Applied dedupe across ${groups.length} group(s).\n`);
      if (report.merged.length) {
        console.log(`Merged (${report.merged.length}):`);
        for (const m of report.merged) {
          console.log(`  ${m.suffix} → ${m.canonical} [${m.status}]  (deleted: ${m.deleted.join(', ') || '<none>'})`);
        }
      }
      if (report.skipped.length) {
        console.log(`\nSkipped (${report.skipped.length}):`);
        for (const s of report.skipped) {
          console.log(`  ${s.suffix} — ${s.reason} — members: ${s.members.join(', ')}`);
        }
      }
    },
  });
}

module.exports = { createTasksDedupeCommand };
