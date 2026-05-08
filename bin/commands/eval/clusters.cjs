'use strict';
/**
 * gad eval clusters — orthogonality audit + cluster-based eval matrix.
 * Phase 112, task 112-01.
 *
 * Subcommands:
 *   gad eval clusters scan  [--projectid X] [--since 7d|YYYY-MM-DD] [--json]
 *   gad eval clusters list  [--json]
 *
 * The last computed cluster set is cached to
 *   <repo-root>/.planning/.eval-clusters-cache.json
 * so `list` can return it without re-scanning.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const {
  sampleClosedHandoffs,
  analyzeCombos,
  clusterCombos,
  clusterEnumerate,
} = require('../../../lib/orthogonality/index.cjs');

const CACHE_FILENAME = '.eval-clusters-cache.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveCacheFile(root) {
  return path.join(root, '.planning', CACHE_FILENAME);
}

function readCache(root) {
  const f = resolveCacheFile(root);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (_) {
    return null;
  }
}

function writeCache(root, data) {
  const dir = path.join(root, '.planning');
  if (!fs.existsSync(dir)) return; // no .planning = wrong root, skip
  fs.writeFileSync(resolveCacheFile(root), JSON.stringify(data, null, 2));
}

function findAllPlanningRoots(startRoot) {
  // Walk upward from startRoot to collect every directory that has a
  // .planning/ sub-dir (multi-root monorepo support).
  const roots = new Set();
  let dir = startRoot;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) roots.add(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return [...roots];
}

function resolveRootsForProject(projectid, findRepoRoot, gadConfig) {
  const immediateRoot = findRepoRoot();
  const roots = new Set(findAllPlanningRoots(immediateRoot));

  if (projectid && projectid !== 'global') {
    // Try gadConfig to resolve project root
    try {
      const cfg = gadConfig.load();
      const proj = (cfg.projects || []).find(
        (p) => p.id === projectid || p.slug === projectid,
      );
      if (proj && proj.root) {
        roots.add(proj.root);
        for (const r of findAllPlanningRoots(proj.root)) roots.add(r);
      }
    } catch (_) { /* ignore */ }
  }

  // Explicitly include the GAD submodule if we happen to be at a monorepo root
  for (const root of [...roots]) {
    const gadSubmodule = path.join(root, 'vendor', 'get-anything-done');
    if (fs.existsSync(path.join(gadSubmodule, '.planning'))) {
      roots.add(gadSubmodule);
    }
  }

  return [...roots];
}

function printTable(rows) {
  if (rows.length === 0) { console.log('  (no data)'); return; }
  const cols = Object.keys(rows[0]);
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length))
  );
  const header = cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  console.log(header);
  console.log(sep);
  for (const row of rows) {
    console.log(cols.map((c, i) => String(row[c] ?? '').padEnd(widths[i])).join('  '));
  }
}

// ---------------------------------------------------------------------------
// scan subcommand
// ---------------------------------------------------------------------------
function createClustersScanCommand({ findRepoRoot, gadConfig }) {
  return defineCommand({
    meta: {
      name: 'scan',
      description: 'Scan closed handoffs, compute frequency table + cluster taxonomy',
    },
    args: {
      projectid: {
        type: 'string',
        description: 'Project id to scope scan root (default: all known roots)',
        default: '',
      },
      since: {
        type: 'string',
        description: 'Only include handoffs after this date (7d, 30d, YYYY-MM-DD)',
        default: '',
      },
      json: {
        type: 'boolean',
        description: 'Output as JSON',
        default: false,
      },
      'min-freq': {
        type: 'string',
        description: 'Minimum occurrences to be a cluster seed (default: 2)',
        default: '2',
      },
      'max-clusters': {
        type: 'string',
        description: 'Maximum number of clusters (default: 10)',
        default: '10',
      },
    },
    run({ args }) {
      const roots = resolveRootsForProject(
        args.projectid,
        findRepoRoot,
        gadConfig,
      );

      const handoffs = sampleClosedHandoffs({
        roots,
        sinceIso: args.since || null,
        includeClaimed: false,
      });

      const table = analyzeCombos(handoffs);
      const minFreq = Math.max(1, parseInt(args['min-freq'], 10) || 2);
      const maxClusters = Math.max(1, parseInt(args['max-clusters'], 10) || 10);

      const clusters = clusterCombos(table, { minFreq, maxClusters });
      const representatives = clusterEnumerate(clusters);

      const result = {
        scanned_at: new Date().toISOString(),
        roots,
        handoff_count: handoffs.length,
        combo_count: table.length,
        cluster_count: clusters.length,
        frequency_table: table.map((e) => ({
          context: e.context,
          risk: e.risk,
          time: e.time,
          surface: e.surface,
          count: e.count,
          runtimes: e.runtimes.join(','),
        })),
        clusters: representatives,
      };

      // Cache
      try {
        const root = findRepoRoot();
        writeCache(root, result);
      } catch (_) { /* non-fatal */ }

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`\nOrthogonality scan — ${handoffs.length} handoffs across ${roots.length} root(s)`);
      if (args.since) console.log(`  since: ${args.since}`);
      console.log(`  combos: ${table.length}  clusters: ${clusters.length}\n`);

      console.log('Frequency table:');
      printTable(
        table.slice(0, 20).map((e) => ({
          context: e.context,
          risk: e.risk,
          time: e.time,
          surface: e.surface,
          count: e.count,
        })),
      );

      console.log('\nCluster representatives (eval matrix seeds):');
      printTable(
        representatives.map((c) => ({
          id: c.id,
          context: c.context,
          risk: c.risk,
          time: c.time,
          surface: c.surface,
          total: c.totalCount,
          members: c.memberCount,
        })),
      );

      console.log(`\nCache written → .planning/${CACHE_FILENAME}`);
    },
  });
}

