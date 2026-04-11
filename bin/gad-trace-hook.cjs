#!/usr/bin/env node
/**
 * GAD trace hook — Claude Code PreToolUse / PostToolUse handler.
 *
 * Invoked by Claude Code's hook runtime on every tool use. Reads the hook
 * payload from stdin, builds an event per the trace schema, and appends it
 * synchronously to <project-root>/.planning/.trace-events.jsonl.
 *
 * The hook is wired into the user's ~/.claude/settings.json by `gad install
 * hooks` — this script is referenced by absolute path so framework updates
 * via `gad update` propagate automatically (decision gad-59).
 *
 * Stdin contract (Claude Code hook format):
 *   {
 *     "hook_event_name": "PreToolUse" | "PostToolUse",
 *     "tool_name": "Read" | "Write" | "Edit" | "Bash" | "Task" | ...,
 *     "tool_input": { ... tool arguments ... },
 *     "tool_response": { ... tool result on PostToolUse ... },
 *     "session_id": "...",
 *     "cwd": "...",
 *     ...
 *   }
 *
 * Exit codes:
 *   0 = event written (or skipped silently for no-op cases)
 *   non-zero only on catastrophic errors where we can't even write to stderr
 *
 * The hook never modifies tool behaviour — it's write-only. If anything goes
 * wrong, it logs to stderr and exits 0 so the user's tool call still
 * succeeds. Never block the main agent.
 *
 * Referenced by phase 25 plan (25-02) and decisions gad-50, gad-53, gad-58,
 * gad-59, gad-60.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const {
  makeToolUseEvent,
  makeSkillInvocationEvent,
  makeSubagentSpawnEvent,
  makeFileMutationEvent,
} = require('../lib/trace-schema.cjs');
const { truncateOutput, truncateInputsObject } = require('../lib/trace-truncate.cjs');

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function findProjectRoot(startDir) {
  // Walk up from startDir looking for .planning/ — that's the project root
  // for GAD purposes. Fall back to cwd if none found.
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    dir = path.dirname(dir);
  }
  return startDir;
}

function getTraceFile(projectRoot) {
  // Per-run trace: if GAD_EVAL_TRACE_DIR is set, write events there instead
  // of the default .planning/ location. This env var is set by `gad eval run
  // --execute` so each eval run gets its own trace JSONL, not the global one.
  const evalTraceDir = process.env.GAD_EVAL_TRACE_DIR;
  if (evalTraceDir) {
    if (!fs.existsSync(evalTraceDir)) {
      fs.mkdirSync(evalTraceDir, { recursive: true });
    }
    return path.join(evalTraceDir, '.trace-events.jsonl');
  }

  const planningDir = path.join(projectRoot, '.planning');
  if (!fs.existsSync(planningDir)) {
    fs.mkdirSync(planningDir, { recursive: true });
  }
  return path.join(planningDir, '.trace-events.jsonl');
}

function getMarkerFile(projectRoot) {
  return path.join(projectRoot, '.planning', '.trace-active-skill');
}

function getSeqFile(projectRoot) {
  return path.join(projectRoot, '.planning', '.trace-seq');
}

function readNextSeq(projectRoot) {
  const seqFile = getSeqFile(projectRoot);
  let current = 0;
  try {
    current = parseInt(fs.readFileSync(seqFile, 'utf8'), 10) || 0;
  } catch {
    current = 0;
  }
  const next = current + 1;
  try {
    fs.writeFileSync(seqFile, String(next));
  } catch (err) {
    logHookError('gad-trace-hook:write-seq', err);
  }
  return next;
}

function readActiveSkill(projectRoot) {
  try {
    const content = fs.readFileSync(getMarkerFile(projectRoot), 'utf8').trim();
    return content || null;
  } catch {
    return null;
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    // In case stdin is already at EOF (shouldn't happen from Claude Code, but
    // belt-and-suspenders for manual testing):
    if (process.stdin.isTTY) resolve('');
  });
}

/** Max events before log rotation truncates the oldest */
const MAX_TRACE_EVENTS = 1000;

