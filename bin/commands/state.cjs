'use strict';
/**
 * gad state — show / set-next-action / log subcommands.
 *
 * Extracted from bin/gad.cjs in sweep E (2026-04-19, opus-claude) per
 * decision gad-D-NN. Factory pattern: receives shared helpers as deps so
 * we don't have to extract `resolveRoots` (and its transitive
 * `getActiveSessionProjectId` / `loadSessions` chain) in this sweep.
 *
 * Sweep E carries 3 small, recently-touched command families out of the
 * 18,437-line bin/gad.cjs to demonstrate the modular-commands pattern.
 * Future sweeps (F, G, ...) extract more families and ultimately move
 * shared helpers into lib/cli-helpers.cjs.
 *
 * Required deps (all from gad.cjs scope):
 *   findRepoRoot, gadConfig, resolveRoots, outputError,
 *   render, shouldUseJson, readState,
 *   graphExtractor, maybeRebuildGraph
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

// Hard cap on STATE.xml <next-action> writes (per gad-D-NN — anti-bloat
// guard). next-action is a pointer to the next pick, NOT a running journal.
// Activity logging belongs in TASK-REGISTRY <resolution> blocks and
// DECISIONS.xml entries. Cap at 600 chars to enforce discipline.
const NEXT_ACTION_MAX_CHARS = 600;

function createStateCommand(deps) {
  const {
    findRepoRoot, gadConfig, resolveRoots, outputError,
    render, shouldUseJson, readState,
    graphExtractor, maybeRebuildGraph,
  } = deps;

  const stateShowCmd = defineCommand({
    meta: { name: 'show', description: 'Show current state for all projects' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
      graph: { type: 'boolean', description: 'Include graph stats (auto-enabled when useGraphQuery=true)', default: false },
      json: { type: 'boolean', description: 'JSON output (includes full next-action)', default: false },
      full: { type: 'boolean', description: 'Include full next-action text in output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;

      function getGraphStats(root) {
        const showGraph = args.graph || graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path));
        if (!showGraph) return null;
        const planDir = path.join(baseDir, root.path, root.planningDir);
        const jsonPath = path.join(planDir, 'graph.json');
        if (!fs.existsSync(jsonPath)) return null;
        try {
          const graph = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          return {
            nodes: graph.meta.nodeCount,
            edges: graph.meta.edgeCount,
            generated: graph.meta.generated,
            nodeTypes: graph.meta.nodeTypes,
          };
        } catch { return null; }
      }

      if (args.json) {
        const out = roots.map(root => {
          const state = readState(root, baseDir);
          const result = {
            project: root.id,
            phase: state.phasesTotal > 0 ? `${state.phasesComplete}/${state.phasesTotal}` : (state.currentPhase || null),
            milestone: state.milestone || null,
            status: state.status,
            openTasks: state.openTasks,
            lastActivity: state.lastActivity || null,
            nextAction: state.nextAction || null,
          };
          if (state.level) {
            result.level = state.level;
          }
          const gs = getGraphStats(root);
          if (gs) result.graph = gs;
          return result;
        });
        console.log(JSON.stringify(out, null, 2));
        return;
      }

      const rows = roots.map(root => {
        const state = readState(root, baseDir);
        return {
          project: root.id,
          phase: state.phasesTotal > 0 ? `${state.phasesComplete}/${state.phasesTotal}` : (state.currentPhase || '—'),
          milestone: state.milestone || '—',
          status: state.status,
          'open tasks': state.openTasks > 0 ? String(state.openTasks) : '—',
          'last activity': state.lastActivity || '—',
          level: state.level ? `L${state.level.value}` : '—',
          xp: state.level ? `${state.level.xp}/${state.level.xpToNext}` : '—',
          _nextAction: state.nextAction || null,
          _graphStats: getGraphStats(root),
        };
      });

      const displayRows = rows.map(({ _nextAction, _graphStats, ...r }) => r);
      console.log(render(displayRows, { format: 'table', title: 'GAD State' }));

      if (args.full) {
        for (const r of rows) {
          if (r._nextAction) {
            console.log(`\n── next action [${r.project}] ──────────────────────────────`);
            console.log(r._nextAction);
          }
        }
      }

      for (const r of rows) {
        if (r._graphStats) {
          const gs = r._graphStats;
          console.log(`\n── graph [${r.project}] ──────────────────────────────`);
          console.log(`  ${gs.nodes} nodes, ${gs.edges} edges`);
          console.log(`  Types: ${Object.entries(gs.nodeTypes).map(([k, v]) => `${k}(${v})`).join(', ')}`);
          console.log(`  Last rebuild: ${gs.generated}`);
        }
      }
    },
  });

  // shouldUseJson is currently unused in stateShowCmd above (it has its own
  // --json flag). Reference here keeps it in the destructure for future use
  // and silences "unused dep" lint.
  void shouldUseJson;

  const stateSetNextActionCmd = defineCommand({
    meta: { name: 'set-next-action', description: 'DEPRECATED: Use `gad state log` instead. Appends to <state-log> and warns.' },
    args: {
      text: { type: 'positional', description: 'Log entry text (use quotes)', required: true },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    },
    run({ args }) {
      console.warn('\n[DEPRECATED] `gad state set-next-action` is deprecated and will be removed.');
      console.warn('Redirecting to `gad state log` with the current phase as a tag.\n');

      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or run from a project root.');
        return;
      }
      const root = roots[0];
      const state = readState(root, baseDir);
      const currentPhase = state.currentPhase || '';

      // Delegate to log logic
      stateLogCmd.run({
        args: {
          message: args.text,
          tags: currentPhase,
          agent: process.env.GAD_AGENT_NAME || 'legacy-setter',
          projectid: root.id,
        },
      });
    },
  });

  // state log — append-only entries to STATE.xml (post-2026-04-19, sweep D-3).
  //
  // The single <next-action> essay block was being rewritten wholesale by
  // every agent (166 commits / 14d), losing prior context every time. This
  // adds a sibling <state-log> with newest-first <entry agent="X" at="ISO">
  // elements that any agent can append to atomically. <next-action> is now
  // reserved for "what should the next agent do RIGHT NOW" — short and
  // current — while <state-log> carries the running journal.
  const stateLogCmd = defineCommand({
    meta: { name: 'log', description: 'Append a one-line entry to <state-log> in STATE.xml. Use --tail N to read recent entries instead.' },
    args: {
      message: { type: 'positional', description: 'One-line summary of what just happened (omit with --tail to read-only)', required: false },
      tags: { type: 'string', description: 'Comma-separated tags (e.g. diff-noise,sweep-d)', default: '' },
      agent: { type: 'string', description: 'Agent slug (defaults to $GAD_AGENT_NAME)', default: '' },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      tail: { type: 'string', description: 'Print last N <state-log> entries and exit (no write)', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or run from a project root.');
        return;
      }
      if (roots.length > 1) {
        outputError('state log requires a single project. Pass --projectid <id>.');
        return;
      }
      const root = roots[0];
      const stateXml = path.join(baseDir, root.path, root.planningDir, 'STATE.xml');
      if (!fs.existsSync(stateXml)) {
        outputError(`STATE.xml not found at ${stateXml}`);
        process.exit(1);
        return;
      }

      // --tail N: read-only mode — parse last N entries and print them.
      const tailArg = String(args.tail || '').trim();
      if (tailArg) {
        const n = parseInt(tailArg, 10);
        if (!n || n < 1) {
          outputError('--tail requires a positive integer (e.g. --tail 5)');
          process.exit(1);
          return;
        }
        const xml = fs.readFileSync(stateXml, 'utf8');
        // Extract all <entry …>…</entry> elements from <state-log>
        const logMatch = xml.match(/<state-log>([\s\S]*?)<\/state-log>/);
        if (!logMatch) {
          console.log('(no <state-log> block found in STATE.xml)');
          return;
        }
        const logBody = logMatch[1];
        // Parse entries: <entry agent="X" at="ISO" [tags="T"]>msg</entry>
        const entryRe = /<entry([^>]*)>([\s\S]*?)<\/entry>/g;
        const entries = [];
        let m;
        while ((m = entryRe.exec(logBody)) !== null) {
          const attrs = m[1];
          const text = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          const agentM = attrs.match(/agent="([^"]*)"/);
          const atM = attrs.match(/at="([^"]*)"/);
          const tagsM = attrs.match(/tags="([^"]*)"/);
          entries.push({
            agent: agentM ? agentM[1] : '?',
            at: atM ? atM[1] : '?',
            tags: tagsM ? tagsM[1] : '',
            text,
          });
        }
        // Entries are newest-first in the file; take the first N.
        const slice = entries.slice(0, n);
        console.log(`[state log --tail ${n}] (${slice.length} of ${entries.length} entries)`);
        for (const e of slice) {
          const tagsLabel = e.tags ? ` [${e.tags}]` : '';
          console.log(`  ${e.at}  ${e.agent}${tagsLabel}`);
          console.log(`    ${e.text}`);
        }
        return;
      }

      // No --tail: write mode — require message.
      if (!args.message) {
        outputError('Missing required positional argument: MESSAGE (or pass --tail N to read recent entries)');
        process.exit(1);
        return;
      }

      const agent = String(args.agent || process.env.GAD_AGENT_NAME || 'unknown');
      const tags = String(args.tags || '');
      const at = new Date().toISOString();
      const message = String(args.message);

      const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      const tagsAttr = tags ? ` tags="${escAttr(tags)}"` : '';
      const entry = `    <entry agent="${escAttr(agent)}" at="${at}"${tagsAttr}>${escape(message)}</entry>\n`;

      let xml = fs.readFileSync(stateXml, 'utf8');
      if (/<state-log>/.test(xml)) {
        xml = xml.replace(/<state-log>\s*\n/, (m) => m + entry);
      } else {
        xml = xml.replace(/<\/state>/, `  <state-log>\n${entry}  </state-log>\n</state>`);
      }
      fs.writeFileSync(stateXml, xml);
      console.log(`Logged: [${agent}] ${message}`);
      console.log(`File:   ${path.relative(baseDir, stateXml)}`);
    },
  });

  return defineCommand({
    meta: { name: 'state', description: 'Show or update STATE.xml (show / set-next-action / log)' },
    subCommands: {
      show: stateShowCmd,
      'set-next-action': stateSetNextActionCmd,
      log: stateLogCmd,
    },
  });
}

module.exports = { createStateCommand, NEXT_ACTION_MAX_CHARS };
module.exports.register = (ctx) => ({ state: createStateCommand(ctx.common) });
