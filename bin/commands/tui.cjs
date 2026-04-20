'use strict';
/**
 * gad tui — launch the gad-tui interactive terminal orchestrator.
 *
 * Resolution order:
 *   1. gad-tui.exe alongside gad.exe (installed binary, `path.dirname(process.execPath)`)
 *   2. Error with install hint.
 *
 * All argv beyond `tui` are forwarded to the child process.
 * stdio is inherited so the TUI is fully interactive.
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { defineCommand } = require('citty');

function createTuiCommand() {
  return defineCommand({
    meta: {
      name: 'tui',
      description: 'Launch the gad-tui interactive terminal orchestrator.',
    },
    // Accept any trailing args/flags to pass through to gad-tui.
    args: {},
    run({ rawArgs }) {
      const execDir = path.dirname(process.execPath);
      const tuiExe = path.join(execDir, 'gad-tui.exe');

      if (!fs.existsSync(tuiExe)) {
        process.stderr.write(
          'gad-tui is not installed.\n' +
          'Run `gad self build && gad self install` to install it.\n',
        );
        process.exit(1);
      }

      // rawArgs contains everything after `tui`; forward as-is.
      const forwarded = Array.isArray(rawArgs) ? rawArgs : [];
      const result = spawnSync(tuiExe, forwarded, { stdio: 'inherit' });
      process.exit(result.status ?? 1);
    },
  });
}

module.exports = { createTuiCommand };
module.exports.register = (_ctx) => ({ tui: createTuiCommand() });
