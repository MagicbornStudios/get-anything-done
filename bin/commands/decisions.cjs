'use strict';
/**
 * gad decisions — list / show / add subcommands.
 *
 * Required deps:
 *   findRepoRoot, gadConfig, resolveRoots, outputError,
 *   render, shouldUseJson, readDecisions, writeDecision,
 *   formatId, maybeRebuildGraph
 */

const path = require('path');
const { defineCommand } = require('citty');

function createDecisionsCommand(deps) {
  const {
    findRepoRoot, gadConfig, resolveRoots, outputError,
    render, shouldUseJson, readDecisions, writeDecision,
    formatId, maybeRebuildGraph,
  } = deps;

  const decisionsListCmd = defineCommand({
    meta: { name: 'list', description: 'List decisions from DECISIONS.xml' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
      id: { type: 'string', description: 'Filter to a single decision by id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;

      const filter = args.id ? { id: args.id } : {};
      const rows = [];
      for (const root of roots) {
        const decisions = readDecisions(root, baseDir, filter);
        for (const d of decisions) {
          rows.push({
            project: root.id,
            id: d.id,
            title: d.title,
            summary: d.summary,
            impact: d.impact,
            references: d.references,
          });
        }
      }

      if (rows.length === 0) {
        console.log('No decisions found.');
        return;
      }

      const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
      if (fmt === 'json') {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        const tableRows = rows.map(r => ({
          project: r.project,
          id: formatId(r.project, 'D', r.id.replace(/^gad-/, '')),
          'legacy-id': r.id,
          title: r.title.length > 50 ? r.title.slice(0, 47) + '...' : r.title,
          summary: r.summary.length > 80 ? r.summary.slice(0, 77) + '...' : r.summary,
        }));
        console.log(render(tableRows, { format: 'table', title: `Decisions (${rows.length})` }));
      }
    },
  });

  const decisionsShowCmd = defineCommand({
    meta: { name: 'show', description: 'Show the full body of one decision from DECISIONS.xml' },
    args: {
      id: { type: 'positional', description: 'Decision id (e.g. gad-233)', required: true },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Show all matching projects', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;

      const matches = [];
      for (const root of roots) {
        const decisions = readDecisions(root, baseDir, { id: String(args.id) });
        for (const decision of decisions) {
          matches.push({ project: root.id, ...decision });
        }
      }

      if (matches.length === 0) {
        outputError(`Decision not found: ${args.id}`);
      }

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(matches, null, 2));
        return;
      }

      for (const [index, decision] of matches.entries()) {
        if (index > 0) console.log('');
        console.log(`Decision: ${decision.id}`);
        console.log(`Project:  ${decision.project}`);
        console.log(`Title:    ${decision.title || '(untitled)'}`);
        console.log('');
        console.log('Summary:');
        console.log(decision.summary || '(none)');
        if (decision.impact) {
          console.log('');
          console.log('Impact:');
          console.log(decision.impact);
        }
        if (decision.references && decision.references.length > 0) {
          console.log('');
          console.log('References:');
          for (const ref of decision.references) console.log(`  - ${ref}`);
        }
      }
    },
  });

  const decisionsAddCmd = defineCommand({
    meta: { name: 'add', description: 'Append a <decision> to DECISIONS.xml. Fails if id collides.' },
    args: {
      id: { type: 'positional', description: 'Decision id (e.g. gad-233)', required: true },
      title: { type: 'string', description: 'Short decision title', required: true },
      summary: { type: 'string', description: 'Full summary text', required: true },
      impact: { type: 'string', description: 'Impact statement (optional)', default: '' },
      date: { type: 'string', description: 'Decision date (YYYY-MM-DD, optional)', default: '' },
      refs: { type: 'string', description: 'Comma-separated file paths for <references>', default: '' },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
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
        outputError('decisions add requires a single project. Pass --projectid <id>.');
        return;
      }
      const root = roots[0];
      const references = String(args.refs || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      try {
        const result = writeDecision(root, baseDir, {
          id: String(args.id),
          title: String(args.title),
          summary: String(args.summary),
          impact: String(args.impact || ''),
          date: String(args.date || ''),
          references,
        });
        console.log(`Added decision ${args.id}: ${args.title}`);
        console.log(`File:    ${path.relative(baseDir, result.filePath)}`);
        console.log(`Total:   ${result.count} decision(s)`);
        maybeRebuildGraph(baseDir, root);
      } catch (e) {
        outputError(e.message);
        process.exit(1);
      }
    },
  });

  return defineCommand({
    meta: { name: 'decisions', description: 'Manage decisions — list (default), add' },
    subCommands: {
      list: decisionsListCmd,
      show: decisionsShowCmd,
      add: decisionsAddCmd,
    },
  });
}

module.exports = { createDecisionsCommand };
module.exports.register = (ctx) => ({ decisions: createDecisionsCommand(ctx.common) });
