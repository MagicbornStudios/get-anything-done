const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(MONOREPO_ROOT, 'scripts', 'codex-session-emit.cjs');

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('codex-session-emit writes session telemetry from synthetic codex stderr', () => {
  const sessionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-session-emit-'));
  const sessionId = 's-20260503-facefeed';
  const handoffId = 'h-2026-05-03T02-02-58-global-89';
  const childProgram = [
    'const err = process.stderr;',
    "err.write('Reading prompt from stdin...\\n');",
    "err.write('0.121.0 (research preview)\\n');",
    "err.write('exec\\n');",
    `err.write('\\\"C:\\\\\\\\Windows\\\\\\\\System32\\\\\\\\WindowsPowerShell\\\\\\\\v1.0\\\\\\\\powershell.exe\\\" -NoProfile -Command \\'Get-Content vendor/get-anything-done/references/session-telemetry-schema.md\\' in C:\\\\Users\\\\benja\\\\Documents\\\\custom_portfolio\\n');`,
    "err.write('exec\\n');",
    `err.write('\\\"C:\\\\\\\\Windows\\\\\\\\System32\\\\\\\\WindowsPowerShell\\\\\\\\v1.0\\\\\\\\powershell.exe\\\" -NoProfile -Command \\'node vendor/get-anything-done/bin/gad.cjs handoffs complete ${handoffId}\\' in C:\\\\Users\\\\benja\\\\Documents\\\\custom_portfolio\\n');`,
    "err.write('patch: completed\\n');",
    "err.write('scripts/codex-session-emit.cjs\\n');",
    "err.write('2026-05-03T02:30:04.000Z ERROR codex_core::tools::router: error=Exit code: 1\\n');",
    "err.write('Wall time: 1 seconds\\n');",
    "err.write('Output:\\n');",
    "err.write('Authorization: Bearer sk-test-super-secret\\n\\n');",
    "process.stdout.write('synthetic stdout ok\\n');",
  ].join('\n');

  const prompt = [
    '# gad team worker task',
    '',
    '**Handoff ID:** h-2026-05-03T02-02-58-global-89',
    '**Project:** global',
    '',
    'Body:',
    '',
    'Phase 89-03 - codex-cli adapter for session telemetry.',
  ].join('\n');

  execFileSync(process.execPath, [
    SCRIPT,
    '--agent',
    'team-w5',
    '--session-id',
    sessionId,
    '--session-root',
    sessionRoot,
    '--',
    process.execPath,
    '-e',
    childProgram,
  ], {
    cwd: MONOREPO_ROOT,
    input: prompt,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  const events = readJsonl(path.join(sessionRoot, sessionId, 'events.jsonl'));
  assert.equal(events[0].kind, 'session-start');
  assert.equal(events[0].claimed_handoff, handoffId);
  assert.equal(events[1].kind, 'step-start');
  assert.ok(events.some((event) => event.kind === 'tool-call' && event.tool === 'Read' && event.ok === true));
  assert.ok(events.some((event) => event.kind === 'tool-call' && event.tool === 'Bash' && event.ok === true));
  assert.ok(events.some((event) => event.kind === 'tool-call' && event.tool === 'Edit' && event.target === 'scripts/codex-session-emit.cjs'));
  assert.ok(events.some((event) => event.kind === 'attribution-link' && event.artifact_id === handoffId));
  const pressure = events.find((event) => event.kind === 'pressure-event');
  assert.ok(pressure, 'pressure event emitted');
  assert.equal(pressure.category, 'tool-error');
  assert.ok(!JSON.stringify(pressure).includes('sk-test-super-secret'), 'secret value scrubbed from telemetry');
  assert.equal(events.at(-1).kind, 'session-end');
});
