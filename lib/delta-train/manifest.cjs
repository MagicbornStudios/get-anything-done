'use strict';

const SCHEMA_V = 1;

/**
 * Validates a candidate manifest.
 */
function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return false;
  if (manifest.schema_v !== SCHEMA_V) return false;
  if (!manifest.candidate_id) return false;
  return true;
}

/**
 * Creates a new candidate manifest.
 */
function createManifest(data) {
  return {
    schema_v: SCHEMA_V,
    candidate_id: `cand-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    trained_at: new Date().toISOString(),
    ...data,
  };
}

module.exports = {
  SCHEMA_V,
  validateManifest,
  createManifest,
};
