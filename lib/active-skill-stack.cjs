'use strict';
/**
 * lib/active-skill-stack.cjs — per-session active-skill stack for the
 * trigger_skill provenance envelope (spec: slm-learning pressure-formula-v2,
 * cross-project handoff h-2026-05-08T11-50-00-monorepo-trigger-skill-envelope).
 *
 * Each Skill tool call or slash-command invocation pushes a SkillFrame onto
 * the stack for the current session. PostToolUse on the Skill tool pops it.
 * The provenance joiner (and trace hook) read the top-of-stack and attach it
 * as `trigger_skill: { id, kind, depth, started_ts }` to every code-edit event
 * in the window.
 *
 * Persistence: stack state is written to
 *   <project-root>/.planning/.trace-active-skill-stack.json
 * as a plain JSON object keyed by session_id. This survives between the
 * ephemeral hook child-processes that Claude Code spawns per tool call.
 *
 * Decisions: GLOBAL-D-300..305 (phase 153), cross-project spec
 *   slm-learning/reports/research/trigger_skill_envelope_spec.md.
 *
 * SkillFrame shape:
 *   {
 *     id: string,                      // skill slug, e.g. "gad-evolution-evolve"
 *     kind: "skill_tool"|"slash_command",
 *     depth: number,                   // 1 = outermost; increments for nested
 *     started_ts: string,              // ISO8601 when push occurred
 *   }
 */

const fs = require('node:fs');
const path = require('node:path');

const STACK_FILE_NAME = '.trace-active-skill-stack.json';

/**
 * Resolve the on-disk path for the session stack file.
 * @param {string} projectRoot
 * @returns {string}
 */
function stackFilePath(projectRoot) {
  return path.join(projectRoot, '.planning', STACK_FILE_NAME);
}

/**
 * Load the full stack store from disk.
 * Returns an object mapping session_id -> SkillFrame[].
 * Missing file or parse errors return empty object (fail-safe).
 * @param {string} projectRoot
 * @returns {Record<string, object[]>}
 */
function loadStackStore(projectRoot) {
  const p = stackFilePath(projectRoot);
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Missing file or corrupt JSON — start fresh
  }
  return {};
}

/**
 * Persist the full stack store to disk (best-effort).
 * @param {string} projectRoot
 * @param {Record<string, object[]>} store
 */
function saveStackStore(projectRoot, store) {
  const p = stackFilePath(projectRoot);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // Best-effort: if we can't write, continue without crashing
  }
}

/**
 * Push a SkillFrame onto the session's stack.
 *
 * @param {string} projectRoot
 * @param {string} sessionId
 * @param {{ id: string, kind: "skill_tool"|"slash_command" }} skill
 * @param {string} [nowIso]  - override timestamp for tests
 * @returns {object} the pushed SkillFrame
 */
function pushSkill(projectRoot, sessionId, skill, nowIso) {
  const store = loadStackStore(projectRoot);
  const stack = store[sessionId] || [];
  const frame = {
    id: skill.id,
    kind: skill.kind,
    depth: stack.length + 1,
    started_ts: nowIso || new Date().toISOString(),
  };
  stack.push(frame);
  store[sessionId] = stack;
  saveStackStore(projectRoot, store);
  return frame;
}

/**
 * Pop the top SkillFrame from the session's stack.
 * Returns the popped frame, or null if stack was empty.
 *
 * @param {string} projectRoot
 * @param {string} sessionId
 * @returns {object|null}
 */
function popSkill(projectRoot, sessionId) {
  const store = loadStackStore(projectRoot);
  const stack = store[sessionId] || [];
  if (stack.length === 0) return null;
  const frame = stack.pop();
  store[sessionId] = stack;
  saveStackStore(projectRoot, store);
  return frame;
}

/**
 * Peek at the top SkillFrame without modifying the stack.
 * Returns null if no skill is active for this session.
 *
 * @param {string} projectRoot
 * @param {string} sessionId
 * @returns {object|null}
 */
function peekSkill(projectRoot, sessionId) {
  const store = loadStackStore(projectRoot);
  const stack = store[sessionId] || [];
  if (stack.length === 0) return null;
  return stack[stack.length - 1];
}

/**
 * Return the full stack for a session (shallow copy).
 * @param {string} projectRoot
 * @param {string} sessionId
 * @returns {object[]}
 */
function getStack(projectRoot, sessionId) {
  const store = loadStackStore(projectRoot);
  return (store[sessionId] || []).slice();
}

/**
 * Clear all stack state for a session (e.g. after session end).
 * @param {string} projectRoot
 * @param {string} sessionId
 */
function clearSession(projectRoot, sessionId) {
  const store = loadStackStore(projectRoot);
  delete store[sessionId];
  saveStackStore(projectRoot, store);
}

/**
 * Detect whether a hook payload represents a Skill-tool invocation.
 * Claude Code emits: { tool_name: "Skill", tool_input: { skill: "..." } }
 * The `skill` key is documented in the Skill tool schema.
 *
 * @param {object} payload - raw hook payload from stdin
 * @returns {{ id: string, kind: "skill_tool" } | null}
 */
function detectSkillToolInvocation(payload) {
  if (!payload || payload.tool_name !== 'Skill') return null;
  const id = (payload.tool_input && (payload.tool_input.skill || payload.tool_input.skill_id)) || null;
  if (!id || typeof id !== 'string') return null;
  return { id, kind: 'skill_tool' };
}

/**
 * Detect whether a UserPromptSubmit / PromptSubmit hook payload represents
 * a slash-command invocation. Claude Code includes the command name in the
 * prompt text wrapped in <command-name>…</command-name> tags.
 *
 * @param {object} payload - raw hook payload from stdin
 * @returns {{ id: string, kind: "slash_command" } | null}
 */
function detectSlashCommandInvocation(payload) {
  if (!payload) return null;
  const text = (payload.prompt || payload.user_message || payload.message || '');
  if (typeof text !== 'string') return null;
  const m = text.match(/<command-name>([\s\S]*?)<\/command-name>/);
  if (!m) return null;
  const id = m[1].trim();
  if (!id) return null;
  return { id, kind: 'slash_command' };
}

module.exports = {
  stackFilePath,
  loadStackStore,
  saveStackStore,
  pushSkill,
  popSkill,
  peekSkill,
  getStack,
  clearSession,
  detectSkillToolInvocation,
  detectSlashCommandInvocation,
  STACK_FILE_NAME,
};
