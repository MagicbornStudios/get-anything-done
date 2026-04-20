'use strict';
/**
 * gad try — temporary skill install flow.
 *
 * Behavior lives in bin/commands/try/*.cjs with local shared helpers.
 */

const { defineCommand } = require('citty');
const {
  buildHandoffPrompt,
  copyToClipboardSync,
  extractSkillDependencies,
  printConsentGate,
  resolveTrySource,
  stageTrySandbox,
  tryPaths,
  writeTryEntry,
  writeTryProvenance,
} = require('./try/shared.cjs');
const { createTryStageCommand } = require('./try/stage.cjs');
const { createTryStatusCommand } = require('./try/status.cjs');
const { createTryCleanupCommand } = require('./try/cleanup.cjs');
const { createTryHelpCommand } = require('./try/help.cjs');

function createTryCommand() {
  const commandDeps = {
    buildHandoffPrompt,
    copyToClipboardSync,
    extractSkillDependencies,
    printConsentGate,
    resolveTrySource,
    stageTrySandbox,
    tryPaths,
    writeTryEntry,
    writeTryProvenance,
  };

  const tryCmd = defineCommand({
    meta: { name: 'try', description: 'Stage a skill into .gad-try/<slug>/ without touching ~/.claude/skills/ or the project skill catalog' },
    subCommands: {
      stage: createTryStageCommand(commandDeps),
      status: createTryStatusCommand(commandDeps),
      cleanup: createTryCleanupCommand(commandDeps),
      help: createTryHelpCommand(commandDeps),
    },
  });

  return { tryCmd };
}

module.exports = { createTryCommand };
module.exports.register = () => ({ try: createTryCommand().tryCmd });
