'use strict';
/**
 * gad eval — deprecated compatibility assembler.
 */

const { createDeprecatedEvalCommand } = require('./eval/compat.cjs');
const { promoteEvalAliases } = require('./eval/promotions.cjs');

module.exports.register = (ctx) => ({
  eval: createDeprecatedEvalCommand(ctx.services),
});

module.exports.postWire = ({ services, subCommands }) => {
  promoteEvalAliases({ services, subCommands });
};
