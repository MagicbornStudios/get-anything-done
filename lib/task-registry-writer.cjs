'use strict';
/**
 * task-registry-writer.cjs — append new <task> entries into TASK-REGISTRY.xml.
 *
 * Counterpart to lib/task-registry-reader.cjs. Covers the CLI efficiency
 * gap filed in custom_portfolio/.planning/todos/2026-04-18-gad-tasks-add-cli-gap.md:
 * prior to this module every new task had to be hand-edited into the XML,
 * which violates the "use gad CLI for conversions" rule.
 *
 * Design:
 *   - Pure string-level edit on the XML document. No DOM parser, no deps.
 *   - Preserves surrounding indentation by inserting the new <task> block
 *     at the position where the matching <phase>'s closing-tag indentation
 *     begins. Existing siblings are untouched.
 *   - Validates: id uniqueness across the whole document (not just the
 *     phase), phase existence, and required-field presence.
 *   - Atomic file write via tmp + rename (same discipline as
 *     secrets-lifecycle.cjs writeEnvelopeDirect — if the rename fails on
 *     Windows, unlink target + retry).
 *   - Fully dep-injected for tests (fsImpl).
 *
 * Exports:
 *   - TaskWriterError (named error class with stable codes)
 *   - buildTaskElement(def)            — pure XML serializer
 *   - addTaskToXml(xml, def)           — returns mutated XML string
 *   - appendTaskToFile({filePath, def, fsImpl}) — writes to disk atomically
 *   - escapeXml(text)                  — exported for tests + promote
 *
 * Stable error codes (caller maps to exit codes / operator hints):
 *   - TASK_ID_EXISTS     — the id already appears somewhere in the doc
 *   - PHASE_NOT_FOUND    — no <phase id="X"> matches
 *   - VALIDATION_FAILED  — required field missing or malformed
 *   - MALFORMED_XML      — matched <phase> has no </phase> closer
 *   - WRITE_FAILED       — fs rename/write failure (cause preserved)
 */

const fs = require('fs');
const path = require('path');

const ERROR_CODES = Object.freeze([
  'TASK_ID_EXISTS',
  'PHASE_NOT_FOUND',
  'VALIDATION_FAILED',
  'MALFORMED_XML',
  'WRITE_FAILED',
]);

class TaskWriterError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'TaskWriterError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * XML entity escape for goal text + attribute values. Keeps < > & " '
 * safe in XML bodies + attribute positions. Intentionally conservative —
 * over-escaping is safe, under-escaping corrupts the doc.
 */
function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate + normalize a task definition. Throws VALIDATION_FAILED on
 * any missing required field. Returns a normalized object with defaults
 * applied (status → 'planned', type → '', depends → '').
 */
function validateTaskDef(def) {
  if (!def || typeof def !== 'object') {
    throw new TaskWriterError('VALIDATION_FAILED', 'task def must be an object');
  }
  const id = typeof def.id === 'string' ? def.id.trim() : '';
  const phase = typeof def.phase === 'string' ? def.phase.trim() : '';
  const goal = typeof def.goal === 'string' ? def.goal.trim() : '';
  if (!id) throw new TaskWriterError('VALIDATION_FAILED', 'task id is required');
  if (!phase) throw new TaskWriterError('VALIDATION_FAILED', 'phase is required');
  if (!goal) throw new TaskWriterError('VALIDATION_FAILED', 'goal is required');
  // id shape guard — reject characters that would corrupt the attribute.
  if (!/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new TaskWriterError('VALIDATION_FAILED', `task id "${id}" contains disallowed characters (allowed: A-Z a-z 0-9 . _ -)`);
  }
  if (!/^[A-Za-z0-9.-]+$/.test(phase)) {
    throw new TaskWriterError('VALIDATION_FAILED', `phase "${phase}" contains disallowed characters`);
  }
  const status = typeof def.status === 'string' && def.status.trim() ? def.status.trim() : 'planned';
  const type = typeof def.type === 'string' ? def.type.trim() : '';
  const depends = typeof def.depends === 'string' ? def.depends.trim() : '';
  return { id, phase, goal, status, type, depends };
}

