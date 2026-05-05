'use strict';
/**
 * gad evolution skill-usage — invocation counts per slug per runtime,
 * sourced from `.planning/.gad-log/<date>-skill-loads.jsonl` events
 * emitted by `gad snapshot --handoff`.
 *
 * Task 107-10. Replaces the historic policy gap where non-claude runtimes
 * had no traceable skill-load events at all (operator memo
 * `feedback_evolution_review_instructions.md` 2026-05-04 — "we will figure
 * out if the skills are good via tracing the skill usage" was unfounded
 * for codex/gemini/opencode until snapshot --handoff started emitting
 * these events).
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function parseDuration(raw) {
  if (!raw) return null;
  const match = String(raw).trim().match(/^(\d+)\s*(d|h|m|w)?$/i);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = (match[2] || 'd').toLowerCase();
  const ms = unit === 'w' ? 7 * 86400e3
    : unit === 'd' ? 86400e3
    : unit === 'h' ? 3600e3
    : 60e3;
  return n * ms;
}

function listSkillLoadFiles(logDir) {
  if (!fs.existsSync(logDir)) return [];
  return fs.readdirSync(logDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-skill-loads\.jsonl$/.test(f))
    .map((f) => path.join(logDir, f))
    .sort();
}

function readJsonlLines(filePath) {
  const out = [];
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); } catch { return out; }
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return out;
}

function aggregateEvents(events, { projectid }) {
  // counts[slug][runtime] = count
  const counts = new Map();
  const totalsBySlug = new Map();
  const totalsByRuntime = new Map();
  let included = 0;
  for (const e of events) {
    if (projectid && e.projectid && e.projectid !== projectid) continue;
    const slug = e.slug || 'unknown';
    const runtime = e.runtime || 'unknown';
    if (!counts.has(slug)) counts.set(slug, new Map());
    const slugMap = counts.get(slug);
    slugMap.set(runtime, (slugMap.get(runtime) || 0) + 1);
    totalsBySlug.set(slug, (totalsBySlug.get(slug) || 0) + 1);
    totalsByRuntime.set(runtime, (totalsByRuntime.get(runtime) || 0) + 1);
    included += 1;
  }
  return { counts, totalsBySlug, totalsByRuntime, included };
}

function createEvolutionSkillUsageCommand({ findRepoRoot, gadConfig, resolveRoots, outputError, shouldUseJson }) {
  return defineCommand({
    meta: {
      name: 'skill-usage',
      description: 'Report per-slug per-runtime skill invocation counts from .gad-log/skill-loads.',
    },
    args: {
      projectid: { type: 'string', description: 'Filter to one projectid', default: '' },
      since: { type: 'string', description: 'Time window (e.g. 7d, 24h, 30d). Default: all logged events.', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      const projectid = args.projectid || (roots[0] && roots[0].id) || '';
      const sinceMs = parseDuration(args.since);
      const cutoffMs = sinceMs ? Date.now() - sinceMs : null;

      const logDir = path.join(baseDir, '.planning', '.gad-log');
      const files = listSkillLoadFiles(logDir);
      const events = [];
      for (const file of files) {
        for (const e of readJsonlLines(file)) {
          if (cutoffMs && e.ts && new Date(e.ts).getTime() < cutoffMs) continue;
          events.push(e);
        }
      }

      const { counts, totalsBySlug, totalsByRuntime, included } = aggregateEvents(events, { projectid });

      if (args.json || (shouldUseJson && shouldUseJson())) {
        const out = {
          projectid: projectid || null,
          since: args.since || null,
          total_events: included,
          totals_by_runtime: Object.fromEntries(totalsByRuntime),
          per_slug: [...counts.entries()]
            .map(([slug, runtimeMap]) => ({
              slug,
              total: totalsBySlug.get(slug) || 0,
              by_runtime: Object.fromEntries(runtimeMap),
            }))
            .sort((a, b) => b.total - a.total),
        };
        console.log(JSON.stringify(out, null, 2));
        return;
      }

      console.log(`gad evolution skill-usage`);
      console.log(`  projectid: ${projectid || '(all)'}`);
      console.log(`  since:     ${args.since || '(all logged events)'}`);
      console.log(`  events:    ${included}`);
      console.log('');

      if (included === 0) {
        console.log('(no skill-load events found — run handoffs through `gad snapshot --handoff <id>` to populate)');
        if (!fs.existsSync(logDir)) {
          console.log(`  log dir missing: ${path.relative(baseDir, logDir)}`);
        }
        return;
      }

      console.log('Totals by runtime:');
      const runtimeRows = [...totalsByRuntime.entries()].sort((a, b) => b[1] - a[1]);
      for (const [runtime, count] of runtimeRows) {
        console.log(`  ${runtime.padEnd(20)} ${count}`);
      }
      console.log('');

      console.log('Per-slug invocations:');
      const slugRows = [...counts.entries()]
        .sort((a, b) => (totalsBySlug.get(b[0]) || 0) - (totalsBySlug.get(a[0]) || 0));
      for (const [slug, runtimeMap] of slugRows) {
        const total = totalsBySlug.get(slug) || 0;
        const breakdown = [...runtimeMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([rt, n]) => `${rt}=${n}`)
          .join(', ');
        console.log(`  ${slug.padEnd(48)} total=${String(total).padStart(4)}   (${breakdown})`);
      }
    },
  });
}

module.exports = { createEvolutionSkillUsageCommand };
