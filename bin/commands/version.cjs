'use strict';
/**
 * gad version — print framework version + git commit/branch for trace stamping
 */

const { defineCommand } = require('citty');
const { getFrameworkVersion } = require('../../lib/framework-version.cjs');

function createVersionCommand() {
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
      if (info.src_hash) console.log(`  src_hash:    ${info.src_hash}`);
      if (info.built_at) console.log(`  built_at:    ${info.built_at}`);
      console.log(`  stamp:       ${info.stamp}`);
      console.log('');
    },
  });
}

module.exports = { createVersionCommand };
module.exports.register = () => ({ version: createVersionCommand() });
