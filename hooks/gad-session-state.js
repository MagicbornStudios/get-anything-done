#!/usr/bin/env node
// gad-hook-version: 1.33.0
// SessionStart hook — soul banner + unclaimed handoff pointer.
// Node port of gad-session-state.sh (ported 2026-04-20 to avoid
// Windows bash.exe invocation failures where Claude Code wrapped the
// quoted bash path such that bash tried to interpret bash.exe as its
// script argument). Exits 0 on any error so session always starts.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

try {
  const cwd = process.env.PWD || process.cwd();

  const soulFile = path.join(cwd, 'SOUL.md');
  if (fs.existsSync(soulFile)) {
    const firstLine = (fs.readFileSync(soulFile, 'utf8').split(/\r?\n/)[0] || '').trim();
    const soul = firstLine.replace(/^# Active Soul — /, '').replace(/^# /, '');
    if (soul) {
      process.stdout.write(`Active soul: ${soul} (SOUL.md)\n`);
    }
  }

  const gadCmd = process.platform === 'win32' ? 'gad.exe' : 'gad';
  const probe = spawnSync(gadCmd, ['handoffs', 'list', '--json'], {
    encoding: 'utf8',
    shell: false,
    timeout: 4000,
  });
  if (probe.status === 0 && probe.stdout) {
    try {
      const arr = JSON.parse(probe.stdout);
      if (Array.isArray(arr) && arr.length > 0) {
        process.stdout.write(
          `Unclaimed handoffs: ${arr.length} — run \`gad handoffs list\` to pick one up.\n`
        );
      }
    } catch {}
  }
} catch {}

process.exit(0);