// ---------------------------------------------------------------------------
// list subcommand
// ---------------------------------------------------------------------------
function createClustersListCommand({ findRepoRoot }) {
  return defineCommand({
    meta: {
      name: 'list',
      description: 'Print last computed cluster taxonomy (from cache). Run `scan` first.',
    },
    args: {
      json: {
        type: 'boolean',
        description: 'Output as JSON',
        default: false,
      },
    },
    run({ args }) {
      let root;
      try { root = findRepoRoot(); } catch (e) {
        console.error('Could not find repo root:', e.message);
        return;
      }

      const cache = readCache(root);
      if (!cache) {
        console.log('No cluster cache found. Run `gad eval clusters scan` first.');
        return;
      }

      if (args.json) {
        console.log(JSON.stringify(cache, null, 2));
        return;
      }

      console.log(`\nCached cluster taxonomy — scanned ${cache.scanned_at}`);
      console.log(`  handoffs: ${cache.handoff_count}  combos: ${cache.combo_count}  clusters: ${cache.cluster_count}\n`);

      console.log('Cluster representatives:');
      printTable(
        (cache.clusters || []).map((c) => ({
          id: c.id,
          context: c.context,
          risk: c.risk,
          time: c.time,
          surface: c.surface,
          total: c.totalCount,
          members: c.memberCount,
        })),
      );
    },
  });
}

// ---------------------------------------------------------------------------
// enumerate subcommand (standalone; matrix integration follow-on)
// ---------------------------------------------------------------------------
function createClustersEnumerateCommand({ findRepoRoot }) {
  return defineCommand({
    meta: {
      name: 'enumerate',
      description:
        'Print cluster representatives as JSON (for eval matrix --cluster-driven integration)',
    },
    args: {
      json: {
        type: 'boolean',
        description: 'Output as JSON (default true; flag kept for pipeline parity)',
        default: true,
      },
    },
    run({ args: _args }) {
      let root;
      try { root = findRepoRoot(); } catch (e) {
        console.error('Could not find repo root:', e.message);
        return;
      }

      const cache = readCache(root);
      if (!cache) {
        console.log(
          JSON.stringify({ error: 'no-cache', hint: 'Run `gad eval clusters scan` first.' }),
        );
        return;
      }

      console.log(JSON.stringify(cache.clusters || [], null, 2));
    },
  });
}

// ---------------------------------------------------------------------------
// Cluster-driven matrix flag integration
// gad eval matrix --cluster-driven  →  print representatives instead of full
// combinatorial matrix. Implemented here as a standalone helper; the eval
// matrix command can call loadClusterRepresentatives() to integrate.
// ---------------------------------------------------------------------------
function loadClusterRepresentatives(repoRoot) {
  const cache = readCache(repoRoot);
  if (!cache) return null;
  return cache.clusters || [];
}

// ---------------------------------------------------------------------------
// Factory + loader integration
// ---------------------------------------------------------------------------
function createEvalClustersCommand(deps) {
  const { findRepoRoot, gadConfig } = deps;
  return defineCommand({
    meta: {
      name: 'clusters',
      description: 'Orthogonality audit + cluster-based eval matrix (phase 112)',
    },
    subCommands: {
      scan: createClustersScanCommand({ findRepoRoot, gadConfig }),
      list: createClustersListCommand({ findRepoRoot }),
      enumerate: createClustersEnumerateCommand({ findRepoRoot }),
    },
  });
}

module.exports = {
  createEvalClustersCommand,
  loadClusterRepresentatives,
  // Also expose internals for programmatic use
  createClustersScanCommand,
  createClustersListCommand,
  createClustersEnumerateCommand,
};
