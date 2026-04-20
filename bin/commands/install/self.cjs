'use strict';

const path = require('path');
const fs = require('fs');
const {
  isPackagedExecutableRuntime,
  getPackagedExecutablePath,
  getDefaultSelfInstallDir,
  updateWindowsUserPath,
} = require('../../../lib/install-helpers.cjs');

function createInstallSelfCommand({ defineCommand }) {
  return defineCommand({
    meta: {
      name: 'self',
      description: 'Install the packaged gad executable into a user bin directory and add it to PATH',
    },
    args: { dir: { type: 'string', description: 'Target install directory', default: '' } },
    run: ({ args }) => {
      if (!isPackagedExecutableRuntime()) {
        console.error('gad install self is only available from a packaged gad executable.');
        process.exit(1);
      }

      const targetDir = args.dir ? path.resolve(args.dir) : getDefaultSelfInstallDir();
      const sourceExecutable = getPackagedExecutablePath();
      const executableName = process.platform === 'win32' ? 'gad.exe' : 'gad';
      const targetExecutable = path.join(targetDir, executableName);

      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(sourceExecutable, targetExecutable);
      if (process.platform === 'win32') {
        fs.copyFileSync(sourceExecutable, path.join(targetDir, 'get-anything-done.exe'));
        updateWindowsUserPath(targetDir);
      }

      console.log('Installed gad executable');
      console.log(`  source: ${sourceExecutable}`);
      console.log(`  target: ${targetExecutable}`);
      if (process.platform === 'win32') {
        console.log(`  path:   ${targetDir}`);
        console.log('\nOpen a new terminal and run: gad --help');
      } else {
        console.log(`\nAdd ${targetDir} to PATH if it is not already present.`);
      }
    },
  });
}

module.exports = { createInstallSelfCommand };
