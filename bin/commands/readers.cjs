'use strict';
/**
 * gad requirements / errors / blockers — three single-command readers
 * grouped into one module because they share the same shape (read XML
 * under .planning/, render rows). Each is its own top-level command.
 *
 * Required deps:
 *   findRepoRoot, gadConfig, resolveRoots,
 *   render, shouldUseJson,
 *   readRequirements, readDocFlow, readErrors, readBlockers
 */

const { defineCommand } = require('citty');

function createRequirementsCommand(deps) {
  const {
    findRepoRoot, gadConfig, resolveRoots,
    render, shouldUseJson, readRequirements, readDocFlow,
  } = deps;

  return defineCommand({
    meta: { name: 'requirements', description: 'List requirement doc references from REQUIREMENTS.xml' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;

      const rows = [];
      for (const root of roots) {
        const refs = readRequirements(root, baseDir);
        for (const r of refs) {
          rows.push({ project: root.id, kind: r.kind, path: r.docPath, description: r.description });
        }
        const docFlow = readDocFlow(root, baseDir);
        for (const d of docFlow) {
          rows.push({ project: root.id, kind: 'doc-flow', path: d.name, description: d.description });
        }
      }

      if (rows.length === 0) {
        console.log('No requirement refs found. Create REQUIREMENTS.xml in your .planning/ directories.');
        return;
      }

      const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
      if (fmt === 'json') {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        const tableRows = rows.map(r => ({
          project: r.project,
          kind: r.kind,
          path: r.path,
          description: r.description.length > 70 ? r.description.slice(0, 67) + '...' : r.description,
        }));
        console.log(render(tableRows, { format: 'table', title: `Requirement refs (${rows.length})` }));
      }
    },
  });
}

function createErrorsCommand(deps) {
  const {
    findRepoRoot, gadConfig, resolveRoots,
    render, shouldUseJson, readErrors,
  } = deps;

  return defineCommand({
    meta: { name: 'errors', description: 'List error attempts from ERRORS-AND-ATTEMPTS.xml' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
      status: { type: 'string', description: 'Filter by status: open|resolved|partial', default: '' },
      phase: { type: 'string', description: 'Filter by phase id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;
      const filter = {};
      if (args.status) filter.status = args.status;
      if (args.phase)  filter.phase  = args.phase;

      const rows = [];
      for (const root of roots) {
        for (const e of readErrors(root, baseDir, filter)) {
          rows.push({ project: root.id, id: e.id, phase: e.phase, task: e.task, status: e.status, title: e.title, symptom: e.symptom, cause: e.cause, fix: e.fix, commands: e.commands });
        }
      }
      if (rows.length === 0) { console.log('No error attempts found.'); return; }
      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        const tableRows = rows.map(r => ({
          project: r.project, id: r.id, phase: r.phase, task: r.task, status: r.status,
          title: r.title.length > 60 ? r.title.slice(0, 57) + '...' : r.title,
        }));
        console.log(render(tableRows, { format: 'table', title: `Errors & Attempts (${rows.length})` }));
      }
    },
  });
}

function createBlockersCommand(deps) {
  const {
    findRepoRoot, gadConfig, resolveRoots,
    render, shouldUseJson, readBlockers,
  } = deps;

  return defineCommand({
    meta: { name: 'blockers', description: 'List blockers from BLOCKERS.xml' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
      status: { type: 'string', description: 'Filter by status: open|resolved|wont-fix', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;
      const filter = args.status ? { status: args.status } : {};

      const rows = [];
      for (const root of roots) {
        for (const b of readBlockers(root, baseDir, filter)) {
          rows.push({ project: root.id, id: b.id, status: b.status, title: b.title, summary: b.summary, taskRef: b.taskRef });
        }
      }
      if (rows.length === 0) { console.log('No blockers found.'); return; }
      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        const tableRows = rows.map(r => ({
          project: r.project, id: r.id, status: r.status, task: r.taskRef,
          title: r.title.length > 60 ? r.title.slice(0, 57) + '...' : r.title,
        }));
        console.log(render(tableRows, { format: 'table', title: `Blockers (${rows.length})` }));
      }
    },
  });
}

module.exports = { createRequirementsCommand, createErrorsCommand, createBlockersCommand };
module.exports.register = (ctx) => ({
  requirements: createRequirementsCommand(ctx.common),
  errors: createErrorsCommand(ctx.common),
  blockers: createBlockersCommand(ctx.common),
});
