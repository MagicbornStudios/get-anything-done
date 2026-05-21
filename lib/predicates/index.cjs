'use strict';
/**
 * lib/predicates/index.cjs — Tier-0 rule-based business logic predicates
 *
 * Decision: GLOBAL-D-441
 * Named, typed, testable, reusable, explainable predicates for validation,
 * routing, risk scoring, and task/machine classification.
 *
 * Type: GadPredicate<T> = {
 *   id: string,
 *   description: string,
 *   evaluate(input: T): { ok: boolean, reason: string, confidence: number }
 * }
 *
 * Exports:
 *   GadPredicate           — type definition (JSDoc)
 *   registerPredicate()    — add a predicate to the registry
 *   getPredicate()         — retrieve by id
 *   listPredicates()       — list all registered
 *   evaluate()             — run a predicate on input
 *   evaluateMultiple()     — run several in sequence, short-circuit on first fail
 *
 * Reference: .planning/ai-stack/AI-PYRAMID.md section 6 (predicate registry convention)
 */

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** @type {Map<string, GadPredicate>} */
const PREDICATES = new Map();

// ---------------------------------------------------------------------------
// Type Definition (JSDoc for TS consumers)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GadPredicate
 * @property {string} id              — Unique identifier
 * @property {string} description     — Human-readable description
 * @property {Function} evaluate      — (input) => { ok, reason, confidence }
 *
 * @typedef {Object} PredicateResult
 * @property {boolean} ok             — Passed / failed
 * @property {string} reason          — Human-readable explanation
 * @property {number} confidence      — [0,1] how confident in the result
 */

// ---------------------------------------------------------------------------
// Predicates (Tier-0 seed set)
// ---------------------------------------------------------------------------

/**
 * hasEnoughFreeRam
 * Validates that the machine has sufficient free RAM.
 *
 * Input: { freeRamGb: number, requiredGb: number }
 * Reference: AI-PYRAMID section 4 (machine profiles)
 */
const hasEnoughFreeRam = {
  id: 'hasEnoughFreeRam',
  description: 'Machine has enough free RAM for the task',
  evaluate: ({ freeRamGb, requiredGb }) => {
    const ok = freeRamGb >= requiredGb;
    const confidence = 1.0; // deterministic
    const reason = ok
      ? `${freeRamGb.toFixed(1)} GB free >= ${requiredGb} GB required`
      : `${freeRamGb.toFixed(1)} GB free < ${requiredGb} GB required (shortfall: ${(requiredGb - freeRamGb).toFixed(1)} GB)`;
    return { ok, reason, confidence };
  }
};

/**
 * hasEnoughDisk
 * Validates that the machine has sufficient free disk space.
 *
 * Input: { freeDiskGb: number, requiredGb: number }
 * Reference: AI-PYRAMID section 4 (machine profiles)
 */
const hasEnoughDisk = {
  id: 'hasEnoughDisk',
  description: 'Machine has enough free disk space for the task',
  evaluate: ({ freeDiskGb, requiredGb }) => {
    const ok = freeDiskGb >= requiredGb;
    const confidence = 1.0;
    const reason = ok
      ? `${freeDiskGb.toFixed(1)} GB free >= ${requiredGb} GB required`
      : `${freeDiskGb.toFixed(1)} GB free < ${requiredGb} GB required (shortfall: ${(requiredGb - freeDiskGb).toFixed(1)} GB)`;
    return { ok, reason, confidence };
  }
};

/**
 * supportsLocalModel
 * Validates that the machine can support a specific local LLM model.
 * Uses model resource thresholds from AI-PYRAMID section 2.
 *
 * Input: { freeRamGb: number, freeDiskGb: number, modelId: string }
 * modelId examples: 'qwen-0.5b', 'qwen-1.5b', 'qwen-3b', 'qwen-7b', 'phi-3.5-mini'
 * Reference: AI-PYRAMID section 2 (model resource table)
 */
