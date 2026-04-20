'use strict';
/**
 * gad publish — manage marketplace publish state (set, list).
 *
 * Stamps `x-operator-id` on publish PATCH (task 51-03/51-04) so the
 * human operator stays attached to MANIFEST.json publishedBy even when
 * the actual write is initiated by an agent runtime.
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function gadOperatorAttribution() {
  const op = process.env.OPERATOR_ID || process.env.GAD_OPERATOR_ID || 'solo-operator';
  const headers = { 'x-operator-id': op };
  if (process.env.GAD_AGENT_ID) headers['x-gad-agent-id'] = process.env.GAD_AGENT_ID;
  if (process.env.GAD_AGENT_ROLE) headers['x-gad-agent-role'] = process.env.GAD_AGENT_ROLE;
  return { operator: op, headers };
}

function createPublishCommand() {
  const set = defineCommand({
    meta: {
      name: 'set',
      description: 'Set publish status (draft|published|unlisted) on a generation. Stamps x-operator-id from env.',
    },
    args: {
      project: { type: 'positional', required: true, description: 'Project id (e.g. escape-the-dungeon)' },
      species: { type: 'string', required: true, description: 'Species name (e.g. gad)' },
      version: { type: 'string', required: true, description: 'Generation version (e.g. v7)' },
      status: { type: 'string', default: 'published', description: 'draft | published | unlisted' },
      url: { type: 'string', description: 'Planning-app base URL (default: env GAD_PLANNING_APP_URL or http://localhost:3002)' },
      json: { type: 'boolean', description: 'Emit JSON response' },
    },
    async run({ args }) {
      const valid = new Set(['draft', 'published', 'unlisted']);
      if (!valid.has(args.status)) {
        console.error(`error: --status must be one of: ${[...valid].join(', ')}`);
        process.exitCode = 2;
        return;
      }
      const base = args.url || process.env.GAD_PLANNING_APP_URL || 'http://localhost:3002';
      const url = `${base.replace(/\/$/, '')}/api/dev/evals/projects/${encodeURIComponent(args.project)}/species/${encodeURIComponent(args.species)}/generations/${encodeURIComponent(args.version)}/publish`;
      const { operator, headers } = gadOperatorAttribution();
      let res;
      try {
        res = await fetch(url, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify({ status: args.status }),
        });
      } catch (err) {
        console.error(`error: PATCH ${url} failed: ${err.message}`);
        console.error(`(is planning-app running? \`pnpm dev:planning-app\` or \`pnpm --filter @portfolio/planning-app dev\`)`);
        process.exitCode = 1;
        return;
      }
      const text = await res.text();
      let payload = null;
      try { payload = JSON.parse(text); } catch { /* non-json response, surface raw */ }
      if (!res.ok) {
        if (args.json) {
          process.stdout.write(text + '\n');
        } else {
          console.error(`error: ${res.status} ${res.statusText}`);
          if (payload?.error) console.error(payload.error);
          else console.error(text);
        }
        process.exitCode = 1;
        return;
      }
      if (args.json) { process.stdout.write(JSON.stringify(payload ?? text, null, 2) + '\n'); return; }
      console.log(`\n${args.status.toUpperCase()} ${args.project}/${args.species}/${args.version}`);
      console.log(`  operator:  ${operator}`);
      if (process.env.GAD_AGENT_ID) console.log(`  agent:     ${process.env.GAD_AGENT_ID}`);
      if (payload && typeof payload === 'object') {
        if (payload.publishedAt) console.log(`  publishedAt: ${payload.publishedAt}`);
        if (payload.publishedBy) console.log(`  publishedBy: ${payload.publishedBy}`);
        if ('hasBuild' in payload) console.log(`  hasBuild:    ${payload.hasBuild}`);
        if ('isPublished' in payload) console.log(`  live:        ${payload.isPublished ? 'yes' : 'no'}`);
      }
      console.log('');
    },
  });

  const list = defineCommand({
    meta: {
      name: 'list',
      description: 'List published generations from marketplace-index.generated.json. Default scope: --mine.',
    },
    args: {
      mine: { type: 'boolean', description: 'Only show generations published by the current operator (default).' },
      all: { type: 'boolean', description: 'Show all published generations across operators.' },
      project: { type: 'string', description: 'Filter to a single project id.' },
      species: { type: 'string', description: 'Filter to a single species name.' },
      json: { type: 'boolean', description: 'Emit JSON' },
      indexPath: { type: 'string', description: 'Override path to marketplace-index.generated.json' },
    },
    run({ args }) {
      const indexPath = args.indexPath ||
        path.join(__dirname, '..', '..', 'site', 'lib', 'marketplace-index.generated.json');
      if (!fs.existsSync(indexPath)) {
        console.error(`error: marketplace index not found at ${indexPath}`);
        console.error('(run a vendor-site predev or publish a generation to create it)');
        process.exitCode = 1;
        return;
      }
      let index;
      try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); }
      catch (err) { console.error(`error: failed to parse ${indexPath}: ${err.message}`); process.exitCode = 1; return; }

      const { operator } = gadOperatorAttribution();
      const scopeMine = !args.all;
      let rows = Array.isArray(index.generations) ? index.generations.slice() : [];
      if (args.project) rows = rows.filter((g) => g.project === args.project);
      if (args.species) rows = rows.filter((g) => g.species === args.species);
      if (scopeMine) rows = rows.filter((g) => (g.publishedBy ?? '') === operator);

      if (args.json) {
        process.stdout.write(JSON.stringify({ operator, scope: scopeMine ? 'mine' : 'all', count: rows.length, generations: rows }, null, 2) + '\n');
        return;
      }
      console.log(`\nPublished generations · scope=${scopeMine ? 'mine' : 'all'} · operator=${operator}`);
      if (args.project) console.log(`  filter: project=${args.project}`);
      if (args.species) console.log(`  filter: species=${args.species}`);
      if (rows.length === 0) {
        console.log('\n  (none)');
        if (scopeMine) console.log(`  hint: pass --all to see ${index.generations?.length ?? 0} total published, or set OPERATOR_ID env to match a specific publisher.`);
        console.log('');
        return;
      }
      const headers = ['PROJECT', 'SPECIES', 'VERSION', 'PUBLISHED-AT', 'BY', 'SCORE'];
      const data = rows.map((g) => [
        g.project ?? '', g.species ?? '', g.version ?? '',
        g.publishedAt ? String(g.publishedAt).slice(0, 10) : '—',
        g.publishedBy ?? '—',
        g.score === null || g.score === undefined ? '—' : Number(g.score).toFixed(2),
      ]);
      const widths = headers.map((h, i) => Math.max(h.length, ...data.map((r) => String(r[i]).length)));
      const fmt = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
      console.log('');
      console.log('  ' + fmt(headers));
      console.log('  ' + widths.map((w) => '-'.repeat(w)).join('  '));
      for (const r of data) console.log('  ' + fmt(r));
      console.log(`\n  ${rows.length} of ${index.generations?.length ?? 0} total published\n`);
    },
  });

  return defineCommand({
    meta: { name: 'publish', description: 'Manage marketplace publish state — set, list (default: list --mine).' },
    subCommands: { set, list },
  });
}

module.exports = { createPublishCommand };
module.exports.register = () => ({ publish: createPublishCommand() });
