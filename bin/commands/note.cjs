'use strict';
/**
 * gad note — list / add subcommands.
 *
 * Extracted from bin/gad.cjs in sweep E (2026-04-19, opus-claude).
 * See bin/commands/state.cjs for the factory pattern rationale.
 *
 * Required deps:
 *   findRepoRoot, gadConfig, resolveRoots, outputError,
 *   writeNote, listNotes
 */

const path = require('path');
const { defineCommand } = require('citty');

function createNoteCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError, writeNote, listNotes, listNoteQuestions } = deps;

  const noteAddCmd = defineCommand({
    meta: { name: 'add', description: 'Create a new note in .planning/notes/. Filename includes agent slug from --agent or $GAD_AGENT_NAME.' },
    args: {
      slug: { type: 'positional', description: 'Short slug (e.g. context-surgery-findings)', required: true },
      title: { type: 'string', description: 'Optional H1 title', default: '' },
      body: { type: 'string', description: 'Note body (markdown). If absent, just creates the shell.', default: '' },
      source: { type: 'string', description: 'Provenance line', default: '' },
      agent: { type: 'string', description: 'Agent slug (defaults to $GAD_AGENT_NAME)', default: '' },
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
        outputError('note add requires a single project. Pass --projectid <id>.');
        return;
      }
      const root = roots[0];
      try {
        const result = writeNote(root, baseDir, {
          slug: String(args.slug),
          title: String(args.title || ''),
          body: String(args.body || ''),
          source: String(args.source || ''),
          agent: String(args.agent || ''),
          date: String(args.date || ''),
        });
        console.log(`Added note: ${result.filename}`);
        console.log(`File:    ${path.relative(baseDir, result.filePath)}`);
      } catch (e) {
        outputError(e.message);
        process.exit(1);
      }
    },
  });

  const noteListCmd = defineCommand({
    meta: { name: 'list', description: 'List notes in .planning/notes/' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or run from a project root.');
        return;
      }
      const all = [];
      for (const root of roots) {
        for (const n of listNotes(root, baseDir)) {
          all.push({ project: root.id, ...n });
        }
      }
      all.sort((a, b) => a.filename.localeCompare(b.filename));
      if (args.json) {
        console.log(JSON.stringify(all, null, 2));
        return;
      }
      if (all.length === 0) {
        console.log('No notes found.');
        return;
      }
      for (const n of all) {
        console.log(`  ${n.project}/${n.filename}`);
      }
    },
  });

  const noteQuestionsCmd = defineCommand({
    meta: {
      name: 'questions',
      description: 'Surface "## Open questions" sections from recent notes — CLI path to operator action items buried in planning docs.',
    },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      since: { type: 'string', description: 'Only include notes dated >= YYYY-MM-DD', default: '' },
      slug: { type: 'string', description: 'Substring filter on note filename', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      if (!listNoteQuestions) {
        outputError('listNoteQuestions helper not wired; upgrade lib/notes-writer.cjs.');
        return;
      }
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or run from a project root.');
        return;
      }
      const all = [];
      for (const root of roots) {
        const hits = listNoteQuestions(root, baseDir, {
          sinceDate: args.since || undefined,
          slugFilter: args.slug || undefined,
        });
        for (const h of hits) {
          all.push({ project: root.id, filename: h.filename, questions: h.questions });
        }
      }
      all.sort((a, b) => a.filename.localeCompare(b.filename));
      if (args.json) {
        console.log(JSON.stringify(all, null, 2));
        return;
      }
      if (all.length === 0) {
        console.log('No notes with `## Open questions` sections found.');
        return;
      }
      for (const h of all) {
        console.log(`─── ${h.project}/${h.filename} ───`);
        console.log(h.questions);
        console.log('');
      }
      console.log(`${all.length} note(s) with open questions.`);
    },
  });

  return defineCommand({
    meta: { name: 'note', description: 'Manage ad-hoc notes in .planning/notes/ — list, add, questions' },
    subCommands: {
      list: noteListCmd,
      add: noteAddCmd,
      questions: noteQuestionsCmd,
    },
    // NOTE: no fallback `run` here — citty was running both the matched
    // subcommand AND this callback, producing duplicate output. Let citty
    // print help when no subcommand matches.
  });
}

module.exports = { createNoteCommand };
module.exports.register = (ctx) => {
  const cmd = createNoteCommand(ctx.common);
  return { note: cmd, notes: cmd };
};
