'use strict';
/**
 * gad eval — deprecated compatibility assembler.
 */

const { createDeprecatedEvalCommand } = require('./eval/compat.cjs');
const { promoteEvalAliases } = require('./eval/promotions.cjs');
const { createEvalClustersCommand } = require('./eval/clusters.cjs');

module.exports.register = (ctx) => ({
  eval: (() => {
    const evalCmd = createDeprecatedEvalCommand(ctx.services);
    // Inject clusters subcommand (phase 112-01)
    evalCmd.subCommands = Object.assign({}, evalCmd.subCommands, {
      clusters: createEvalClustersCommand(ctx.common),
    });
    return evalCmd;
  })(),
});

module.exports.postWire = ({ services, subCommands }) => {
  promoteEvalAliases({ services, subCommands });
};
