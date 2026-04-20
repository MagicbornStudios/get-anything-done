'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const {
  isPackagedExecutableRuntime,
  getPackagedExecutablePath,
} = require('../../../lib/install-helpers.cjs');

const FLAG_KEYS = [
  'claude',
  'opencode',
  'gemini',
  'cursor',
  'codex',
  'copilot',
  'antigravity',
  'windsurf',
  'augment',
  'all',
  'local',
  'global',
  'sdk',
  'uninstall',
  'force-statusline',
];

function createInstallAllCommand({ defineCommand }) {
  return defineCommand({
    meta: {
      name: 'all',
      description: 'Delegate to bin/install.js for full framework install (skills, agents, commands, hooks)',
    },
    args: {
      claude: { type: 'boolean' }, opencode: { type: 'boolean' }, gemini: { type: 'boolean' },
      cursor: { type: 'boolean' }, codex: { type: 'boolean' }, copilot: { type: 'boolean' },
      antigravity: { type: 'boolean' }, windsurf: { type: 'boolean' }, augment: { type: 'boolean' },
      all: { type: 'boolean' }, local: { type: 'boolean' }, global: { type: 'boolean' },
      sdk: { type: 'boolean' }, uninstall: { type: 'boolean' },
      'force-statusline': { type: 'boolean' },
      'config-dir': { type: 'string', description: 'Custom runtime config directory', default: '' },
    },
    run: ({ args }) => {
      const installerPath = path.resolve(__dirname, '..', '..', 'install.js');
      const flagArgs = [];

      for (const key of FLAG_KEYS) {
        if (args[key]) flagArgs.push(`--${key}`);
      }

      if (args['config-dir']) {
        flagArgs.push('--config-dir', args['config-dir']);
      }

      if (flagArgs.length === 0) {
        console.log('Usage: gad install all [runtime flags] [--local|--global] [--config-dir <path>]');
        console.log('       passes through to bin/install.js');
        console.log('       runtimes: --claude --opencode --gemini --codex --copilot --antigravity --cursor --windsurf --augment --all');
        return;
      }

      const command = isPackagedExecutableRuntime() ? getPackagedExecutablePath() : process.execPath;
      const commandArgs = isPackagedExecutableRuntime()
        ? ['__gad_internal_install__', ...flagArgs]
        : [installerPath, ...flagArgs];
      const result = spawnSync(command, commandArgs, { stdio: 'inherit', env: process.env });
      process.exit(result.status || 0);
    },
  });
}

module.exports = { createInstallAllCommand };
