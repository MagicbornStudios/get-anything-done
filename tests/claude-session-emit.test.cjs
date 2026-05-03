const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(MONOREPO_ROOT, 'scripts', 'claude-session-emit.cjs');

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function emitHook(sessionRoot, sessionId, payload) {
  execFileSync(process.execPath, [SCRIPT], {
    cwd: MONOREPO_ROOT,
    env: {
      ...process.env,
      GAD_SESSION_ROOT: sessionRoot,
      CLAUDE_SESSION_ID: sessionId,
      GAD_SESSION_TRACE_VERBOSE: '1',
    },
    input: JSON.stringify(payload),
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
}

test('claude-session-emit writes session telemetry from synthetic Claude hooks', () => {
  const sessionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-session-emit-'));
  const sessionId = 's-20260503-cafefeed';
  const handoffId = 'h-2026-05-03T02-07-38-global-89';

  emitHook(sessionRoot, sessionId, {
    hook_event_name: 'SessionStart',
    session_id: 'claude-native-session',
    source: 'startup',
    model: 'claude-sonnet-4-6',
    cwd: MONOREPO_ROOT,
    transcript_path: path.join(sessionRoot, 'transcript.jsonl'),
  });

  emitHook(sessionRoot, sessionId, {
    hook_event_name: 'UserPromptSubmit',
    session_id: 'claude-native-session',
    cwd: MONOREPO_ROOT,
    transcript_path: path.join(sessionRoot, 'transcript.jsonl'),
    prompt: [
      '# gad team worker task',
      '',
      `**Handoff ID:** ${handoffId}`,
      '**Project:** global',
      '',
      'Body:',
      '',
      'Phase 89-02 - Claude Code adapter for session telemetry.',
    ].join('\n'),
  });

  emitHook(sessionRoot, sessionId, {
    hook_event_name: 'PreToolUse',
    session_id: 'claude-native-session',
    cwd: MONOREPO_ROOT,
    transcript_path: path.join(sessionRoot, 'transcript.jsonl'),
    tool_name: 'Read',
    tool_input: { file_path: 'vendor/get-anything-done/references/session-telemetry-schema.md' },
  });

  emitHook(sessionRoot, sessionId, {
    hook_event_name: 'PostToolUse',
    session_id: 'claude-native-session',
    cwd: MONOREPO_ROOT,
    transcript_path: path.join(sessionRoot, 'transcript.jsonl'),
    tool_name: 'Read',
    duration_ms: 12,
    tool_input: { file_path: 'vendor/get-anything-done/references/session-telemetry-schema.md' },
    tool_response: { content: 'ok' },
  });

  emitHook(sessionRoot, sessionId, {
    hook_event_name: 'PreToolUse',
    session_id: 'claude-native-session',
    cwd: MONOREPO_ROOT,
    transcript_path: path.join(sessionRoot, 'transcript.jsonl'),
    tool_name: 'Bash',
    tool_input: { command: `node vendor/get-anything-done/bin/gad.cjs handoffs complete ${handoffId}` },
  });

  emitHook(sessionRoot, sessionId, {
    hook_event_name: 'PostToolUseFailure',
    session_id: 'claude-native-session',
    cwd: MONOREPO_ROOT,
    transcript_path: path.join(sessionRoot, 'transcript.jsonl'),
    tool_name: 'Bash',
    duration_ms: 7,
    tool_input: { command: 'Get-Content .env' },
    error_message: 'Authorization: Bearer sk-test-super-secret\nOPENAI_API_KEY=sk-test-super-secret',
  });

  emitHook(sessionRoot, sessionId, {
    hook_event_name: 'SessionEnd',
    session_id: 'claude-native-session',
    cwd: MONOREPO_ROOT,
    transcript_path: path.join(sessionRoot, 'transcript.jsonl'),
    reason: 'other',
  });

  const events = readJsonl(path.join(sessionRoot, sessionId, 'events.jsonl'));
  assert.equal(events[0].kind, 'session-start');
  assert.equal(events[0].intent, 'Phase 89-02 - Claude Code adapter for session telemetry.');
  assert.equal(events[0].claimed_handoff, handoffId);
  assert.equal(events[1].kind, 'step-start');
  assert.ok(events.some((event) => event.kind === 'tool-call' && event.tool === 'Read' && event.ok === true));
  const failedBash = events.find((event) => event.kind === 'tool-call' && event.tool === 'Bash' && event.ok === false);
  assert.ok(failedBash, 'failed Bash tool-call emitted');
  assert.ok(failedBash.output_excerpt, 'failed Bash includes excerpt');
  assert.ok(!failedBash.output_excerpt.includes('sk-test-super-secret'), 'tool-call excerpt scrubbed');
  assert.ok(events.some((event) => event.kind === 'attribution-link' && event.artifact_id === handoffId));
  const pressure = events.find((event) => event.kind === 'pressure-event');
  assert.ok(pressure, 'pressure event emitted');
  assert.equal(pressure.category, 'tool-error');
  assert.ok(!JSON.stringify(pressure).includes('sk-test-super-secret'), 'secret value scrubbed from telemetry');
  assert.equal(events.at(-1).kind, 'session-end');
});

test('claude-session-emit generates schema-valid ids when Claude does not provide one', () => {
  const sessionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-session-emit-map-'));
  emitHook(sessionRoot, '', {
    hook_event_name: 'UserPromptSubmit',
    cwd: MONOREPO_ROOT,
    transcript_path: path.join(sessionRoot, 'transcript.jsonl'),
    prompt: 'Simple prompt',
  });

  const sessionDirs = fs.readdirSync(sessionRoot).filter((entry) => !entry.startsWith('.'));
  assert.equal(sessionDirs.length, 1);
  assert.match(sessionDirs[0], /^s-\d{8}-[a-f0-9]{8}$/);
});
