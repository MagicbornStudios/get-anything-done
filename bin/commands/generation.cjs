'use strict';
/**
 * gad generation — preserved generations command assembler.
 */

const { defineCommand } = require('citty');
const { createGenerationSalvageCommand } = require('./generation/salvage.cjs');

function createGenerationCommands(deps) {
  const generationSalvage = createGenerationSalvageCommand(deps);
  const generationCmd = defineCommand({
    meta: {
      name: 'generation',
      description:
        'Preserved generations: salvage, preserve, verify, open (HTTP preview of **build artifact** — same as `gad play`), review, report. Not `gad site serve` (planning/marketing Next app).',
    },
    subCommands: {
      salvage: generationSalvage,
    },
  });

  return { generationSalvage, generationCmd };
}

module.exports = { createGenerationCommands };
module.exports.provides = (ctx) => createGenerationCommands(ctx.common);
module.exports.register = (ctx) => ({
  generation: ctx.services.generation.generationCmd,
});
