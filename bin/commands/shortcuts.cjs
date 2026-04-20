'use strict';

const { defineCommand } = require('citty');
const { createSpawnCommand } = require('./shortcuts/spawn.cjs');
const { createBreedCommand } = require('./shortcuts/breed.cjs');
const { createPlayCommand } = require('./shortcuts/play.cjs');

function createShortcutCommands(deps) {
  return {
    spawnCmd: createSpawnCommand(deps),
    breedCmd: createBreedCommand(deps),
    playCmd: createPlayCommand(deps),
  };
}

module.exports = { createShortcutCommands };
module.exports.register = (ctx) => {
  const { spawnCmd, breedCmd, playCmd } = createShortcutCommands({
    ...ctx.common,
    evalRun: ctx.services['eval-run'].cmd,
    servePreservedGenerationBuildArtifact:
      ctx.services['eval-preview'].servePreservedGenerationBuildArtifact,
    defineCommand,
  });
  return { spawn: spawnCmd, breed: breedCmd, play: playCmd };
};
