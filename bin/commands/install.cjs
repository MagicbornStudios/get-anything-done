'use strict';

const { defineCommand } = require('citty');
const { createInstallHooksCommand, createUninstallHooksCommand, createSyncHookFilesCommand } = require('./install/hooks.cjs');
const { createInstallAllCommand, runInstallDelegation } = require('./install/all.cjs');
const { createInstallSelfCommand } = require('./install/self.cjs');

const INSTALL_FLAG_ARGS = {
  claude: { type: 'boolean' },
  opencode: { type: 'boolean' },
  gemini: { type: 'boolean' },
  cursor: { type: 'boolean' },
  codex: { type: 'boolean' },
  copilot: { type: 'boolean' },
  antigravity: { type: 'boolean' },
  windsurf: { type: 'boolean' },
  augment: { type: 'boolean' },
  all: { type: 'boolean' },
  local: { type: 'boolean' },
  global: { type: 'boolean' },
  sdk: { type: 'boolean' },
  uninstall: { type: 'boolean' },
  'force-statusline': { type: 'boolean' },
  'config-dir': { type: 'string', description: 'Custom runtime config directory', default: '' },
};

function createInstallCommands() {
  const hooks = createInstallHooksCommand({ defineCommand });
  const all = createInstallAllCommand({ defineCommand });
  const self = createInstallSelfCommand({ defineCommand });
  const syncHookFiles = createSyncHookFilesCommand({ defineCommand });
  const uninstallHooks = createUninstallHooksCommand({ defineCommand });

  const install = defineCommand({
    meta: { name: 'install', description: 'Install GAD into an agent runtime (hooks, framework, or full install)' },
    args: INSTALL_FLAG_ARGS,
    subCommands: { hooks, all, self, 'sync-hook-files': syncHookFiles },
    run: ({ args }) => runInstallDelegation(args),
  });

  const uninstall = defineCommand({
    meta: { name: 'uninstall', description: 'Uninstall GAD trace hooks (full uninstall: use install.js --uninstall)' },
    subCommands: { hooks: uninstallHooks },
  });

  return { install, uninstall };
}

module.exports = { createInstallCommands };
module.exports.register = () => createInstallCommands();
