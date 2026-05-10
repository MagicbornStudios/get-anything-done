'use strict';
/**
 * gad ask — dual purpose:
 *   1. LLM Q&A entry point (MVP, 2026-05-10) — `gad ask "what is GLOBAL-D-330"`
 *      routes to whichever LLM backend is reachable (modal | gateway | direct).
 *      Streams the answer to stdout. See `gad ask llm --help`.
 *   2. Human-in-the-loop intake via browser-popup forms (Phase 158).
 *
 * LLM subcommand (default when first positional looks like a sentence):
 *   `gad ask llm "what is GLOBAL-D-330"`
 *
 * Intake subcommands:
 *   env <key>      — capture a BYOK key value, store via gad env set
 *   byok <key>     — alias for env (semantically clearer for "API key" cases)
 *   todo <body>    — operator answers a question; result goes into todos
 *   decision <q>   — approve/reject with optional note
 *   text <q>       — generic free-text question, prints answer to stdout
 *
 * Intake modes:
 *   default       — pops browser form, blocks until submit
 *   --no-ui       — fall back to TTY prompt (echoless for env/byok)
 *   --value <v>   — non-interactive shortcut (skips UI; useful for scripts/CI)
 *   --mcp         — JSON output (for the gad_ask_operator MCP tool)
 *
 * Headless-first design: agents call this knowing it works whether the
 * operator is sitting at the keyboard, on another machine, or asleep
 * (with --value piped in by a script).
 */

const path = require('node:path');
const { defineCommand } = require('citty');
const { ask } = require('../../lib/intake/server.cjs');
const { createAskLlmCommand, runAskLlm } = require('./_ask-llm.cjs');

function commonArgs(extra = {}) {
  return {
    title: { type: 'string', description: 'Title shown to operator', default: '' },
    details: { type: 'string', description: 'Optional longer context', default: '' },
    'no-ui': { type: 'boolean', description: 'Skip browser; use TTY prompt instead', default: false },
    value: { type: 'string', description: 'Non-interactive shortcut (skip UI entirely)', default: '' },
    timeout: { type: 'string', description: 'Timeout in seconds', default: '600' },
    mcp: { type: 'boolean', description: 'Emit JSON for MCP consumer (gad_ask_operator)', default: false },
    ...extra,
  };
}

function emitResult(result, args) {
  if (args.mcp) {
    console.log(JSON.stringify(result));
  } else if (result && result.value !== undefined) {
    console.log(result.value);
  }
}

function createAskCommand(deps) {
  const envCmd = defineCommand({
    meta: { name: 'env', description: 'Capture a BYOK env key value, store via gad env set' },
    args: {
      key: { type: 'positional', description: 'env key name (e.g. STRIPE_KEY)', required: true },
      projectid: { type: 'string', description: 'Project to scope to', required: true },
      ...commonArgs(),
    },
    async run({ args }) {
      const title = args.title || `Set ${args.key} for ${args.projectid}`;
      let value = args.value || '';
      if (!value && args['no-ui']) {
        // TTY fallback — read from stdin (echoless prompt is gad env's job)
        const { execSync } = require('node:child_process');
        execSync(`node "${path.resolve(__dirname, '..', 'gad.cjs')}" env set ${args.key} --projectid ${args.projectid}`, { stdio: 'inherit' });
        emitResult({ value: '<set via TTY>', kind: 'env', key: args.key, projectid: args.projectid }, args);
        return;
      }
      if (!value) {
        const result = await ask({
          kind: 'env',
          title,
          details: args.details,
          key: args.key,
          projectid: args.projectid,
          timeoutMs: (parseInt(args.timeout, 10) || 600) * 1000,
          log: (m) => process.stderr.write(m + '\n'),
        });
        value = result.value;
      }
      // Pipe captured value into gad env set
      const { spawnSync } = require('node:child_process');
      const r = spawnSync('node', [path.resolve(__dirname, '..', 'gad.cjs'), 'env', 'set', args.key, '--projectid', args.projectid], {
        input: value,
        stdio: ['pipe', 'inherit', 'inherit'],
      });
      if (r.status !== 0) { deps.outputError('gad env set failed'); process.exit(r.status || 1); return; }
      emitResult({ value: '<captured>', kind: 'env', key: args.key, projectid: args.projectid }, args);
    },
  });

  const byokCmd = defineCommand({
    meta: { name: 'byok', description: 'Alias for `gad ask env` — semantically clearer for "I need a third-party API key from you"' },
    args: envCmd.args,
    run: envCmd.run,
  });

  const todoCmd = defineCommand({
    meta: { name: 'todo', description: 'Ask operator to answer or weigh in; result captured as todo body' },
    args: {
      slug: { type: 'positional', description: 'Short slug for the todo', required: true },
      projectid: { type: 'string', description: 'Project scope', default: '' },
      ...commonArgs(),
    },
    async run({ args }) {
      const title = args.title || `Operator todo: ${args.slug}`;
      let answer = args.value || '';
      if (!answer) {
        const result = await ask({
          kind: 'todo',
          title,
          details: args.details,
          timeoutMs: (parseInt(args.timeout, 10) || 600) * 1000,
          log: (m) => process.stderr.write(m + '\n'),
        });
        answer = result.value;
      }
      const { spawnSync } = require('node:child_process');
      const cliArgs = ['todos', 'add', '--body', `${args.slug}: ${answer}`];
      if (args.projectid) cliArgs.push('--projectid', args.projectid);
      const r = spawnSync('node', [path.resolve(__dirname, '..', 'gad.cjs'), ...cliArgs], { stdio: 'inherit' });
      if (r.status !== 0) { deps.outputError('gad todos add failed'); process.exit(r.status || 1); return; }
      emitResult({ value: answer, kind: 'todo', slug: args.slug }, args);
    },
  });

  const decisionCmd = defineCommand({
    meta: { name: 'decision', description: 'Approve/reject prompt with optional note' },
    args: {
      prompt: { type: 'positional', description: 'The decision to approve/reject', required: true },
      ...commonArgs(),
    },
    async run({ args }) {
      const result = await ask({
        kind: 'decision',
        title: args.title || args.prompt,
        details: args.details,
        timeoutMs: (parseInt(args.timeout, 10) || 600) * 1000,
        log: (m) => process.stderr.write(m + '\n'),
      });
      emitResult(result, args);
      process.exit(result.value === 'approve' ? 0 : 2);  // exit 2 on reject for callers
    },
  });

  const textCmd = defineCommand({
    meta: { name: 'text', description: 'Generic free-text question' },
    args: {
      prompt: { type: 'positional', description: 'Question shown to operator', required: true },
      ...commonArgs(),
    },
    async run({ args }) {
      const result = await ask({
        kind: 'text',
        title: args.title || args.prompt,
        details: args.details,
        timeoutMs: (parseInt(args.timeout, 10) || 600) * 1000,
        log: (m) => process.stderr.write(m + '\n'),
      });
      emitResult(result, args);
    },
  });

  const llmCmd = createAskLlmCommand(deps);

  return defineCommand({
    meta: {
      name: 'ask',
      description: 'Ask an LLM a question via `gad ask llm "..."` (auto-routes modal → gateway → direct) OR pop a human-in-the-loop intake form (env / byok / todo / decision / text).',
    },
    subCommands: {
      llm: llmCmd,
      env: envCmd,
      byok: byokCmd,
      todo: todoCmd,
      decision: decisionCmd,
      text: textCmd,
    },
  });
}

module.exports = { createAskCommand };
module.exports.register = (ctx) => ({ ask: createAskCommand(ctx.common) });