const supportsLocalModel = {
  id: 'supportsLocalModel',
  description: 'Machine meets resource requirements for a local LLM model',
  evaluate: ({ freeRamGb, freeDiskGb, modelId }) => {
    // Model resource requirements (Q4 quantized, from AI-PYRAMID)
    const modelSpecs = {
      'gpt-2-small': { diskGb: 0.5, ramGb: 0.5 },
      'qwen-0.5b': { diskGb: 0.8, ramGb: 1.5 },
      'qwen-1.5b': { diskGb: 1.5, ramGb: 3 },
      'qwen-3b': { diskGb: 2.5, ramGb: 5 },
      'qwen-7b': { diskGb: 5, ramGb: 7 },
      'phi-3.5-mini': { diskGb: 3, ramGb: 5 },
      'deepseek-r1-distill-1.5b': { diskGb: 2, ramGb: 3 }
    };

    const spec = modelSpecs[modelId];
    if (!spec) {
      return {
        ok: false,
        reason: `Unknown model: ${modelId}`,
        confidence: 1.0
      };
    }

    const ramOk = freeRamGb >= spec.ramGb;
    const diskOk = freeDiskGb >= spec.diskGb;
    const ok = ramOk && diskOk;
    const confidence = 1.0;

    if (ok) {
      return {
        ok: true,
        reason: `${modelId}: ${freeRamGb.toFixed(1)} GB RAM >= ${spec.ramGb} GB, ${freeDiskGb.toFixed(1)} GB disk >= ${spec.diskGb} GB`,
        confidence
      };
    }

    const issues = [];
    if (!ramOk) issues.push(`RAM: ${freeRamGb.toFixed(1)} < ${spec.ramGb}`);
    if (!diskOk) issues.push(`disk: ${freeDiskGb.toFixed(1)} < ${spec.diskGb}`);

    return {
      ok: false,
      reason: `${modelId} unsupported: ${issues.join(', ')}`,
      confidence
    };
  }
};

/**
 * shouldEscalateToFrontier
 * Determines if a task should escalate from Tier 0–4 to frontier (Tier 5).
 * Code patches, refactors, and architecture work escalate.
 *
 * Input: { taskKind: string, complexity: number }
 * taskKind: 'bugfix' | 'refactor' | 'feature' | 'architecture' | 'review' | 'summary'
 * complexity: [0, 10] where 0 = trivial, 10 = extremely complex
 * Reference: AI-PYRAMID section 1 (routing rule: push down as far as accuracy allows)
 */
const shouldEscalateToFrontier = {
  id: 'shouldEscalateToFrontier',
  description: 'Task should be escalated to frontier LLM (Tier 5)',
  evaluate: ({ taskKind, complexity }) => {
    // Tasks that always escalate
    const escalatingKinds = ['refactor', 'architecture'];
    if (escalatingKinds.includes(taskKind)) {
      return {
        ok: true,
        reason: `Task kind '${taskKind}' requires frontier escalation`,
        confidence: 0.95
      };
    }

    // Complexity threshold: medium-to-high complexity escalates
    // Threshold tuned from AI-PYRAMID section 3 (accuracy tables)
    if (complexity >= 7) {
      return {
        ok: true,
        reason: `Complexity ${complexity}/10 exceeds local-model threshold (7); escalate to frontier`,
        confidence: 0.85
      };
    }

    // Low-complexity tasks stay local
    return {
      ok: false,
      reason: `Task kind '${taskKind}' at complexity ${complexity}/10 suitable for Tier 0–4`,
      confidence: 0.80
    };
  }
};

/**
 * isHighRiskFileChange
 * Flags files that pose security, stability, or auth risks if modified.
 *
 * Input: { files: string[] }  — file paths (absolute or relative to repo root)
 * High-risk patterns: lib.rs, Cargo.toml, lockfiles, auth modules, secrets
 * Reference: AI-PYRAMID section 6 (predicate seed set)
 */
const isHighRiskFileChange = {
  id: 'isHighRiskFileChange',
  description: 'Change includes high-risk files (auth, lockfiles, core lib)',
  evaluate: ({ files }) => {
    if (!Array.isArray(files) || files.length === 0) {
      return {
        ok: false,
        reason: 'No files in change set',
        confidence: 1.0
      };
    }

    // High-risk patterns
    const highRiskPatterns = [
      /lib\.rs$/i,
      /src-tauri\/src\/lib\.rs/i,
      /Cargo\.toml$/i,
      /Cargo\.lock$/i,
      /pnpm-lock\.yaml$/i,
      /package-lock\.json$/i,
      /\.env/i,
      /secrets/i,
      /auth.*\.rs$/i,
      /clerk/i
    ];

    const riskFiles = files.filter(f => highRiskPatterns.some(p => p.test(f)));

    if (riskFiles.length > 0) {
      return {
        ok: true,
        reason: `High-risk files detected: ${riskFiles.join(', ')}`,
        confidence: 0.98
      };
    }

    return {
      ok: false,
      reason: 'No high-risk files in change set',
      confidence: 0.95
    };
  }
};

/**
 * isStaleTask
 * Determines if a task is stale (unchanged for N days).
 *
 * Input: { updatedAt: string (ISO), nowMs: number, staleDays: number }
 * Reference: AI-PYRAMID section 6 (stale-task detection)
 */
