#!/usr/bin/env node
'use strict';

// GAD codex notify hook — phase 188-02.
//
// Codex CLI invokes this script via `notify = ["node", "<this-path>"]` in
// ~/.codex/config.toml. Codex passes event metadata as a JSON arg or via
// stdin (varies by codex version) — we accept both and log a single line
// to .planning/.gad-log/<YYYY-MM-DD>.jsonl so every codex invocation
// shows up in the gad observability surface, even one-shot `codex exec`
// runs that leave no rollout file.
//
// This closes the gap exposed 2026-05-12: codex binary atime showed
// activity today but nothing wrote to gad-log because the original
// notify-hook pointed at a deleted oh-my-codex script.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function repoRootGuess() {
  // Walk up from cwd until we find pnpm-workspace.yaml or .planning/
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(dir, '.planning'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback to known monorepo location
  return path.join(os.homedir(), 'Documents', 'custom_portfolio');
}

function logDir(root) {
  return path.join(root, '.planning', '.gad-log');
}

function todayFile(root) {
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return path.join(logDir(root), `${stamp}.jsonl`);
}

async function readStdinIfAny(timeoutMs = 500) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    const timer = setTimeout(() => resolve(data), timeoutMs);
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function main() {
  const stdinRaw = await readStdinIfAny();
  const argRaw = process.argv.slice(2).join(' ');

  let payload = null;
  for (const candidate of [stdinRaw, argRaw]) {
    if (!candidate) continue;
    try {
      payload = JSON.parse(candidate);
      break;
    } catch {}
  }

  const root = repoRootGuess();
  fs.mkdirSync(logDir(root), { recursive: true });

  const entry = {
    ts: new Date().toISOString(),
    type: 'runtime_invocation',
    runtime: 'codex-cli',
    source: 'codex-notify-hook',
    event: payload && payload.type ? payload.type : 'notify',
    payload_summary: payload
      ? JSON.stringify(payload).slice(0, 400)
      : (stdinRaw || argRaw || '').slice(0, 400),
    pid: process.pid,
    parent_pid: process.ppid,
    cwd: process.cwd(),
  };

  fs.appendFileSync(todayFile(root), JSON.stringify(entry) + '\n');

  // Best-effort ai-spend ledger row too
  if (payload && (payload.usage || payload.tokens)) {
    const ledgerDir = path.join(root, '.planning', 'datasets', 'ai-spend-ledger');
    fs.mkdirSync(ledgerDir, { recursive: true });
    const ledgerFile = path.join(
      ledgerDir,
      `${new Date().toISOString().slice(0, 10)}.jsonl`,
    );
    fs.appendFileSync(
      ledgerFile,
      JSON.stringify({
        ts: entry.ts,
        runtime: 'codex-cli',
        model: payload.model || payload.usage?.model || null,
        prompt_tokens:
          payload.usage?.prompt_tokens ?? payload.tokens?.prompt ?? null,
        completion_tokens:
          payload.usage?.completion_tokens ?? payload.tokens?.completion ?? null,
        source: 'codex-notify-hook',
      }) + '\n',
    );
  }

  // Exit 0 silently — never block codex execution.
  process.exit(0);
}

main().catch(() => {
  // Never fail loud — codex must not be blocked by our hook.
  process.exit(0);
});
