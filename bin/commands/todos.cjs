'use strict';
/**
 * gad todos — list / add / snooze / done subcommands.
 *
 * Extracted from bin/gad.cjs in sweep E (2026-04-19, opus-claude).
 * Extended in phase 165 (2026-05-07) with owner, snoozed_until, snooze, done.
 * See bin/commands/state.cjs for the factory pattern rationale.
 *
 * Required deps:
 *   findRepoRoot, gadConfig, resolveRoots, outputError,
 *   render, shouldUseJson, listTodos, writeTodo
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createTodosCommand(deps) {
  const {
    findRepoRoot, gadConfig, resolveRoots, outputError,
    render, shouldUseJson, listTodos, writeTodo,
  } = deps;

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------

  /**
   * Resolve the todos dir for the first matching root of a projectid.
   * Returns { dir, root } or null.
   */
  function resolveTodosDir(projectid) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots({ projectid }, baseDir, config.roots);
    if (!roots || roots.length === 0) return null;
    const root = roots[0];
    const dir = path.join(baseDir, root.path, root.planningDir, 'todos');
    return { dir, root, baseDir };
  }

  /** Find a todo file by slug inside a todos dir. */
  function findTodoFile(dir, slug) {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    const target = files.find(f => {
      const m = f.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
      return m && m[2] === slug;
    });
    return target ? path.join(dir, target) : null;
  }

  /** Parse YAML frontmatter from a file (key: value lines, no nested). */
  function parseFrontmatter(content) {
    const fm = {};
    let bodyText = content;
    if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
      return { fm, bodyText };
    }
    const end = content.indexOf('\n---', 4);
    if (end === -1) return { fm, bodyText };
    const block = content.slice(4, end);
    bodyText = content.slice(end + 4).replace(/^\r?\n/, '');
    for (const line of block.split('\n')) {
      const ci = line.indexOf(':');
      if (ci === -1) continue;
      const k = line.slice(0, ci).trim();
      const raw = line.slice(ci + 1).trim();
      if (raw === 'null' || raw === '') fm[k] = null;
      else if (raw === 'true') fm[k] = true;
      else if (raw === 'false') fm[k] = false;
      else fm[k] = raw.replace(/^["']|["']$/g, '');
    }
    return { fm, bodyText };
  }

  /** Serialize frontmatter object to YAML block. */
  function serializeFm(fm) {
    const lines = Object.entries(fm).map(([k, v]) =>
      v === null || v === undefined ? `${k}: null` : `${k}: ${v}`
    );
    return `---\n${lines.join('\n')}\n---\n`;
  }

  /** Patch frontmatter of an existing todo file. */
  function patchFm(filePath, patch) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { fm, bodyText } = parseFrontmatter(raw);
    const updated = Object.assign({}, fm, patch);
    fs.writeFileSync(filePath, serializeFm(updated) + bodyText);
  }

  /** Check if a todo is currently snoozed. */
  function isSnoozed(todo) {
    if (!todo.snoozed_until) return false;
    return new Date(todo.snoozed_until) > new Date();
  }

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  const todosListCmd = defineCommand({
    meta: { name: 'list', description: 'List todo files from .planning/todos/' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
      owner: { type: 'string', description: 'Filter by owner (operator|agent|any)', default: '' },
      'not-snoozed': { type: 'boolean', description: 'Exclude todos that are currently snoozed', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) return;

      const rows = [];
      for (const root of roots) {
        for (const t of listTodos(root, baseDir)) {
          // owner filter
          if (args.owner && t.owner !== args.owner) continue;
          // not-snoozed filter
          if (args['not-snoozed'] && isSnoozed(t)) continue;
          rows.push({
            project: root.id,
            date: t.date,
            slug: t.slug,
            file: t.filename,
            owner: t.owner || 'any',
            snoozed_until: t.snoozed_until || null,
            title: t.title || '',
            body: t.body || '',
          });
        }
      }
      if (rows.length === 0) {
        if (args.json || shouldUseJson()) {
          console.log('[]');
        } else {
          console.log('No todos found matching filters.');
        }
        return;
      }
      const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
      if (fmt === 'json') {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        // Table view: omit body to keep output concise
        const tableRows = rows.map(r => ({
          project: r.project,
          date: r.date,
          slug: r.slug,
          owner: r.owner,
          snoozed_until: r.snoozed_until || '-',
          file: r.file,
        }));
        console.log(render(tableRows, { format: 'table', title: `Todos (${tableRows.length})` }));
      }
    },
  });

  // -------------------------------------------------------------------------
  // add
  // -------------------------------------------------------------------------

  const todosAddCmd = defineCommand({
    meta: { name: 'add', description: 'Create a new todo md file in .planning/todos/. Fails if slug+date collides.' },
    args: {
      slug: { type: 'positional', description: 'Short slug (e.g. context-surgery-runtime)', required: true },
      title: { type: 'string', description: 'Human title for the H1', required: true },
      body: { type: 'string', description: 'Todo body (markdown)', required: true },
      source: { type: 'string', description: 'Provenance line (e.g. "session 2026-04-17 strategy pivot")', default: '' },
      date: { type: 'string', description: 'Date stamp YYYY-MM-DD (defaults to today)', default: '' },
      owner: { type: 'string', description: 'Owner: operator|agent|any (default: any)', default: 'any' },
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
          owner: String(args.owner || 'any'),
        });
        console.log(`Added todo: ${result.filename}`);
        console.log(`File:    ${path.relative(baseDir, result.filePath)}`);
      } catch (e) {
        outputError(e.message);
        process.exit(1);
      }
    },
  });

  // -------------------------------------------------------------------------
  // snooze
  // -------------------------------------------------------------------------

  const todosSnoozeCmd = defineCommand({
    meta: { name: 'snooze', description: 'Snooze a todo by slug for --hours N, --days N, or --until <ISO>.' },
    args: {
      slug: { type: 'positional', description: 'Todo slug (e.g. funding-outreach-and-business-setup)', required: true },
      hours: { type: 'string', description: 'Number of hours to snooze', default: '' },
      days: { type: 'string', description: 'Number of days to snooze', default: '' },
      until: { type: 'string', description: 'Snooze until this ISO datetime', default: '' },
      projectid: { type: 'string', description: 'Project scope', default: '' },
    },
    run({ args }) {
      if (!args.hours && !args.days && !args.until) {
        outputError('Provide --hours <N>, --days <N>, or --until <ISO>.');
        process.exit(1);
        return;
      }

      const resolved = resolveTodosDir(args.projectid);
      if (!resolved) {
        outputError('No project resolved.');
        process.exit(1);
        return;
      }

      const filePath = findTodoFile(resolved.dir, String(args.slug));
      if (!filePath) {
        outputError(`Todo not found: ${args.slug}`);
        process.exit(1);
        return;
      }

      let until;
      if (args.until) {
        until = new Date(args.until);
      } else if (args.hours) {
        const h = parseFloat(args.hours);
        if (isNaN(h) || h <= 0) { outputError('--hours must be a positive number.'); process.exit(1); return; }
        until = new Date(Date.now() + h * 3600 * 1000);
      } else if (args.days) {
        const d = parseFloat(args.days);
        if (isNaN(d) || d <= 0) { outputError('--days must be a positive number.'); process.exit(1); return; }
        until = new Date(Date.now() + d * 86400 * 1000);
      }

      patchFm(filePath, { snoozed_until: until.toISOString() });
      console.log(`Snoozed until: ${until.toISOString()}`);
      console.log(`File: ${path.relative(resolved.baseDir, filePath)}`);
    },
  });

  // -------------------------------------------------------------------------
  // done
  // -------------------------------------------------------------------------

  const todosDoneCmd = defineCommand({
    meta: { name: 'done', description: 'Mark a todo done — moves it to .planning/todos/done/ (or sets done: true with --keep).' },
    args: {
      slug: { type: 'positional', description: 'Todo slug', required: true },
      keep: { type: 'boolean', description: 'Do not move; just add done: true to frontmatter', default: false },
      projectid: { type: 'string', description: 'Project scope', default: '' },
    },
    run({ args }) {
      const resolved = resolveTodosDir(args.projectid);
      if (!resolved) {
        outputError('No project resolved.');
        process.exit(1);
        return;
      }

      const filePath = findTodoFile(resolved.dir, String(args.slug));
      if (!filePath) {
        outputError(`Todo not found: ${args.slug}`);
        process.exit(1);
        return;
      }

      if (args.keep) {
        patchFm(filePath, { done: true });
        console.log(`Marked done (in place): ${path.relative(resolved.baseDir, filePath)}`);
        return;
      }

      const doneDir = path.join(resolved.dir, 'done');
      if (!fs.existsSync(doneDir)) fs.mkdirSync(doneDir, { recursive: true });
      const destPath = path.join(doneDir, path.basename(filePath));
      if (fs.existsSync(destPath)) {
        outputError(`Destination already exists: ${destPath}`);
        process.exit(1);
        return;
      }
      fs.renameSync(filePath, destPath);
      console.log(`Moved to done: ${path.relative(resolved.baseDir, destPath)}`);
    },
  });

  return defineCommand({
    meta: { name: 'todos', description: 'Manage parked todos in .planning/todos/ — list, add, snooze, done' },
    subCommands: {
      list: todosListCmd,
      add: todosAddCmd,
      snooze: todosSnoozeCmd,
      done: todosDoneCmd,
    },
  });
}

module.exports = { createTodosCommand };
module.exports.register = (ctx) => ({ todos: createTodosCommand(ctx.common) });
