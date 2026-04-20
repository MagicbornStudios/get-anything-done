'use strict';

const fs = require('fs');

function readFileExcerpt(filePath, maxChars = 2400) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}\n\n...[truncated for runtime context]`;
  } catch {
    return null;
  }
}

function detectContextKindFromFile(fileRef) {
  const normalized = String(fileRef || '').replace(/\\/g, '/').toLowerCase();
  if (normalized.endsWith('state.xml') || normalized.endsWith('state.md')) return 'task';
  if (normalized.endsWith('roadmap.xml') || normalized.endsWith('roadmap.md')) return 'phase';
  if (normalized.includes('/phases/') && normalized.endsWith('plan.md')) return 'phase';
  if (normalized.endsWith('agents.md') || normalized.endsWith('claude.md')) return 'runtime-hints';
  if (normalized.includes('handoff')) return 'decision-log';
  return 'file-snippet';
}

function inferTaskShapeFromState(state, explicitTaskShape) {
  if (explicitTaskShape) return explicitTaskShape;
  const nextAction = String(state?.nextAction || '').toLowerCase();
  if (nextAction.includes('test') || nextAction.includes('failing')) return 'test-repair';
  if (nextAction.includes('refactor') || nextAction.includes('cleanup')) return 'refactor';
  if (nextAction.includes('analy') || nextAction.includes('investigat')) return 'analysis';
  return 'planning';
}

function toSelectionTrace(selection = {}, opts = {}) {
  const computedPrimary = Object.prototype.hasOwnProperty.call(selection, 'computedPrimary')
    ? selection.computedPrimary
    : selection?.computed?.primary ?? null;
  const effectivePrimary = Object.prototype.hasOwnProperty.call(selection, 'effectivePrimary')
    ? selection.effectivePrimary
    : selection?.effective?.primary ?? null;
  const fallbackChain = Array.isArray(selection?.fallbackChain)
    ? selection.fallbackChain
    : Array.isArray(selection?.effective?.fallbackChain)
      ? selection.effective.fallbackChain
      : [];
  const reasoning = Array.isArray(selection?.reasoning)
    ? selection.reasoning
    : Array.isArray(selection?.effective?.reasoning)
      ? selection.effective.reasoning
      : [];
  const appliedSkills = Array.isArray(selection?.appliedSkills)
    ? selection.appliedSkills
    : Array.isArray(selection?.effective?.appliedSkills)
      ? selection.effective.appliedSkills
      : [];
  const suppressedSkills = Array.isArray(selection?.suppressedSkills) ? selection.suppressedSkills : [];
  return {
    mode: selection?.mode ?? null,
    configuredPrimary: selection?.configuredPrimary ?? null,
    computedPrimary,
    effectivePrimary,
    fallbackChain,
    reasoning,
    appliedSkills,
    suppressedSkills,
    suppressedReason: selection?.suppressedReason ?? null,
    projectOverrideActive: Boolean(opts.projectOverrideActive),
    forceRuntimeActive: Boolean(opts.forceRuntimeActive),
    forceRuntime: opts.forceRuntime || null,
  };
}

function buildGadContextProvenance(context) {
  const contextRefs = Array.isArray(context?.contextRefs) ? context.contextRefs : [];
  const handoffArtifacts = Array.isArray(context?.handoffArtifacts) ? context.handoffArtifacts : [];
  const contextBlocks = Array.isArray(context?.contextBlocks) ? context.contextBlocks : [];
  const snapshotRefPaths = contextRefs.map((ref) => String(ref?.file || '')).filter(Boolean);
  return {
    projectId: context?.projectId || null,
    sessionId: context?.sessionId || null,
    snapshotSource: {
      present: snapshotRefPaths.length > 0,
      refCount: snapshotRefPaths.length,
      refs: snapshotRefPaths.slice(0, 12),
    },
    handoffInputs: {
      present: handoffArtifacts.length > 0,
      count: handoffArtifacts.length,
      artifacts: handoffArtifacts,
    },
    docInputs: {
      present: contextBlocks.length > 0,
      contextBlockCount: contextBlocks.length,
      contextRefCount: contextRefs.length,
    },
    taskShape: {
      value: context?.taskShape || null,
      source: context?.taskShapeSource || 'state.next-action',
    },
    contextBlocksInjected: contextBlocks.length,
  };
}

function annotateJsonArtifact(filePath, patch) {
  if (!filePath || !patch) return;
  try {
    if (!fs.existsSync(filePath)) return;
    const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const next = { ...current, ...patch };
    fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  } catch {}
}

function annotateRuntimeArtifacts(payload, patch) {
  if (!payload || !patch || typeof patch !== 'object') return;
  if (payload.matrixFile) annotateJsonArtifact(payload.matrixFile, patch);
  if (Array.isArray(payload.traceFiles)) {
    for (const traceFile of payload.traceFiles) annotateJsonArtifact(traceFile, patch);
  }
}

module.exports = {
  readFileExcerpt,
  detectContextKindFromFile,
  inferTaskShapeFromState,
  toSelectionTrace,
  buildGadContextProvenance,
  annotateJsonArtifact,
  annotateRuntimeArtifacts,
};
