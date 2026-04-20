'use strict';
/**
 * `gad evolution …` command family — validate, install, promote, discard,
 * status, similarity, scan, shed (+ images delegated externally).
 *
 * Most helpers (evolutionPaths, install plumbing, scan writers) stay in
 * gad.cjs because snapshot/eval also consume them; we accept them as deps.
 *
 * Returns evolutionCmd as well as evolutionPromote/evolutionInstall, since
 * the skill family delegates into those two.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { createEvolutionValidateCommand } = require('./evolution/validate.cjs');
const { createEvolutionInstallCommand } = require('./evolution/install.cjs');
const { createEvolutionPromoteCommand } = require('./evolution/promote.cjs');
const { createEvolutionDiscardCommand } = require('./evolution/discard.cjs');
const { createEvolutionStatusCommand } = require('./evolution/status.cjs');
const { createEvolutionSimilarityCommand } = require('./evolution/similarity.cjs');
const { createEvolutionScanCommand } = require('./evolution/scan.cjs');
const { createEvolutionShedCommand } = require('./evolution/shed.cjs');

function createEvolutionCommands(deps) {
  const {
    repoRoot,
    findRepoRoot,
    gadConfig,
    resolveRoots,
    outputError,
    shouldUseJson,
    evolutionPaths,
    resolveProtoSkillInstallRuntimes,
    installProtoSkillToRuntime,
    protoSkillRelativePath,
    writeEvolutionScan,
    readEvolutionScan,
    evolutionImagesCmd,
  } = deps;

  const evolutionValidate = createEvolutionValidateCommand({ repoRoot, evolutionPaths });

  const evolutionInstall = createEvolutionInstallCommand({
    repoRoot,
    evolutionPaths,
    resolveProtoSkillInstallRuntimes,
    installProtoSkillToRuntime,
    protoSkillRelativePath,
  });

  const evolutionPromote = createEvolutionPromoteCommand({ repoRoot, evolutionPaths });

  const evolutionDiscard = createEvolutionDiscardCommand({ repoRoot, evolutionPaths });

  const evolutionStatus = createEvolutionStatusCommand({
    repoRoot,
    evolutionPaths,
    protoSkillRelativePath,
  });
  const evolutionSimilarity = createEvolutionSimilarityCommand({ repoRoot });

  const evolutionScan = createEvolutionScanCommand({
    repoRoot,
    findRepoRoot,
    gadConfig,
    resolveRoots,
    writeEvolutionScan,
    shouldUseJson,
  });

  const evolutionShed = createEvolutionShedCommand({
    repoRoot,
    findRepoRoot,
    gadConfig,
    resolveRoots,
    readEvolutionScan,
    writeEvolutionScan,
    outputError,
    shouldUseJson,
  });

  const evolutionCmd = defineCommand({
    meta: { name: 'evolution', description: 'Manage GAD evolution proto-skills (validate/promote/discard/status/similarity/images)' },
    subCommands: {
      scan: evolutionScan,
      install: evolutionInstall,
      validate: evolutionValidate,
      promote: evolutionPromote,
      discard: evolutionDiscard,
      status: evolutionStatus,
      similarity: evolutionSimilarity,
      shed: evolutionShed,
      images: evolutionImagesCmd,
    },
  });

  return { evolutionCmd, evolutionPromote, evolutionInstall };
}

module.exports = { createEvolutionCommands };

module.exports.provides = (ctx) => {
  const built = createEvolutionCommands({
    ...ctx.common,
    evolutionImagesCmd: ctx.services['evolution-images'].cmd,
  });
  return {
    built,
    evolutionPromote: built.evolutionPromote,
    evolutionInstall: built.evolutionInstall,
  };
};

module.exports.register = (ctx) => ({
  evolution: ctx.services.evolution.built.evolutionCmd,
});
