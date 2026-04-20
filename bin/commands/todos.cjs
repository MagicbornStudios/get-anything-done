'use strict';
/**
 * gad todos — list / add subcommands.
 *
 * Extracted from bin/gad.cjs in sweep E (2026-04-19, opus-claude).
 * See bin/commands/state.cjs for the factory pattern rationale.
 *
 * Required deps:
 *   findRepoRoot, gadConfig, resolveRoots, outputError,
 *   render, shouldUseJson, listTodos, writeTodo
 */

const path = require('path');
const { defineCommand } = require('citty');

function createTodosCommand(deps) {
  const {
    findRepoRoot, gadConfig, resolveRoots, outputError,
    render, shouldUseJson, listTodos, writeTodo,
  } = deps;

  const todosListCmd = defineCommand({
    meta: { name: 'list', description: 'List todo files from .planning/todos/' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) return;

      const rows = [];
      for (const root of roots) {
        for (const t of listTodos(root, baseDir)) {
          rows.push({ project: root.id, date: t.date, slug: t.slug, file: t.filename });
        }
      }
      if (rows.length === 0) {
        console.log('No todos found. Create with `gad todos add <slug> ...`.');
        return;
      }
      const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
      console.log(render(rows, { format: fmt, title: `Todos (${rows.length})` }));
    },
  });

  const todosAddCmd = defineCommand({
    meta: { name: 'add', description: 'Create a new todo md file in .planning/todos/. Fails if slug+date collides.' },
    args: {
      slug: { type: 'positional', description: 'Short slug (e.g. context-surgery-runtime)', required: true },
      title: { type: 'string', description: 'Human title for the H1', required: true },
      body: { type: 'string', description: 'Todo body (markdown)', required: true },
      source: { type: 'string', description: 'Provenance line (e.g. "session 2026-04-17 strategy pivot")', default: '' },
      date: { type: 'string', description: 'Date stamp YYYY-MM-DD (defaults to today)', default: '' },
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
        outputError('todos add requires a single project. Pass --projectid <id>.');
        return;
      }
      const root = roots[0];
      try {
        const result = writeTodo(root, baseDir, {
          slug: String(args.slug),
          title: String(args.title),
          body: String(args.body),
          source: String(args.source || ''),
          date: String(args.date || ''),
        });
        console.log(`Added todo: ${result.filename}`);
        console.log(`File:    ${path.relative(baseDir, result.filePath)}`);
      } catch (e) {
        outputError(e.message);
        process.exit(1);
      }
    },
  });

  return defineCommand({
    meta: { name: 'todos', description: 'Manage parked todos in .planning/todos/ — list (default), add' },
    subCommands: {
      list: todosListCmd,
      add: todosAddCmd,
    },
  });
}

module.exports = { createTodosCommand };
module.exports.register = (ctx) => ({ todos: createTodosCommand(ctx.common) });
