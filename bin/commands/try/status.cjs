'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createTryStatusCommand(deps) {
  return defineCommand({
    meta: { name: 'status', description: 'List staged .gad-try/ sandboxes' },
    run() {
      const { sandboxRoot } = deps.tryPaths();
      if (!fs.existsSync(sandboxRoot)) {
        console.log('No staged tries in this directory.');
        return;
      }
      const entries = fs.readdirSync(sandboxRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
      if (entries.length === 0) {
        console.log('No staged tries in this directory.');
        return;
      }
      console.log(`Staged tries in ${path.relative(process.cwd(), sandboxRoot) || '.gad-try'}:`);
      for (const entry of entries) {
        const provPath = path.join(sandboxRoot, entry.name, 'PROVENANCE.md');
        let source = '(unknown)';
        if (fs.existsSync(provPath)) {
          const body = fs.readFileSync(provPath, 'utf8');
          const match = body.match(/^source:\s*(.+)$/m);
          if (match) source = match[1].trim();
        }
        console.log(`  - ${entry.name}    ${source}`);
      }
      console.log('');
      console.log('Commands:');
      console.log('  gad try cleanup <slug>   # remove one sandbox');
      console.log('  gad try cleanup --all    # remove all sandboxes');
    },
  });
}

module.exports = { createTryStatusCommand };
