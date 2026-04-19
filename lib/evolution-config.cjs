'use strict';

/**
 * lib/evolution-config.cjs — bundles the evolution / skill / proto-skill
 * helper bindings that bin/gad.cjs used to build inline. Each function
 * pre-binds the underlying lib helpers with the deps available in gad.cjs
 * (sideEffectsSuppressed, detectRuntimeIdentity, readEvolutionScan, …).
 *
 * Extracted in sweep H, 2026-04-19.
 */

const path = require('path');
const __skillHelpers = require('./skill-helpers.cjs');
const __protoSkillHelpers = require('./proto-skill-helpers.cjs');
const __graphHelpers = require('./graph-helpers.cjs');

function createEvolutionConfig({
  outputError,
  sideEffectsSuppressed,
  detectRuntimeIdentity,
  readEvolutionScan,
}) {
  // Decision gad-183 + task 42.2-15: candidates live under .planning/ —
  // they're planning artifacts, not canonical framework assets. Legacy
  // skills/candidates is still tolerated downstream during migration.
  function evolutionPaths(repoRoot) {
    return {
      candidatesDir: path.join(repoRoot, '.planning', 'candidates'),
      protoSkillsDir: path.join(repoRoot, '.planning', 'proto-skills'),
      finalSkillsDir: path.join(repoRoot, 'skills'),
      evolutionsDir: path.join(repoRoot, 'skills', '.evolutions'),
    };
  }

  function resolveSkillRoots(repoRoot) {
    const defaults = evolutionPaths(repoRoot);
    return {
      finalSkillsDir: process.env.GAD_SKILLS_DIR
        ? path.resolve(process.env.GAD_SKILLS_DIR)
        : defaults.finalSkillsDir,
      protoSkillsDir: process.env.GAD_PROTO_SKILLS_DIR
        ? path.resolve(process.env.GAD_PROTO_SKILLS_DIR)
        : defaults.protoSkillsDir,
    };
  }

  function buildEvolutionScan(root, baseDir, repoRoot) {
    return __skillHelpers.buildEvolutionScan(root, baseDir, repoRoot, { resolveSkillRoots });
  }

  function writeEvolutionScan(root, baseDir, repoRoot) {
    return __skillHelpers.writeEvolutionScan(root, baseDir, repoRoot, {
      resolveSkillRoots,
      sideEffectsSuppressed,
    });
  }

  function validateSkillLaneFilter(raw) {
    const lane = String(raw || '').trim().toLowerCase();
    if (!lane) return '';
    if (!['dev', 'prod', 'meta'].includes(lane)) {
      outputError(`Invalid lane: ${lane}. Expected dev, prod, or meta.`);
    }
    return lane;
  }

  function resolveProtoSkillInstallRuntimes(args) {
    return __protoSkillHelpers.resolveProtoSkillInstallRuntimes(args, { detectRuntimeIdentity });
  }

  function buildEvolutionSection(root, baseDir) {
    return __graphHelpers.buildEvolutionSection(root, baseDir, { readEvolutionScan });
  }

  return {
    evolutionPaths,
    resolveSkillRoots,
    buildEvolutionScan,
    writeEvolutionScan,
    validateSkillLaneFilter,
    resolveProtoSkillInstallRuntimes,
    buildEvolutionSection,
  };
}

module.exports = { createEvolutionConfig };
