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

const fs = require('fs');
const path = require('path');
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

  // Shared list logic — used both for bare `gad errors` and `gad errors list`.
  function runList(args) {
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
  }

  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List error attempts from ERRORS-AND-ATTEMPTS.xml' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
      status: { type: 'string', description: 'Filter by status: open|resolved|partial', default: '' },
      phase: { type: 'string', description: 'Filter by phase id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) { runList(args); },
  });

  const addCmd = defineCommand({
    meta: { name: 'add', description: 'Append an error entry to ERRORS-AND-ATTEMPTS.xml' },
    args: {
      projectid: { type: 'string', description: 'Target project id', required: true },
      id:        { type: 'string', description: 'Stable slug for the error entry (e.g. foo-bug-2026-04-23)', required: true },
      title:     { type: 'string', description: 'One-line summary (goes in <summary>)', required: true },
      context:   { type: 'string', description: 'What happened / setup (<context>)', default: '' },
      failure:   { type: 'string', description: 'How it failed / trust cost (<failure>)', default: '' },
      rule:      { type: 'string', description: 'Rule for future agents (<rule>)', default: '' },
      reference: { type: 'string', description: 'File path or URL reference. Semicolon-separated for multiple.', default: '' },
      phase:     { type: 'string', description: 'Phase id (e.g. 05)', default: '' },
      task:      { type: 'string', description: 'Task id (e.g. 05-40)', default: '' },
      status:    { type: 'string', description: 'open | resolved | partial (default: open)', default: 'open' },
      kind:      { type: 'string', description: 'Optional kind attribute (framework | conversational | scope | verification | ...)', default: '' },
      date:      { type: 'string', description: 'YYYY-MM-DD (default: today UTC)', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        process.stderr.write(`Project not found: ${args.projectid}\n`);
        process.exit(1);
      }
      const root = roots[0];
      const xmlFile = path.join(baseDir, root.path, root.planningDir, 'ERRORS-AND-ATTEMPTS.xml');
      const date = args.date || new Date().toISOString().slice(0, 10);

      ensureErrorsFile(xmlFile);

      const existing = fs.readFileSync(xmlFile, 'utf8');
      if (new RegExp(`\\bid="${escapeRegExp(args.id)}"`).test(existing)) {
        process.stderr.write(`Duplicate id: ${args.id} already present in ${path.relative(baseDir, xmlFile)}. Edit the file directly to update.\n`);
        process.exit(1);
      }

      const refs = String(args.reference || '')
        .split(';')
        .map(s => s.trim())
        .filter(Boolean);

      const attrs = [
        `id="${escapeAttr(args.id)}"`,
        `date="${escapeAttr(date)}"`,
        args.phase ? `phase="${escapeAttr(args.phase)}"` : '',
        args.task ? `task="${escapeAttr(args.task)}"` : '',
        `status="${escapeAttr(args.status || 'open')}"`,
        args.kind ? `kind="${escapeAttr(args.kind)}"` : '',
      ].filter(Boolean).join(' ');

      const lines = [
        ``,
        `  <entry ${attrs}>`,
        `    <summary>${escapeXml(args.title)}</summary>`,
      ];
      if (args.context) lines.push(`    <context>${escapeXml(args.context)}</context>`);
      if (args.failure) lines.push(`    <failure>${escapeXml(args.failure)}</failure>`);
      if (args.rule)    lines.push(`    <rule>${escapeXml(args.rule)}</rule>`);
      for (const r of refs)  lines.push(`    <reference>${escapeXml(r)}</reference>`);
      lines.push(`  </entry>`);
      const block = lines.join('\n') + '\n';

      const closeTag = '</errors-and-attempts>';
      if (!existing.includes(closeTag)) {
        process.stderr.write(`${path.relative(baseDir, xmlFile)} missing </errors-and-attempts> close tag; refusing to edit.\n`);
        process.exit(1);
      }
      const next = existing.replace(closeTag, `${block}${closeTag}`);
      fs.writeFileSync(xmlFile, next);
      const fmt = args.json || shouldUseJson() ? 'json' : 'text';
      if (fmt === 'json') {
        console.log(JSON.stringify({ project: root.id, id: args.id, file: path.relative(baseDir, xmlFile) }, null, 2));
      } else {
        console.log(`Added ${args.id} to ${path.relative(baseDir, xmlFile)}`);
      }
    },
  });

  return defineCommand({
    meta: { name: 'errors', description: 'List or add error attempts in ERRORS-AND-ATTEMPTS.xml' },
    subCommands: { list: listCmd, add: addCmd },
  });
}

function ensureErrorsFile(xmlFile) {
  if (fs.existsSync(xmlFile)) return;
  fs.mkdirSync(path.dirname(xmlFile), { recursive: true });
  const skeleton = `<?xml version="1.0" encoding="UTF-8"?>\n<errors-and-attempts>\n</errors-and-attempts>\n`;
  fs.writeFileSync(xmlFile, skeleton);
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return String(value ?? '').replace(/"/g, '&quot;').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      status: { type: 'string', description: 'Filter by status: open|resolved|wont-fix (defaults to open)', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;
      const filter = { status: args.status || 'open' };

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
