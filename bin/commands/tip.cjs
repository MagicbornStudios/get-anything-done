'use strict';
/**
 * gad tip — daily teachings, file-backed, zero API cost
 *
 * Required deps:
 *   teachings, findRepoRoot, gadConfig, outputError
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createTipCommand(deps) {
  const { teachings, findRepoRoot, gadConfig, outputError } = deps;

  function renderTipBackrefs(tip) {
    if (!tip) return '';
    const lines = [];
    if (tip.implementation && tip.implementation.length) {
      lines.push(`  implementation:`);
      for (const p of tip.implementation) lines.push(`    - ${p}`);
    }
    if (tip.decisions && tip.decisions.length) lines.push(`  decisions: ${tip.decisions.join(', ')}`);
    if (tip.phases && tip.phases.length) lines.push(`  phases: ${tip.phases.join(', ')}`);
    if (tip.related && tip.related.length) lines.push(`  related: ${tip.related.join(', ')}`);
    return lines.join('\n');
  }

  function renderTipHeader(tip) {
    if (!tip) return '(no tips found — run `gad tip reindex` or add files under teachings/static/)';
    const tags = (tip.tags || []).join(', ');
    const lines = [
      `${tip.title}`,
      `  ${tip.category} · ${tip.difficulty}${tags ? ` · tags: ${tags}` : ''}`,
      `  source: ${tip.source}${tip.date ? ` · ${tip.date}` : ''}`,
      `  file: teachings/${tip.path}`,
    ];
    const refs = renderTipBackrefs(tip);
    if (refs) lines.push(refs);
    return lines.join('\n');
  }

  function renderTipFull(tip) {
    if (!tip) return renderTipHeader(null);
    const body = teachings.stripFrontmatter(teachings.readBody(tip));
    if (!body) return renderTipHeader(tip);
    const refs = renderTipBackrefs(tip);
    const backrefBlock = refs ? `\n\n---\n\n**Backrefs**\n\n${refs.replace(/^  /gm, '')}\n` : '';
    return body + backrefBlock;
  }

  function resolveTipCategories(flagValue) {
    const parse = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
    const isAll = arr => arr.length === 1 && arr[0].toLowerCase() === 'all';
    if (flagValue) { const arr = parse(flagValue); return isAll(arr) ? null : arr; }
    if (process.env.GAD_TIP_CATEGORIES) { const arr = parse(process.env.GAD_TIP_CATEGORIES); return isAll(arr) ? null : arr; }
    try {
      const baseDir = findRepoRoot();
      if (baseDir) {
        const cfg = gadConfig.load(baseDir);
        if (cfg && cfg.teachings && Array.isArray(cfg.teachings.categories)) {
          const arr = cfg.teachings.categories.filter(Boolean);
          if (arr.length > 0) return isAll(arr) ? null : arr;
        }
      }
    } catch (_) {}
    return null;
  }

  const today = defineCommand({
    meta: { name: 'today', description: "Print today's teaching tip (deterministic pick, zero API cost)" },
    args: {
      headers: { type: 'boolean', description: 'Only print the title + metadata, not the body', default: false },
      category: { type: 'string', description: 'Restrict rotation to categories (comma-separated, or "all"). Overrides GAD_TIP_CATEGORIES + config.', default: '' },
    },
    run({ args }) {
      const tip = teachings.pickToday(undefined, { categories: resolveTipCategories(args.category) });
      console.log(args.headers ? renderTipHeader(tip) : renderTipFull(tip));
    },
  });

  const random = defineCommand({
    meta: { name: 'random', description: 'Print a random tip from the catalog' },
    args: {
      headers: { type: 'boolean', description: 'Only print the title + metadata, not the body', default: false },
      category: { type: 'string', description: 'Restrict pool to categories (comma-separated, or "all"). Overrides GAD_TIP_CATEGORIES + config.', default: '' },
    },
    run({ args }) {
      const tip = teachings.pickRandom({ categories: resolveTipCategories(args.category) });
      console.log(args.headers ? renderTipHeader(tip) : renderTipFull(tip));
    },
  });

  const search = defineCommand({
    meta: { name: 'search', description: 'Substring search across title, tags, category' },
    args: { query: { type: 'positional', description: 'Query string', required: true } },
    run({ args }) {
      const hits = teachings.search(String(args.query));
      if (hits.length === 0) { console.log(`No tips matching "${args.query}".`); return; }
      for (const t of hits) console.log(renderTipHeader(t) + '\n');
      console.log(`${hits.length} tip(s).`);
    },
  });

  const list = defineCommand({
    meta: { name: 'list', description: 'List all tips (optionally filtered by --category)' },
    args: { category: { type: 'string', description: 'Filter by category slug', default: '' } },
    run({ args }) {
      const tips = args.category ? teachings.filterByCategory(args.category) : teachings.listAll();
      if (tips.length === 0) { console.log('No tips found.'); return; }
      for (const t of tips) console.log(renderTipHeader(t) + '\n');
      console.log(`${tips.length} tip(s).`);
    },
  });

  const categories = defineCommand({
    meta: { name: 'categories', description: 'List teaching categories with tip counts' },
    run() {
      const cats = teachings.listCategories();
      if (cats.length === 0) { console.log('No categories yet.'); return; }
      for (const c of cats) console.log(`  ${c.category.padEnd(24)} ${c.count}`);
    },
  });

  const reindex = defineCommand({
    meta: { name: 'reindex', description: 'Rescan teachings/ and rewrite index.json' },
    run() {
      const n = teachings.reindex();
      console.log(`Reindexed ${n} tip(s) → teachings/index.json`);
    },
  });

  const generate = defineCommand({
    meta: { name: 'generate', description: "Generate today's tip via OpenAI (requires OPENAI_API_KEY). Skips if today's file exists unless --force." },
    args: {
      date: { type: 'string', description: 'Backfill date (YYYY-MM-DD); default today', default: '' },
      force: { type: 'boolean', description: 'Overwrite today\'s tip if it already exists', default: false },
      quiet: { type: 'boolean', description: 'Suppress non-error output', default: false },
    },
    run({ args }) {
      if (!process.env.OPENAI_API_KEY) {
        if (!args.quiet) {
          console.log('tip generate: OPENAI_API_KEY not set — skipping generation.');
          console.log('  Set the key to enable daily tip generation on startup.');
        }
        return;
      }
      const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'generate-daily-tip.mjs');
      if (!fs.existsSync(scriptPath)) {
        outputError(`Generator script missing: ${path.relative(findRepoRoot(), scriptPath)}`);
        return;
      }
      const env = { ...process.env };
      if (args.date) env.TIP_DATE = args.date;
      if (args.force) env.TIP_FORCE = '1';
      const result = require('child_process').spawnSync(process.execPath, [scriptPath], {
        env,
        stdio: args.quiet ? 'pipe' : 'inherit',
      });
      if (result.status !== 0) {
        if (args.quiet) process.stderr.write(String(result.stderr || ''));
        process.exit(result.status || 1);
      }
    },
  });

  return defineCommand({
    meta: { name: 'tip', description: 'Daily teachings — today (default), random, search, list, categories, reindex, generate. Reading is file-backed; only generate costs API tokens.' },
    subCommands: { today, random, search, list, categories, reindex, generate },
  });
}

module.exports = { createTipCommand };
module.exports.register = (ctx) => ({
  tip: createTipCommand({ ...ctx.common, ...ctx.extras.tip }),
});
