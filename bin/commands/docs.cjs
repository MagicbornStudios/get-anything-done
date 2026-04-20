'use strict';
/**
 * gad docs — docs listing, compile, and static serve
 *
 * Required deps: findRepoRoot, gadConfig, resolveRoots, outputError,
 *   compileDocs, readDocsMap, render, shouldUseJson
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

const GAD_DOCS_SERVE_PORT_DEV = 3790;
const GAD_DOCS_SERVE_PORT_CONSUMER = 3890;

function resolveGadDocsServePortDetailed(args) {
  const raw = String(args.port != null ? args.port : '').trim();
  if (raw !== '') {
    const p = parseInt(raw, 10);
    if (Number.isFinite(p) && p > 0) return { port: p, source: 'explicit' };
  }
  const envRaw = String(process.env.GAD_DOCS_SERVE_PORT || process.env.GAD_DOCS_PORT || '').trim();
  if (envRaw !== '') {
    const e = parseInt(envRaw, 10);
    if (Number.isFinite(e) && e > 0) return { port: e, source: 'env' };
  }
  const consumer = args.consumer === true || args['consumer'] === true;
  if (consumer) return { port: GAD_DOCS_SERVE_PORT_CONSUMER, source: 'consumer' };
  return { port: GAD_DOCS_SERVE_PORT_DEV, source: 'dev' };
}

function createDocsCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError, compileDocs, readDocsMap, render, shouldUseJson } = deps;

  const compile = defineCommand({
    meta: { name: 'compile', description: 'Compile planning docs → MDX sink (respects per-root `enabled` + `docs_sink_ignore` config)' },
    args: {
      sink: { type: 'string', description: 'Override docs_sink path', default: '' },
      only: { type: 'string', description: 'Comma-separated project ids to include (ad-hoc override)', default: '' },
      ignore: { type: 'string', description: 'Comma-separated project ids to skip for this run (in addition to config)', default: '' },
      verbose: { type: 'boolean', alias: 'v', description: 'Verbose output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);

      const sink = args.sink || config.docs_sink;
      if (!sink) outputError('No docs_sink configured. Pass --sink <path> or set docs_sink in gad-config.toml.');

      const configIgnore = new Set(config.docs_sink_ignore || []);
      const cliIgnore = new Set((args.ignore || '').split(',').map((s) => s.trim()).filter(Boolean));
      const cliOnly = new Set((args.only || '').split(',').map((s) => s.trim()).filter(Boolean));

      const filteredRoots = config.roots.filter((root) => {
        if (cliOnly.size > 0) return cliOnly.has(root.id);
        if (root.enabled === false) return false;
        if (configIgnore.has(root.id)) return false;
        if (cliIgnore.has(root.id)) return false;
        return true;
      });

      const skippedCount = config.roots.length - filteredRoots.length;
      console.log(`Compiling ${filteredRoots.length} of ${config.roots.length} roots → ${sink}` +
        (skippedCount > 0 ? ` (${skippedCount} skipped)` : '') + '\n');

      if (args.verbose && skippedCount > 0) {
        const skipped = config.roots.filter((r) => !filteredRoots.includes(r));
        for (const r of skipped) {
          const reason = cliOnly.size > 0 ? 'not in --only'
            : r.enabled === false ? 'enabled=false'
            : configIgnore.has(r.id) ? 'docs_sink_ignore'
            : 'cli --ignore';
          console.log(`  [skip] ${r.id} (${reason})`);
        }
      }

      try {
        let total = 0;
        for (const root of filteredRoots) {
          const n = compileDocs(baseDir, root, sink);
          if (args.verbose && n > 0) console.log(`  ✓ ${root.id}: ${n} file(s)`);
          total += n || 0;
        }
        console.log(`\n✓ Compiled ${total} files`);
      } catch (e) {
        outputError(e.message);
      }
    },
  });

  const list = defineCommand({
    meta: { name: 'list', description: 'List all docs for a project — planning files, DOCS-MAP entries, docs.projects' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      all:       { type: 'boolean', description: 'Show all projects', default: false },
      json:      { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config  = gadConfig.load(baseDir);
      const roots   = resolveRoots(args, baseDir, config.roots);
      const sink    = config.docs_sink;
      const rows    = [];

      for (const root of roots) {
        const planDir = path.join(baseDir, root.path, root.planningDir);
        if (fs.existsSync(planDir)) {
          const planFiles = fs.readdirSync(planDir).filter(f => /\.(xml|md)$/i.test(f) && !f.startsWith('.'));
          for (const f of planFiles) {
            rows.push({ project: root.id, type: 'planning', name: f, path: path.join(root.path, root.planningDir, f) });
          }
        }

        const docsMapEntries = readDocsMap(root, baseDir);
        for (const d of docsMapEntries) {
          rows.push({ project: root.id, type: d.kind || 'docs-map', name: d.description || d.sink, path: d.sink });
        }

        if (sink) {
          const sinkDir = path.join(baseDir, sink, root.id);
          if (fs.existsSync(sinkDir)) {
            const walkSync = (dir, rel) => {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
                if (entry.isDirectory() && entry.name !== 'planning') walkSync(path.join(dir, entry.name), entryRel);
                else if (entry.isFile() && /\.mdx?$/i.test(entry.name) && !/^planning\//.test(entryRel)) {
                  rows.push({ project: root.id, type: 'feature-doc', name: entry.name, path: `${root.id}/${entryRel}` });
                }
              }
            };
            walkSync(sinkDir, '');
          }
        }
      }

      if (config.docsProjects && config.docsProjects.length > 0) {
        for (const dp of config.docsProjects) {
          if (args.projectid && dp.id !== args.projectid) continue;
          rows.push({ project: dp.id, type: 'docs-project', name: dp.kind || 'project', path: dp.id });
        }
      }

      if (rows.length === 0) {
        console.log('No docs found. Create DOCS-MAP.xml or add docs.projects to gad-config.toml.');
        return;
      }

      const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
      if (fmt === 'json') console.log(JSON.stringify(rows, null, 2));
      else console.log(render(rows, { format: 'table', title: `Docs (${rows.length})` }));
    },
  });

  const serve = defineCommand({
    meta: {
      name: 'serve',
      description: 'Compile planning docs into docs path then serve that docs directory as a static site (independent of docs_sink)',
    },
    args: {
      projectid: { type: 'string', description: 'Scope compile to one project id', default: '' },
      all: { type: 'boolean', description: 'Compile all roots before serve', default: false },
      'docs-path': { type: 'string', description: 'Docs output path (override). Falls back to [docs].path then docs_sink, then "docs".', default: '' },
      skipCompile: { type: 'boolean', description: 'Skip compile and only serve current docs-path contents', default: false },
      host: { type: 'string', description: 'Bind host', default: '127.0.0.1' },
      port: {
        type: 'string',
        description: `Explicit TCP port, or leave empty for auto (${GAD_DOCS_SERVE_PORT_DEV} dev, ${GAD_DOCS_SERVE_PORT_CONSUMER} with --consumer, or GAD_DOCS_SERVE_PORT / GAD_DOCS_PORT). When auto-selected and in use, docs serve will try the next ports.`,
        default: '',
      },
      consumer: {
        type: 'boolean',
        description: `Use packaged-install default port ${GAD_DOCS_SERVE_PORT_CONSUMER} when --port is omitted (dev default without this flag is ${GAD_DOCS_SERVE_PORT_DEV}).`,
        default: false,
      },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const docsPath = args['docs-path'] || config.docs_path || config.docs_sink || 'docs';
      const absDocsPath = path.resolve(baseDir, docsPath);
      const skipCompile = args.skipCompile === true || args['skip-compile'] === true;

      if (!skipCompile) {
        const roots = resolveRoots(args, baseDir, config.roots);
        if (roots.length === 0) return;
        let total = 0;
        for (const root of roots) total += compileDocs(baseDir, root, docsPath) || 0;
        console.log(`[gad docs] compiled ${total} file(s) into ${docsPath}`);
      }

      if (!fs.existsSync(absDocsPath)) { outputError(`docs path not found: ${docsPath}`); return; }

      const { serveStatic } = require('../../lib/static-http-serve.cjs');
      const { port, source } = resolveGadDocsServePortDetailed(args);
      if (source !== 'explicit') {
        const why = source === 'env' ? 'GAD_DOCS_SERVE_PORT / GAD_DOCS_PORT'
          : source === 'consumer' ? '--consumer install profile'
          : 'dev default (omit --consumer)';
        console.log(`[gad docs] port ${port} (${why})`);
      }
      serveStatic({ rootDir: absDocsPath, port, host: args.host, logPrefix: '[gad docs]', autoPort: source !== 'explicit', maxPortAttempts: 50 });
    },
  });

  return defineCommand({
    meta: { name: 'docs', description: 'Manage docs listing, compile, and static docs serving' },
    subCommands: { list, compile, serve },
  });
}

module.exports = { createDocsCommand };
module.exports.register = (ctx) => ({ docs: createDocsCommand(ctx.common) });