/**
 * Serialize a task def to a properly-indented XML fragment. Output ends
 * with a newline so the next sibling starts on its own line.
 *
 * Indentation convention (4-space task, 6-space child elements) matches
 * the existing hand-written task entries in TASK-REGISTRY.xml.
 */
function buildTaskElement(def) {
  const { id, status, type, goal, depends } = validateTaskDef(def);
  const attrs = [`id="${escapeXml(id)}"`];
  if (type) attrs.push(`type="${escapeXml(type)}"`);
  attrs.push(`status="${escapeXml(status)}"`);
  let body = `      <goal>${escapeXml(goal)}</goal>\n`;
  if (depends) body += `      <depends>${escapeXml(depends)}</depends>\n`;
  return `    <task ${attrs.join(' ')}>\n${body}    </task>\n`;
}

/**
 * Core mutation: insert a new <task> as the last child of <phase id="X">.
 * Pure function of (xml, def) → xml'. Throws TaskWriterError on any
 * violation without touching the input string.
 */
function addTaskToXml(xml, def) {
  const normalized = validateTaskDef(def);
  // 1. Id uniqueness across the whole document — task ids are globally
  //    unique per the existing registry convention.
  if (new RegExp(`<task\\s[^>]*\\bid="${escapeRegex(normalized.id)}"`).test(xml)) {
    throw new TaskWriterError(
      'TASK_ID_EXISTS',
      `Task ${normalized.id} already exists in TASK-REGISTRY.xml`,
    );
  }
  // 2. Locate the phase block.
  const phaseOpenRe = new RegExp(`<phase\\s+id="${escapeRegex(normalized.phase)}"[^>]*>`);
  const openMatch = phaseOpenRe.exec(xml);
  if (!openMatch) {
    throw new TaskWriterError(
      'PHASE_NOT_FOUND',
      `No <phase id="${normalized.phase}"> in TASK-REGISTRY.xml`,
    );
  }
  const phaseStart = openMatch.index;
  const phaseCloseIdx = xml.indexOf('</phase>', phaseStart);
  if (phaseCloseIdx === -1) {
    throw new TaskWriterError(
      'MALFORMED_XML',
      `<phase id="${normalized.phase}"> has no </phase> closer`,
    );
  }
  // 3. Walk back from </phase> to skip the leading indent whitespace so
  //    the inserted task sits flush with other siblings instead of
  //    pushing the closer to the right.
  let insertAt = phaseCloseIdx;
  while (insertAt > 0 && (xml[insertAt - 1] === ' ' || xml[insertAt - 1] === '\t')) {
    insertAt -= 1;
  }
  const newTaskXml = buildTaskElement(normalized);
  return xml.slice(0, insertAt) + newTaskXml + xml.slice(insertAt);
}

/**
 * Atomic file write wrapper around addTaskToXml. Reads the file, mutates
 * the string, writes via tmp + rename. Returns the mutated XML string
 * for caller logging / --print behavior.
 *
 * On validation errors the file is untouched. On WRITE_FAILED the tmp
 * file is cleaned up; the original file remains intact.
 */
function appendTaskToFile({ filePath, def, fsImpl }) {
  const impl = fsImpl || fs;
  let xml;
  try {
    xml = impl.readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new TaskWriterError('WRITE_FAILED', `could not read ${filePath}: ${e.message}`, e);
  }
  const mutated = addTaskToXml(xml, def);
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    impl.writeFileSync(tmp, mutated, { mode: 0o644 });
  } catch (e) {
    try { impl.unlinkSync(tmp); } catch (_) { /* best-effort */ }
    throw new TaskWriterError('WRITE_FAILED', `tmp write failed: ${e.message}`, e);
  }
  try {
    impl.renameSync(tmp, filePath);
  } catch (e) {
    // Rename failed — clean up tmp and leave the original file intact.
    // We deliberately do NOT unlink + retry: on Windows that path risks
    // deleting the original when the subsequent rename also fails.
    try { impl.unlinkSync(tmp); } catch (_) { /* best-effort */ }
    throw new TaskWriterError('WRITE_FAILED', `atomic rename failed: ${e.message}`, e);
  }
  return mutated;
}

module.exports = {
  TaskWriterError,
  ERROR_CODES,
  escapeXml,
  buildTaskElement,
  addTaskToXml,
  appendTaskToFile,
};