const isStaleTask = {
  id: 'isStaleTask',
  description: 'Task is stale (unchanged for N days)',
  evaluate: ({ updatedAt, nowMs, staleDays = 14 }) => {
    const updatedMs = new Date(updatedAt).getTime();

    if (isNaN(updatedMs)) {
      return {
        ok: false,
        reason: `Invalid updatedAt timestamp: ${updatedAt}`,
        confidence: 1.0
      };
    }

    const ageMs = nowMs - updatedMs;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const isStale = ageDays >= staleDays;

    if (isStale) {
      return {
        ok: true,
        reason: `Task is ${ageDays.toFixed(1)} days old (threshold: ${staleDays} days)`,
        confidence: 1.0
      };
    }

    return {
      ok: false,
      reason: `Task is ${ageDays.toFixed(1)} days old (threshold: ${staleDays} days)`,
      confidence: 1.0
    };
  }
};

/**
 * requiresApproval
 * Determines if an action requires explicit operator approval.
 * Destructive actions (delete, reset, force-push) and high-risk deployments escalate.
 *
 * Input: { action: string }  — action name
 * action examples: 'delete-task', 'reset-workspace', 'force-push', 'deploy-prod', 'revoke-token'
 * Reference: AI-PYRAMID section 6 (validation/routing)
 */
const requiresApproval = {
  id: 'requiresApproval',
  description: 'Action requires explicit operator approval',
  evaluate: ({ action }) => {
    // Actions that always require approval
    const requiresApprovalActions = [
      'delete-task',
      'delete-project',
      'reset-workspace',
      'reset-hard',
      'force-push',
      'revoke-token',
      'delete-handoff',
      'cancel-worker',
      'deploy-prod',
      'purge-cache'
    ];

    if (requiresApprovalActions.includes(action)) {
      return {
        ok: true,
        reason: `Action '${action}' is destructive and requires approval`,
        confidence: 0.98
      };
    }

    // Safe actions
    return {
      ok: false,
      reason: `Action '${action}' does not require approval`,
      confidence: 0.90
    };
  }
};

// ---------------------------------------------------------------------------
// Registry API
// ---------------------------------------------------------------------------

/**
 * Register a predicate in the registry.
 * @param {GadPredicate} pred
 * @throws if pred.id already registered
 */
function registerPredicate(pred) {
  if (!pred || !pred.id || !pred.description || typeof pred.evaluate !== 'function') {
    throw new Error(`Invalid predicate shape: ${JSON.stringify(pred)}`);
  }
  if (PREDICATES.has(pred.id)) {
    throw new Error(`Predicate already registered: ${pred.id}`);
  }
  PREDICATES.set(pred.id, pred);
}

/**
 * Get a registered predicate by id.
 * @param {string} id
 * @returns {GadPredicate | undefined}
 */
function getPredicate(id) {
  return PREDICATES.get(id);
}

/**
 * List all registered predicates.
 * @returns {GadPredicate[]}
 */
function listPredicates() {
  return Array.from(PREDICATES.values());
}

/**
 * Evaluate a predicate by id on input.
 * @param {string} id
 * @param {*} input
 * @returns {PredicateResult}
 * @throws if predicate id not found
 */
function evaluate(id, input) {
  const pred = getPredicate(id);
  if (!pred) {
    throw new Error(`Predicate not found: ${id}`);
  }
  return pred.evaluate(input);
}

/**
 * Evaluate multiple predicates in sequence.
 * Short-circuits on first failure (ok: false).
 *
 * @param {string[]} predicateIds
 * @param {*} sharedInput
 * @returns {{ predicateId: string, result: PredicateResult }[]}
 */
function evaluateMultiple(predicateIds, sharedInput) {
  const results = [];
  for (const id of predicateIds) {
    const result = evaluate(id, sharedInput);
    results.push({ predicateId: id, result });
    if (!result.ok) {
      break; // short-circuit
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Initialize registry with seed predicates
// ---------------------------------------------------------------------------

registerPredicate(hasEnoughFreeRam);
registerPredicate(hasEnoughDisk);
registerPredicate(supportsLocalModel);
registerPredicate(shouldEscalateToFrontier);
registerPredicate(isHighRiskFileChange);
registerPredicate(isStaleTask);
registerPredicate(requiresApproval);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Types (for JSDoc consumers)
  // GadPredicate, PredicateResult (exported via JSDoc above)

  // Individual predicates (for testing/direct import)
  hasEnoughFreeRam,
  hasEnoughDisk,
  supportsLocalModel,
  shouldEscalateToFrontier,
  isHighRiskFileChange,
  isStaleTask,
  requiresApproval,

  // Registry API
  registerPredicate,
  getPredicate,
  listPredicates,
  evaluate,
  evaluateMultiple,

  // Internal (for debugging/introspection)
  PREDICATES
};
