'use strict';

const fs = require('fs');
const { defineCommand } = require('citty');
const { pidPath } = require('../../../lib/delta-train/paths.cjs');

module.exports = defineCommand({
  meta: {
    name: 'stop',
    description: 'Stop the delta-training daemon.',
  },
  args: {
    projectid: { type: 'string', description: 'Project to stop', default: 'global' },
  },
  run({ args }) {
    const baseDir = process.cwd();
    const p = pidPath(baseDir);
    if (!fs.existsSync(p)) {
      console.log('No daemon running (PID file missing).');
      return;
    }

    const pid = parseInt(fs.readFileSync(p, 'utf8'), 10);
    if (Number.isNaN(pid)) {
      console.log('Invalid PID in PID file.');
      return;
    }

    console.log(`[delta-train] Sending SIGTERM to daemon with PID ${pid}...`);
    try {
      process.kill(pid, 'SIGTERM');
      console.log('[delta-train] Signal sent.');
    } catch (e) {
      if (e.code === 'ESRCH') {
        console.log('[delta-train] Process not found. It might have already stopped.');
        fs.unlinkSync(p);
      } else {
        console.error(`[delta-train] Failed to kill process: ${e.message}`);
      }
    }
  },
});