function appendEvent(projectRoot, event) {
  const traceFile = getTraceFile(projectRoot);
  fs.appendFileSync(traceFile, JSON.stringify(event) + '\n');

  // Log rotation: truncate oldest events when over limit
  try {
    const content = fs.readFileSync(traceFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length > MAX_TRACE_EVENTS) {
      const trimmed = lines.slice(lines.length - MAX_TRACE_EVENTS);
      fs.writeFileSync(traceFile, trimmed.join('\n') + '\n');
    }
  } catch {
    // Best-effort rotation — don't fail the hook
  }
}

/**
 * Write a descriptive error to ~/.claude/hooks.log with timestamp.
 * Falls back to stderr if the log file can't be written.
 */
function logHookError(hookName, error) {
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] ${hookName}: ${error.message || error}\n`;
  process.stderr.write(msg);

  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (!homeDir) return;
    const claudeDir = path.join(homeDir, '.claude');
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }
    const logFile = path.join(claudeDir, 'hooks.log');
    fs.appendFileSync(logFile, msg);

    // Keep hooks.log from growing unbounded — cap at 100KB
    try {
      const stat = fs.statSync(logFile);
      if (stat.size > 100 * 1024) {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n');
        const trimmed = lines.slice(Math.floor(lines.length / 2));
        fs.writeFileSync(logFile, trimmed.join('\n'));
      }
    } catch { /* best effort */ }
  } catch {
    // Can't write to log file — stderr is already written, move on
  }
}

// -------------------------------------------------------------------------
// Event builders — figure out which event type applies to a given tool call
// -------------------------------------------------------------------------

const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);

function eventsForPostToolUse({ seq, toolName, toolInput, toolResponse, triggerSkill }) {
  const events = [];

  // Every PostToolUse produces a tool_use event.
  const inputs = truncateInputsObject(toolInput || {});
  let outputsStr = '';
  if (typeof toolResponse === 'string') {
    outputsStr = toolResponse;
  } else if (toolResponse && typeof toolResponse === 'object') {
    // Claude Code gives us an object — stringify the most interesting field.
    // Fall back to the full JSON dump.
    outputsStr = toolResponse.content
      || toolResponse.stdout
      || toolResponse.output
      || JSON.stringify(toolResponse);
  }
  const truncated = truncateOutput(outputsStr);
  events.push(
    makeToolUseEvent({
      seq,
      tool: toolName || 'unknown',
      inputs,
      outputs: truncated.value,
      outputsTruncated: truncated.truncated,
      durationMs: null,
      success: true,
      triggerSkill,
    })
  );

  // If the tool was Task, also emit a subagent_spawn event.
  if (toolName === 'Task') {
    const agentId =
      (toolInput && (toolInput.subagent_type || toolInput.agent || toolInput.type)) ||
      'unknown';
    const taskInputs = truncateInputsObject({
      description: toolInput?.description,
      prompt: toolInput?.prompt,
    });
    events.push(
      makeSubagentSpawnEvent({
        seq: seq + 0.1, // slight offset so ordering is preserved
        agentId,
        inputs: taskInputs,
        outputs: truncated.value,
        durationMs: null,
        success: true,
      })
    );
  }

  // If the tool was a write-class tool, also emit a file_mutation event.
  if (WRITE_TOOLS.has(toolName)) {
    const filePath = toolInput?.file_path || toolInput?.path || 'unknown';
    let op = 'edit';
    if (toolName === 'Write') op = 'create';
    // Size delta: rough guess from the new content length minus old (if Edit).
    let sizeDelta = null;
    if (toolName === 'Write' && typeof toolInput?.content === 'string') {
      sizeDelta = Buffer.byteLength(toolInput.content, 'utf8');
    } else if (toolName === 'Edit' && typeof toolInput?.new_string === 'string') {
      sizeDelta =
        Buffer.byteLength(toolInput.new_string, 'utf8') -
        Buffer.byteLength(toolInput?.old_string || '', 'utf8');
    }
    events.push(
      makeFileMutationEvent({
        seq: seq + 0.2,
        filePath,
        op,
        sizeDelta,
      })
    );
  }

  return events;
}

/**
 * Detect a skill transition by comparing the current active-skill marker
 * file to the previously-recorded active skill. Returns a skill_invocation
 * event when the active skill has changed since the last hook fire, or
 * null when no transition occurred.
 *
 * The "previously-recorded" state is stored in .planning/.trace-last-skill
 * alongside the marker file itself. On first call it's empty.
 */
function maybeSkillInvocationEvent(projectRoot, seq) {
  const currentSkill = readActiveSkill(projectRoot);
  const lastSkillFile = path.join(projectRoot, '.planning', '.trace-last-skill');
  let previousSkill = null;
  try {
    previousSkill = fs.readFileSync(lastSkillFile, 'utf8').trim() || null;
  } catch {
    previousSkill = null;
  }

  if (currentSkill === previousSkill) {
    return null;
  }

  // Transition detected — update the last-skill file and emit an event.
  try {
    fs.writeFileSync(lastSkillFile, currentSkill || '');
  } catch (err) {
    logHookError('gad-trace-hook:write-last-skill', err);
  }

  // Only emit an event if there's actually a new active skill. Transitioning
  // from a skill to "no active" is still a signal worth logging (end of skill).
  if (currentSkill) {
    return makeSkillInvocationEvent({
      seq,
      skillId: currentSkill,
      parent: previousSkill,
      triggerContext: 'marker_file',
      triggerSnippet: null,
    });
  }
  // Transitioning to no-skill: log as parent with empty skill_id so the
  // downstream aggregator can see the end-of-skill signal.
  return makeSkillInvocationEvent({
    seq,
    skillId: '',
    parent: previousSkill,
    triggerContext: 'marker_file',
    triggerSnippet: null,
  });
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

async function main() {
  let payload;
  try {
    const raw = await readStdin();
    if (!raw.trim()) {
      // No input — nothing to log. Still exit 0.
      return;
    }
    payload = JSON.parse(raw);
  } catch (err) {
    logHookError('gad-trace-hook:parse-stdin', err);
    return;
  }

  const cwd = payload.cwd || process.cwd();
  const projectRoot = findProjectRoot(cwd);
  const hookEvent = payload.hook_event_name || '';
  const toolName = payload.tool_name || '';
  const toolInput = payload.tool_input || {};
  const toolResponse = payload.tool_response || null;

  try {
    // Always check for skill transitions first so a skill_invocation event
    // (if any) is written before the tool_use event that triggered the hook.
    const skillSeq = readNextSeq(projectRoot);
    const skillEvent = maybeSkillInvocationEvent(projectRoot, skillSeq);
    const activeSkill = readActiveSkill(projectRoot);

    if (skillEvent) {
      appendEvent(projectRoot, skillEvent);
    }

    // Only PostToolUse produces tool_use / subagent_spawn / file_mutation
    // events. PreToolUse is used only to detect the skill transition.
    if (hookEvent === 'PostToolUse') {
      const toolSeq = readNextSeq(projectRoot);
      const events = eventsForPostToolUse({
        seq: toolSeq,
        toolName,
        toolInput,
        toolResponse,
        triggerSkill: activeSkill,
      });
      for (const ev of events) {
        appendEvent(projectRoot, ev);
      }
    }
  } catch (err) {
    // Never let the hook crash the main agent. Log and exit 0.
    logHookError('gad-trace-hook:handler', err);
  }
}

main().catch((err) => {
  logHookError('gad-trace-hook:unhandled', err);
  // Still exit 0 so the main tool call succeeds.
});
