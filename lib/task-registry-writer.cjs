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
 *   - addPhaseToRegistryXml(xml, phaseId, opts)
 *   - ensurePhaseInFile({ filePath, phaseId, fsImpl })
 *   - updateTaskGoalInXml(xml, { id, goal })
 *   - updateTaskGoalInFile({ filePath, id, goal, fsImpl })
 *   - appendTaskToFile({filePath, def, fsImpl}) — writes to disk atomically
 *   - escapeXml(text)                  — exported for tests + promote
 *
 * Stable error codes (caller maps to exit codes / operator hints):
 *   - TASK_ID_EXISTS     — the id already appears somewhere in the doc
 *   - TASK_NOT_FOUND     — update target task id not found
 *   - PHASE_NOT_FOUND    — no <phase id="X"> matches
 *   - PHASE_ID_EXISTS    — phase id already exists when add path expects fresh
 *   - VALIDATION_FAILED  — required field missing or malformed
 *   - MALFORMED_XML      — matched <phase> has no </phase> closer
 *   - WRITE_FAILED       — fs rename/write failure (cause preserved)
 */

const fs = require('fs');
const path = require('path');

const ERROR_CODES = Object.freeze([
  'TASK_ID_EXISTS',
  'TASK_NOT_FOUND',
  'PHASE_NOT_FOUND',
  'PHASE_ID_EXISTS',
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

function validatePhaseId(phaseId) {
  const id = String(phaseId || '').trim();
  if (!id) throw new TaskWriterError('VALIDATION_FAILED', 'phase id is required');
  if (!/^[A-Za-z0-9.-]+$/.test(id)) {
    throw new TaskWriterError('VALIDATION_FAILED', `phase "${id}" contains disallowed characters`);
  }
  return id;
}

function addPhaseToRegistryXml(xml, phaseId, opts = {}) {
  const normalized = validatePhaseId(phaseId);
  const phaseOpenRe = new RegExp(`<phase\\s+id="${escapeRegex(normalized)}"`);
  if (phaseOpenRe.test(xml)) {
    if (opts.ifExists === 'noop') {
      return { xml, inserted: false };
    }
    throw new TaskWriterError('PHASE_ID_EXISTS', `Phase ${normalized} already exists in TASK-REGISTRY.xml`);
  }
  const idx = xml.lastIndexOf('</task-registry>');
  if (idx < 0) {
    throw new TaskWriterError('MALFORMED_XML', 'no closing </task-registry> tag in TASK-REGISTRY.xml');
  }
  const block = `  <phase id="${escapeXml(normalized)}">\n  </phase>\n`;
  const before = xml.slice(0, idx).replace(/\s*$/, '');
  const after = xml.slice(idx);
  return {
    xml: `${before}\n\n${block}${after}`,
    inserted: true,
  };
}

function updateTaskGoalInXml(xml, def) {
  const id = String(def && def.id || '').trim();
  const goal = String(def && def.goal || '').trim();
  if (!id) throw new TaskWriterError('VALIDATION_FAILED', 'task id is required');
  if (!goal) throw new TaskWriterError('VALIDATION_FAILED', 'goal is required');
  const taskRe = new RegExp(`(<task\\b[^>]*\\bid="${escapeRegex(id)}"[^>]*>[\\s\\S]*?<\\/task>)`);
  const match = taskRe.exec(xml);
  if (!match) {
    throw new TaskWriterError('TASK_NOT_FOUND', `Task ${id} not found in TASK-REGISTRY.xml`);
  }
  const originalTaskBlock = match[1];
  let updatedTaskBlock;
  if (/<goal>[\s\S]*?<\/goal>/.test(originalTaskBlock)) {
    updatedTaskBlock = originalTaskBlock.replace(
      /<goal>[\s\S]*?<\/goal>/,
      `<goal>${escapeXml(goal)}</goal>`,
    );
  } else {
    updatedTaskBlock = originalTaskBlock.replace(
      /<\/task>$/,
      `      <goal>${escapeXml(goal)}</goal>\n    </task>`,
    );
  }
  return xml.slice(0, match.index) + updatedTaskBlock + xml.slice(match.index + originalTaskBlock.length);
}

function atomicWriteFile(filePath, nextContents, impl) {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    impl.writeFileSync(tmp, nextContents, { mode: 0o644 });
  } catch (e) {
    try { impl.unlinkSync(tmp); } catch (_) { /* best-effort */ }
    throw new TaskWriterError('WRITE_FAILED', `tmp write failed: ${e.message}`, e);
  }
  try {
    impl.renameSync(tmp, filePath);
  } catch (e) {
    try { impl.unlinkSync(tmp); } catch (_) { /* best-effort */ }
    throw new TaskWriterError('WRITE_FAILED', `atomic rename failed: ${e.message}`, e);
  }
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
  atomicWriteFile(filePath, mutated, impl);
  return mutated;
}

function ensurePhaseInFile({ filePath, phaseId, fsImpl }) {
  const impl = fsImpl || fs;
  let xml;
  try {
    xml = impl.readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new TaskWriterError('WRITE_FAILED', `could not read ${filePath}: ${e.message}`, e);
  }
  const result = addPhaseToRegistryXml(xml, phaseId, { ifExists: 'noop' });
  if (!result.inserted) return result;
  atomicWriteFile(filePath, result.xml, impl);
  return result;
}

function updateTaskGoalInFile({ filePath, id, goal, fsImpl }) {
  const impl = fsImpl || fs;
  let xml;
  try {
    xml = impl.readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new TaskWriterError('WRITE_FAILED', `could not read ${filePath}: ${e.message}`, e);
  }
  const mutated = updateTaskGoalInXml(xml, { id, goal });
  atomicWriteFile(filePath, mutated, impl);
  return mutated;
}

module.exports = {
  TaskWriterError,
  ERROR_CODES,
  escapeXml,
  buildTaskElement,
  addTaskToXml,
  appendTaskToFile,
  addPhaseToRegistryXml,
  ensurePhaseInFile,
  updateTaskGoalInXml,
  updateTaskGoalInFile,
};
