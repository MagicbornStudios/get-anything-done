'use strict';

const { defineCommand } = require('citty');
const { createInstallHooksCommand, createUninstallHooksCommand } = require('./install/hooks.cjs');
const { createInstallAllCommand } = require('./install/all.cjs');
const { createInstallSelfCommand } = require('./install/self.cjs');

function createInstallCommands() {
  const hooks = createInstallHooksCommand({ defineCommand });
  const all = createInstallAllCommand({ defineCommand });
  const self = createInstallSelfCommand({ defineCommand });
  const uninstallHooks = createUninstallHooksCommand({ defineCommand });

  const install = defineCommand({
    meta: { name: 'install', description: 'Install GAD into an agent runtime (hooks, framework, or full install)' },
    subCommands: { hooks, all, self },
  });

  const uninstall = defineCommand({
    meta: { name: 'uninstall', description: 'Uninstall GAD trace hooks (full uninstall: use install.js --uninstall)' },
    subCommands: { hooks: uninstallHooks },
  });

  return { install, uninstall };
}

module.exports = { createInstallCommands };
module.exports.register = () => createInstallCommands();
