'use strict';
/**
 * gad version — print framework version + git commit/branch for trace stamping
 *
 * Required deps: getFrameworkVersion
 */

const { defineCommand } = require('citty');

function createVersionCommand(deps) {
  const { getFrameworkVersion } = deps;
  return defineCommand({
    meta: { name: 'version', description: 'Print GAD framework version + git commit/branch for trace stamping' },
    args: {
      json: { type: 'boolean', description: 'Emit JSON for consumption by the eval preserver' },
    },
    run({ args }) {
      const info = getFrameworkVersion();
      if (args.json) {
        process.stdout.write(JSON.stringify(info, null, 2) + '\n');
        return;
      }
      console.log(`\nGAD framework version:`);
      console.log(`  version:     ${info.version || '(unknown)'}`);
      console.log(`  methodology: ${info.methodology_version || '(unknown)'}`);
      console.log(`  commit:      ${info.commit || '(unknown)'}`);
      console.log(`  branch:      ${info.branch || '(unknown)'}`);
      console.log(`  commit_ts:   ${info.commit_ts || '(unknown)'}`);
      console.log(`  stamp:       ${info.stamp}`);
      console.log('');
    },
  });
}

module.exports = { createVersionCommand };
