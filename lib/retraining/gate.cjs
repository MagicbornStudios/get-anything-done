'use strict';
/**
 * lib/retraining/gate.cjs — promote-gate facade for the retraining pipeline.
 *
 * Thin re-export of lib/models/bench-gate.cjs (the canonical bench-gate impl
 * shipped in task 253-10). Provides the path the retraining design doc + task
 * 253-07 expect (`lib/retraining/gate.cjs`) without duplicating logic.
 *
 * Why two paths?
 *   - lib/models/bench-gate.cjs lives next to the registry, which it reads.
 *   - lib/retraining/gate.cjs is the path retraining-stage callers (promote CLI,
 *     desk-hook orchestrators) link against — keeps the retraining lib surface
 *     self-contained.
 *
 * If you need to change gate logic, change lib/models/bench-gate.cjs. This file
 * stays a passthrough.
 */

const benchGate = require('../models/bench-gate.cjs');

module.exports = {
  shouldPromote: benchGate.shouldPromote,
  shouldPromoteAuto: benchGate.shouldPromoteAuto,
  DEFAULT_MIN_ELO_IMPROVEMENT: benchGate.DEFAULT_MIN_ELO_IMPROVEMENT,
};
