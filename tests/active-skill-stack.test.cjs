'use strict';
/**
 * Tests for lib/active-skill-stack.cjs
 *
 * Covers: push/pop/peek semantics, per-session isolation, depth increment,
 * file persistence, detect helpers for Skill tool and slash-command.
 *
 * Run: node --test vendor/get-anything-done/tests/active-skill-stack.test.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  pushSkill,
  popSkill,
  peekSkill,
  getStack,
  clearSession,
  loadStackStore,
  detectSkillToolInvocation,
  detectSlashCommandInvocation,
  stackFilePath,
  STACK_FILE_NAME,
} = require('../lib/active-skill-stack.cjs');

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function tmpRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'active-skill-stack-test-'));
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  return dir;
}

// -------------------------------------------------------------------------
// Stack file path
// -------------------------------------------------------------------------

test('stackFilePath returns correct path', () => {
  const root = '/project/root';
  const p = stackFilePath(root);
  assert.ok(p.includes('.planning'));
  assert.ok(p.endsWith(STACK_FILE_NAME));
});

// -------------------------------------------------------------------------
// Push / Peek / Pop
// -------------------------------------------------------------------------

test('pushSkill pushes a frame with depth=1', () => {
  const root = tmpRoot();
  const frame = pushSkill(root, 'sess-1', { id: 'gad-plan-phase', kind: 'skill_tool' }, '2026-05-08T00:00:00.000Z');
  assert.equal(frame.id, 'gad-plan-phase');
  assert.equal(frame.kind, 'skill_tool');
  assert.equal(frame.depth, 1);
  assert.equal(frame.started_ts, '2026-05-08T00:00:00.000Z');
});

test('peekSkill returns top frame without modifying stack', () => {
  const root = tmpRoot();
  pushSkill(root, 'sess-1', { id: 'skill-a', kind: 'skill_tool' }, '2026-05-08T00:01:00.000Z');
  const top = peekSkill(root, 'sess-1');
  assert.equal(top.id, 'skill-a');
  // Stack still has 1 item after peek
  assert.equal(getStack(root, 'sess-1').length, 1);
});

test('peekSkill returns null on empty session', () => {
  const root = tmpRoot();
  assert.equal(peekSkill(root, 'no-such-session'), null);
});

test('popSkill returns the pushed frame and empties stack', () => {
  const root = tmpRoot();
  pushSkill(root, 'sess-1', { id: 'skill-a', kind: 'skill_tool' });
  const popped = popSkill(root, 'sess-1');
  assert.equal(popped.id, 'skill-a');
  assert.equal(peekSkill(root, 'sess-1'), null);
});

test('popSkill returns null on empty stack', () => {
  const root = tmpRoot();
  assert.equal(popSkill(root, 'empty-session'), null);
});

// -------------------------------------------------------------------------
// Nested skills increment depth
// -------------------------------------------------------------------------

test('nested pushes increment depth correctly', () => {
  const root = tmpRoot();
  const f1 = pushSkill(root, 'sess-1', { id: 'outer-skill', kind: 'skill_tool' });
  const f2 = pushSkill(root, 'sess-1', { id: 'inner-skill', kind: 'skill_tool' });
  assert.equal(f1.depth, 1);
  assert.equal(f2.depth, 2);
  // peek returns innermost
  const top = peekSkill(root, 'sess-1');
  assert.equal(top.id, 'inner-skill');
  assert.equal(top.depth, 2);
  // pop reveals outer
  popSkill(root, 'sess-1');
  const next = peekSkill(root, 'sess-1');
  assert.equal(next.id, 'outer-skill');
  assert.equal(next.depth, 1);
});

// -------------------------------------------------------------------------
// Per-session isolation
// -------------------------------------------------------------------------

test('different sessions have independent stacks', () => {
  const root = tmpRoot();
  pushSkill(root, 'sess-A', { id: 'skill-for-A', kind: 'skill_tool' });
  pushSkill(root, 'sess-B', { id: 'skill-for-B', kind: 'slash_command' });

  assert.equal(peekSkill(root, 'sess-A').id, 'skill-for-A');
  assert.equal(peekSkill(root, 'sess-B').id, 'skill-for-B');

  popSkill(root, 'sess-A');
  assert.equal(peekSkill(root, 'sess-A'), null);
  assert.equal(peekSkill(root, 'sess-B').id, 'skill-for-B'); // unaffected
});

// -------------------------------------------------------------------------
// Persistence between calls (stack file survives across process boundaries)
// -------------------------------------------------------------------------

test('stack persists on disk and is reloaded correctly', () => {
  const root = tmpRoot();
  const sessionId = 'persist-sess';

  // Simulate hook process #1: push
  pushSkill(root, sessionId, { id: 'persistent-skill', kind: 'skill_tool' }, '2026-05-08T00:05:00.000Z');

  // Simulate hook process #2: peek from a fresh load (loadStackStore rebuilds from disk)
  const store = loadStackStore(root);
  const stack = store[sessionId];
  assert.ok(Array.isArray(stack), 'stack should be an array');
  assert.equal(stack.length, 1);
  assert.equal(stack[0].id, 'persistent-skill');
  assert.equal(stack[0].started_ts, '2026-05-08T00:05:00.000Z');
});

// -------------------------------------------------------------------------
// clearSession
// -------------------------------------------------------------------------

test('clearSession removes only the specified session', () => {
  const root = tmpRoot();
  pushSkill(root, 'sess-keep', { id: 'keep-skill', kind: 'skill_tool' });
  pushSkill(root, 'sess-clear', { id: 'clear-skill', kind: 'skill_tool' });

  clearSession(root, 'sess-clear');

  assert.equal(peekSkill(root, 'sess-clear'), null);
  assert.equal(peekSkill(root, 'sess-keep').id, 'keep-skill');
});

// -------------------------------------------------------------------------
// detectSkillToolInvocation
// -------------------------------------------------------------------------

test('detectSkillToolInvocation returns null for non-Skill tools', () => {
  assert.equal(detectSkillToolInvocation({ tool_name: 'Read', tool_input: {} }), null);
  assert.equal(detectSkillToolInvocation(null), null);
  assert.equal(detectSkillToolInvocation({}), null);
});

test('detectSkillToolInvocation returns skill descriptor for Skill tool', () => {
  const payload = {
    tool_name: 'Skill',
    tool_input: { skill: 'gad-evolution-evolve' },
  };
  const result = detectSkillToolInvocation(payload);
  assert.deepEqual(result, { id: 'gad-evolution-evolve', kind: 'skill_tool' });
});

test('detectSkillToolInvocation falls back to skill_id field', () => {
  const payload = {
    tool_name: 'Skill',
    tool_input: { skill_id: 'frontend-design' },
  };
  const result = detectSkillToolInvocation(payload);
  assert.deepEqual(result, { id: 'frontend-design', kind: 'skill_tool' });
});

test('detectSkillToolInvocation returns null when skill name is missing', () => {
  const payload = { tool_name: 'Skill', tool_input: {} };
  assert.equal(detectSkillToolInvocation(payload), null);
});

// -------------------------------------------------------------------------
// detectSlashCommandInvocation
// -------------------------------------------------------------------------

test('detectSlashCommandInvocation returns null when no command-name tag', () => {
  assert.equal(detectSlashCommandInvocation({ prompt: 'just a regular message' }), null);
  assert.equal(detectSlashCommandInvocation(null), null);
  assert.equal(detectSlashCommandInvocation({}), null);
});

test('detectSlashCommandInvocation extracts skill from command-name tag', () => {
  const payload = {
    prompt: '<command-name>gad-do</command-name> some arguments here',
  };
  const result = detectSlashCommandInvocation(payload);
  assert.deepEqual(result, { id: 'gad-do', kind: 'slash_command' });
});

test('detectSlashCommandInvocation works with user_message field', () => {
  const payload = {
    user_message: '<command-name>frontend-design</command-name>',
  };
  const result = detectSlashCommandInvocation(payload);
  assert.deepEqual(result, { id: 'frontend-design', kind: 'slash_command' });
});

test('detectSlashCommandInvocation trims whitespace inside tags', () => {
  const payload = { prompt: '<command-name>  gad-audit-milestone  </command-name>' };
  const result = detectSlashCommandInvocation(payload);
  assert.equal(result.id, 'gad-audit-milestone');
});

test('detectSlashCommandInvocation returns null for empty command-name', () => {
  const payload = { prompt: '<command-name></command-name>' };
  assert.equal(detectSlashCommandInvocation(payload), null);
});

// -------------------------------------------------------------------------
// getStack
// -------------------------------------------------------------------------

test('getStack returns shallow copy of stack', () => {
  const root = tmpRoot();
  pushSkill(root, 'sess-1', { id: 'a', kind: 'skill_tool' });
  pushSkill(root, 'sess-1', { id: 'b', kind: 'skill_tool' });
  const stack = getStack(root, 'sess-1');
  assert.equal(stack.length, 2);
  assert.equal(stack[0].id, 'a');
  assert.equal(stack[1].id, 'b');
});

test('getStack returns empty array for unknown session', () => {
  const root = tmpRoot();
  const stack = getStack(root, 'nope');
  assert.deepEqual(stack, []);
});
