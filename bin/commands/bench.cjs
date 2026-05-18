'use strict';
/**
 * gad bench — own-ELO benchmark CLI family (GLOBAL-T-247-15).
 *
 * Subcommands:
 *   gad bench run <set> <contestant-id> [--projectid X] [--json]
 *   gad bench list-sets [--projectid X] [--json]
 *   gad bench list-results [--set X] [--contestant X] [--limit N] [--projectid X] [--json]
 *   gad bench elo [--top N] [--projectid X] [--json]
 *   gad bench contestants [--add | --remove | --list] --id X [--kind X] [--model X] [--baseURL X]
 */

const fs = require('node:fs');
const path = require('node:path');
const { defineCommand } = require('citty');

// ── Registry path ─────────────────────────────────────────────────────────────

function contestantsPath(projectRoot) {
  return path.join(projectRoot, '.planning', 'bench-contestants.json');
}

function benchSetsDir(projectRoot) {
  return path.join(projectRoot, '.planning', 'bench-sets');
}

function benchResultsDir(projectRoot) {
  return path.join(projectRoot, '.planning', 'bench-results');
}

function loadContestants(projectRoot) {
  const p = contestantsPath(projectRoot);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function saveContestants(projectRoot, list) {
  const p = contestantsPath(projectRoot);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
}

// ── register ──────────────────────────────────────────────────────────────────

function register({ common }) {
  const { resolveRoots, outputError } = common;

  function getProjectRoot(args) {
    try {
      const { projectRoot } = resolveRoots({ projectid: args.projectid || '' });
      return projectRoot;
    } catch {
      return process.cwd();
    }
  }

  // ── bench run ───────────────────────────────────────────────────────────────

  const runCmd = defineCommand({
    meta: { name: 'run', description: 'Run a contestant against a bench set' },
    args: {
      set:         { type: 'positional', description: 'Bench-set name (stem of .planning/bench-sets/<name>.json)', required: true },
      contestant:  { type: 'positional', description: 'Contestant ID from .planning/bench-contestants.json', required: true },
      projectid:   { type: 'string', description: 'Project id', default: '' },
      json:        { type: 'boolean', description: 'Emit JSON result', default: false },
    },
    async run({ args }) {
      const projectRoot = getProjectRoot(args);
      const { loadProblemSet, runContestant, writeResult, buildResult } =
        require('../../lib/bench-harness/index.cjs');

      let problemSet;
      try {
        problemSet = loadProblemSet(String(args.set), projectRoot);
      } catch (err) {
        outputError(`Failed to load bench set "${args.set}": ${err.message}`);
      }

      const registry = loadContestants(projectRoot);
      const entry = registry.find(c => c.id === String(args.contestant));
      if (!entry) {
        outputError(`Contestant "${args.contestant}" not found in .planning/bench-contestants.json. Run "gad bench contestants --add --id <id> --kind <kind>" first.`);
      }

      // Build a contestant object with a solve function appropriate for kind.
      let contestant;
      const { makeOllamaContestant, makeHttpContestant, makeRuntimeCliContestant } =
        require('../../lib/bench-harness/index.cjs');

      if (entry.kind === 'local-ollama') {
        contestant = makeOllamaContestant({ id: entry.id, model: entry.model, baseURL: entry.baseURL });
      } else if (entry.kind === 'http') {
        contestant = makeHttpContestant({ id: entry.id, baseURL: entry.baseURL, apiKey: entry.apiKey || '', model: entry.model });
      } else if (entry.kind === 'runtime-cli') {
        contestant = makeRuntimeCliContestant({ id: entry.id, runtime: entry.runtime });
      } else {
        outputError(`Unknown contestant kind "${entry.kind}". Supported: local-ollama, http, runtime-cli`);
      }

      let results;
      try {
        results = await runContestant(contestant, problemSet);
      } catch (err) {
        outputError(`Run failed: ${err.message}`);
      }

      const totalScore = results.reduce((s, r) => s + r.score, 0);
      const passCount = results.filter(r => r.score >= 1).length;

      const resultObj = buildResult(
        { contestant, results, totalScore, passCount },
        problemSet.id
      );

      let writtenPath;
      try {
        writtenPath = writeResult(resultObj, projectRoot);
      } catch (err) {
        outputError(`Could not write result: ${err.message}`);
      }

      if (args.json) {
        console.log(JSON.stringify({ ...resultObj, writtenPath }, null, 2));
      } else {
        console.log(`bench run complete`);
        console.log(`  set:        ${problemSet.id}`);
        console.log(`  contestant: ${contestant.id}`);
        console.log(`  pass:       ${passCount}/${results.length}`);
        console.log(`  result:     ${writtenPath}`);
      }
    },
  });

  // ── bench list-sets ─────────────────────────────────────────────────────────

  const listSetsCmd = defineCommand({
    meta: { name: 'list-sets', description: 'List available bench problem sets' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      json:      { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const projectRoot = getProjectRoot(args);
      const setsDir = benchSetsDir(projectRoot);

      if (!fs.existsSync(setsDir)) {
        if (args.json) { console.log(JSON.stringify([])); } else { console.log('No bench-sets directory found.'); }
        return;
      }

      const files = fs.readdirSync(setsDir).filter(f => f.endsWith('.json')).sort();

      const sets = files.map(f => {
        const stem = f.replace(/\.json$/, '');
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(setsDir, f), 'utf8'));
          return {
            id: raw.id || stem,
            version: raw.version || '?',
            scorer: raw.scorer || '?',
            problems: Array.isArray(raw.problems) ? raw.problems.length : 0,
            description: raw.description || '',
          };
        } catch {
          return { id: stem, version: '?', scorer: '?', problems: 0, description: '(parse error)' };
        }
      });

      if (args.json) {
        console.log(JSON.stringify(sets, null, 2));
      } else {
        if (sets.length === 0) { console.log('No bench sets found.'); return; }
        for (const s of sets) {
          console.log(`${s.id}  v${s.version}  scorer=${s.scorer}  problems=${s.problems}`);
          if (s.description) console.log(`  ${s.description}`);
        }
      }
    },
  });

  // ── bench list-results ──────────────────────────────────────────────────────

  const listResultsCmd = defineCommand({
    meta: { name: 'list-results', description: 'List bench results' },
    args: {
      set:        { type: 'string', description: 'Filter by set id', default: '' },
      contestant: { type: 'string', description: 'Filter by contestant id', default: '' },
      limit:      { type: 'string', description: 'Max results to list (default 20)', default: '20' },
      projectid:  { type: 'string', description: 'Project id', default: '' },
      json:       { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const projectRoot = getProjectRoot(args);
      const resultsDir = benchResultsDir(projectRoot);

      if (!fs.existsSync(resultsDir)) {
        if (args.json) { console.log(JSON.stringify([])); } else { console.log('No bench-results directory found.'); }
        return;
      }

      const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json')).sort();
      const limit = parseInt(String(args.limit || '20'), 10) || 20;

      let results = [];
      for (const f of files) {
        try {
          const r = JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf8'));
          results.push(r);
        } catch { /* skip malformed */ }
      }

      // Filter
      if (args.set) results = results.filter(r => r.set === String(args.set));
      if (args.contestant) results = results.filter(r => r.contestant && r.contestant.id === String(args.contestant));

      // Sort by ts desc, then limit
      results.sort((a, b) => {
        if (!a.ts && !b.ts) return 0;
        if (!a.ts) return 1;
        if (!b.ts) return -1;
        return b.ts.localeCompare(a.ts);
      });
      results = results.slice(0, limit);

      if (args.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        if (results.length === 0) { console.log('No results found.'); return; }
        for (const r of results) {
          const pass = r.summary ? `${r.summary.passed}/${r.summary.problems}` : '?';
          console.log(`${r.id}  set=${r.set}  contestant=${r.contestant && r.contestant.id}  pass=${pass}  ts=${r.ts || '?'}`);
        }
      }
    },
  });

  // ── bench elo ───────────────────────────────────────────────────────────────

  const eloCmd = defineCommand({
    meta: { name: 'elo', description: 'Compute current ELO leaderboard from all bench results' },
    args: {
      top:       { type: 'string', description: 'Show top N contestants (default 20)', default: '20' },
      projectid: { type: 'string', description: 'Project id', default: '' },
      json:      { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const projectRoot = getProjectRoot(args);
      const resultsDir = benchResultsDir(projectRoot);
      const { replayHistory, topN } = require('../../lib/bench-elo/index.cjs');

      let allResults = [];
      if (fs.existsSync(resultsDir)) {
        const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json')).sort();
        for (const f of files) {
          try { allResults.push(JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf8'))); } catch { /* skip */ }
        }
      }

      if (allResults.length === 0) {
        if (args.json) { console.log(JSON.stringify([])); } else { console.log('No bench results found — run "gad bench run" first.'); }
        return;
      }

      // Build pairwise ELO history from results grouped by (set, ts)
      // For each result, pair winners vs losers within the same set run.
      // Simple approach: sort all results by set+ts, treat passRate as score proxy.
      // Since results are single-contestant (not head-to-head), we derive
      // ELO by pairwise comparison: higher pass rate = winner.
      const bySetTs = new Map();
      for (const r of allResults) {
        const key = `${r.set}::${r.ts || r.id}`;
        if (!bySetTs.has(key)) bySetTs.set(key, []);
        bySetTs.get(key).push(r);
      }

      const history = [];
      for (const [, group] of bySetTs) {
        if (group.length < 2) continue;
        const scored = group.map(r => ({
          id: r.contestant && r.contestant.id ? r.contestant.id : r.id,
          rate: r.summary ? r.summary.passed / Math.max(1, r.summary.problems) : 0,
        }));
        scored.sort((a, b) => b.rate - a.rate);
        for (let i = 0; i < scored.length; i++) {
          for (let j = i + 1; j < scored.length; j++) {
            const a = scored[i]; const b = scored[j];
            if (a.rate === b.rate) {
              history.push({ winner: a.id, loser: b.id, score: 0.5 });
            } else {
              history.push({ winner: a.id, loser: b.id, score: 1 });
            }
          }
        }
      }

      const ratingsMap = replayHistory(history);

      // Seed any contestant who only has individual results but never competed head-to-head
      for (const r of allResults) {
        const cid = r.contestant && r.contestant.id ? r.contestant.id : null;
        if (cid && !ratingsMap.has(cid)) {
          ratingsMap.set(cid, 1500);
        }
      }

      const n = parseInt(String(args.top || '20'), 10) || 20;
      const board = topN(ratingsMap, n);

      if (args.json) {
        console.log(JSON.stringify(board, null, 2));
      } else {
        if (board.length === 0) { console.log('No contestants with ELO data.'); return; }
        console.log('Rank  Contestant                    ELO');
        console.log('────  ────────────────────────────  ────');
        board.forEach((c, i) => {
          const rank = String(i + 1).padStart(4, ' ');
          const name = c.id.padEnd(30, ' ');
          console.log(`${rank}  ${name}  ${c.rating}`);
        });
      }
    },
  });

  // ── bench contestants ────────────────────────────────────────────────────────

  const contestantsCmd = defineCommand({
    meta: { name: 'contestants', description: 'Manage the contestants registry (.planning/bench-contestants.json)' },
    args: {
      add:       { type: 'boolean', description: 'Add a contestant', default: false },
      remove:    { type: 'boolean', description: 'Remove a contestant by --id', default: false },
      list:      { type: 'boolean', description: 'List all contestants', default: false },
      id:        { type: 'string', description: 'Contestant id', default: '' },
      kind:      { type: 'string', description: 'Contestant kind: local-ollama | http | runtime-cli', default: '' },
      model:     { type: 'string', description: 'Model name (for local-ollama or http)', default: '' },
      baseURL:   { type: 'string', description: 'Base URL (for local-ollama or http)', default: '' },
      runtime:   { type: 'string', description: 'Runtime id (for runtime-cli)', default: '' },
      apiKey:    { type: 'string', description: 'API key (for http kind)', default: '' },
      projectid: { type: 'string', description: 'Project id', default: '' },
      json:      { type: 'boolean', description: 'Emit JSON', default: false },
    },
    run({ args }) {
      const projectRoot = getProjectRoot(args);
      const registry = loadContestants(projectRoot);

      const doAdd = args.add;
      const doRemove = args.remove;
      const doList = args.list || (!doAdd && !doRemove);

      if (doAdd) {
        const id = String(args.id || '').trim();
        const kind = String(args.kind || '').trim();
        if (!id) { outputError('--id is required for --add'); }
        if (!kind) { outputError('--kind is required for --add (local-ollama | http | runtime-cli)'); }
        if (registry.find(c => c.id === id)) {
          outputError(`Contestant "${id}" already registered. Remove first with --remove --id ${id}`);
        }
        const entry = { id, kind };
        if (args.model) entry.model = String(args.model);
        if (args.baseURL) entry.baseURL = String(args.baseURL);
        if (args.runtime) entry.runtime = String(args.runtime);
        if (args.apiKey) entry.apiKey = String(args.apiKey);
        registry.push(entry);
        saveContestants(projectRoot, registry);
        if (args.json) {
          console.log(JSON.stringify(entry, null, 2));
        } else {
          console.log(`Added contestant: ${id} (kind=${kind})`);
        }
        return;
      }

      if (doRemove) {
        const id = String(args.id || '').trim();
        if (!id) { outputError('--id is required for --remove'); }
        const idx = registry.findIndex(c => c.id === id);
        if (idx === -1) { outputError(`Contestant "${id}" not found.`); }
        registry.splice(idx, 1);
        saveContestants(projectRoot, registry);
        if (args.json) {
          console.log(JSON.stringify({ removed: id }));
        } else {
          console.log(`Removed contestant: ${id}`);
        }
        return;
      }

      // list
      if (args.json) {
        console.log(JSON.stringify(registry, null, 2));
      } else {
        if (registry.length === 0) { console.log('No contestants registered. Use --add to register one.'); return; }
        for (const c of registry) {
          const extras = [c.kind];
          if (c.model) extras.push(`model=${c.model}`);
          if (c.baseURL) extras.push(`baseURL=${c.baseURL}`);
          if (c.runtime) extras.push(`runtime=${c.runtime}`);
          console.log(`${c.id}  ${extras.join('  ')}`);
        }
      }
    },
  });

  // ── bench (top-level) ────────────────────────────────────────────────────────

  const benchCmd = defineCommand({
    meta: { name: 'bench', description: 'Own-ELO benchmark family: run sets, view results, manage ELO leaderboard' },
    subCommands: {
      'run':          runCmd,
      'list-sets':    listSetsCmd,
      'list-results': listResultsCmd,
      'elo':          eloCmd,
      'contestants':  contestantsCmd,
    },
  });

  return { bench: benchCmd };
}

module.exports = { register };
