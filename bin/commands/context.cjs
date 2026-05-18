'use strict';
/**
 * gad context — context-index CLI family (phase 245-09).
 *
 * Subcommands:
 *   gad context query "<text>" [--json] [--top N]  — BM25 search over index
 *   gad context summarize [--session ID]            — Ollama-backed summaries
 *   gad context rebuild [--since <ISO|duration>]    — re-ingest + re-index
 *   gad context status                              — index health + counts
 *
 * Storage: .planning/context-index/ under the active project root.
 */

const fs = require('node:fs');
const path = require('node:path');
const { defineCommand } = require('citty');

function register({ common }) {
  const { resolveRoots, outputError } = common;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getProjectRoot(args) {
    try {
      const { projectRoot } = resolveRoots({ projectid: args.projectid });
      return projectRoot;
    } catch {
      return process.cwd();
    }
  }

  function storeDir(projectRoot) {
    return path.join(projectRoot, '.planning', 'context-index');
  }

  function eventsPath(projectRoot) {
    return path.join(storeDir(projectRoot), 'events.ndjson');
  }

  function indexPath(projectRoot) {
    return path.join(storeDir(projectRoot), 'index.json');
  }

  function summariesDir(projectRoot) {
    return path.join(storeDir(projectRoot), 'summaries');
  }

  // ── Subcommands ────────────────────────────────────────────────────────────

  const queryCmd = defineCommand({
    meta: { name: 'query', description: 'Hybrid BM25+reranker search over the context index' },
    args: {
      text: { type: 'positional', description: 'Search query', required: true },
      projectid: { type: 'string', description: 'Project id', default: '' },
      json: { type: 'boolean', description: 'Emit JSON array', default: false },
      top: { type: 'string', description: 'Max results (default 10)', default: '10' },
      rerank: { type: 'boolean', description: 'Enable bge-reranker reranking (default true; use --no-rerank to disable)', default: true },
      embed: { type: 'boolean', description: 'Enable Ollama cosine rerank step (default false)', default: false },
    },
    async run({ args }) {
      const projectRoot = getProjectRoot(args);
      try {
        const { query } = require('../../lib/context-index/index.cjs');
        const topK = parseInt(String(args.top || '10'), 10) || 10;
        const t0 = Date.now();
        const results = await query(String(args.text), {
          projectRoot,
          topK,
          rerank: args.rerank !== false,
          embed: !!args.embed,
        });
        const elapsed = Date.now() - t0;
        if (args.json) {
          console.log(JSON.stringify({ results, elapsed_ms: elapsed }, null, 2));
        } else {
          if (results.length === 0) {
            process.stdout.write('No results found.\n');
            return;
          }
          const method = results[0] && results[0].retrieval_method ? results[0].retrieval_method : 'bm25';
          process.stdout.write(`[${method}] ${results.length} results (${elapsed}ms)\n\n`);
          for (const r of results) {
            const scoreStr = r.rerank_score != null
              ? `bm25=${(r.bm25_score ?? r.score ?? 0).toFixed(3)} rerank=${r.rerank_score.toFixed(3)}`
              : `score=${(r.score ?? 0).toFixed(3)}`;
            process.stdout.write(
              `[${r.source}] ${r.id} (${scoreStr})\n` +
              `  ${(r.snippet || r.text || '').slice(0, 160).replace(/\n/g, ' ')}\n\n`
            );
          }
        }
      } catch (err) {
        outputError(err.message);
        process.exit(1);
      }
    },
  });

  const summarizeCmd = defineCommand({
    meta: { name: 'summarize', description: 'Generate session summaries via Ollama' },
    args: {
      session: { type: 'string', description: 'Filter to a specific session ID', default: '' },
      projectid: { type: 'string', description: 'Project id', default: '' },
      force: { type: 'boolean', description: 'Re-generate even if unchanged', default: false },
    },
    async run({ args }) {
      const projectRoot = getProjectRoot(args);
      try {
        const { summarize } = require('../../lib/context-index/index.cjs');
        const opts = { projectRoot, force: !!args.force };
        if (args.session) opts.since = args.session; // summarizer accepts since as session filter proxy
        const result = await summarize(opts);
        console.log(`written=${result.written.length} skipped=${result.skipped.length}${result.error ? ` error=${result.error}` : ''}`);
        if (result.written.length > 0) {
          console.log('Written summaries:');
          for (const p of result.written) console.log('  ' + p);
        }
      } catch (err) {
        outputError(err.message);
        process.exit(1);
      }
    },
  });

  const rebuildCmd = defineCommand({
    meta: { name: 'rebuild', description: 'Re-ingest all sources and rebuild the BM25 index' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      since: { type: 'string', description: 'Only ingest events newer than this (ISO or duration like 1h)', default: '' },
    },
    async run({ args }) {
      const projectRoot = getProjectRoot(args);
      try {
        const { ingest, rebuild } = require('../../lib/context-index/index.cjs');
        let result;
        if (args.since) {
          // Incremental: ingest only new events, then rebuild index
          const sinceIso = resolveSince(String(args.since));
          await ingest({ projectRoot, since: sinceIso });
          const { buildIndex, readNdjson } = require('../../lib/context-index/search.cjs');
          const evPath = eventsPath(projectRoot);
          const idxPath = indexPath(projectRoot);
          const { count } = buildIndex(evPath, idxPath);
          const total = readNdjson(evPath).length;
          result = { events: total, indexed: count };
        } else {
          result = await rebuild({ projectRoot });
        }
        console.log(`events=${result.events} indexed=${result.indexed}`);
      } catch (err) {
        outputError(err.message);
        process.exit(1);
      }
    },
  });

  const statusCmd = defineCommand({
    meta: { name: 'status', description: 'Show index health: build time, event counts, summary count' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      json: { type: 'boolean', description: 'Emit JSON', default: false },
    },
    async run({ args }) {
      const projectRoot = getProjectRoot(args);
      const store = storeDir(projectRoot);

      const evPath = eventsPath(projectRoot);
      const idxPath = indexPath(projectRoot);
      const sumDir = summariesDir(projectRoot);

      let eventCount = 0;
      let indexMtime = null;
      let indexSizeKb = 0;
      let summaryCount = 0;

      try {
        if (fs.existsSync(evPath)) {
          const lines = fs.readFileSync(evPath, 'utf8').split('\n').filter(l => l.trim());
          eventCount = lines.length;
        }
        if (fs.existsSync(idxPath)) {
          const stat = fs.statSync(idxPath);
          indexMtime = stat.mtime.toISOString();
          indexSizeKb = Math.round(stat.size / 1024);
        }
        if (fs.existsSync(sumDir)) {
          summaryCount = fs.readdirSync(sumDir).filter(f => f.endsWith('.md')).length;
        }
      } catch (err) {
        outputError(err.message);
        process.exit(1);
      }

      const info = {
        projectRoot,
        store,
        eventCount,
        indexBuiltAt: indexMtime,
        indexSizeKb,
        summaryCount,
        indexExists: !!indexMtime,
      };

      if (args.json) {
        console.log(JSON.stringify(info, null, 2));
      } else {
        console.log(`store:        ${store}`);
        console.log(`events:       ${eventCount}`);
        console.log(`index built:  ${indexMtime ?? '(none)'}`);
        console.log(`index size:   ${indexSizeKb} KB`);
        console.log(`summaries:    ${summaryCount}`);
      }
    },
  });

  const contextCmd = defineCommand({
    meta: { name: 'context', description: 'Context-index CLI: query / summarize / rebuild / status' },
    subCommands: {
      query: queryCmd,
      summarize: summarizeCmd,
      rebuild: rebuildCmd,
      status: statusCmd,
    },
  });

  return { context: contextCmd };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a human duration like "1h", "30m", "2d" to an ISO timestamp
 * representing "now minus that duration". Falls through to raw string
 * if it doesn't match the pattern (assumes it's already an ISO date).
 */
function resolveSince(raw) {
  const m = raw.match(/^(\d+(?:\.\d+)?)(s|m|h|d)$/i);
  if (!m) return raw; // assume ISO
  const val = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const msMap = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() - val * msMap[unit]).toISOString();
}

module.exports = { register };
