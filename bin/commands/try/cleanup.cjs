'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createTryCleanupCommand(deps) {
  return defineCommand({
    meta: { name: 'cleanup', description: 'Remove a staged .gad-try/<slug>/ sandbox' },
    args: {
      slug: { type: 'positional', description: 'sandbox slug to remove', required: false },
      all: { type: 'boolean', description: 'Remove all staged sandboxes', default: false },
    },
    run({ args }) {
      const { sandboxRoot } = deps.tryPaths();
      if (!fs.existsSync(sandboxRoot)) {
        console.log('No .gad-try/ directory in cwd — nothing to clean up.');
        return;
      }

      const toRemove = [];
      if (args.all) {
        for (const entry of fs.readdirSync(sandboxRoot, { withFileTypes: true })) {
          if (entry.isDirectory()) toRemove.push(entry.name);
        }
      } else {
        if (!args.slug) {
          console.error('gad try cleanup: pass a <slug> or --all');
          process.exit(1);
        }
        const dir = path.join(sandboxRoot, args.slug);
        if (!fs.existsSync(dir)) {
          console.error(`No sandbox at ${path.relative(process.cwd(), dir)}`);
          process.exit(1);
        }
        toRemove.push(args.slug);
      }

      for (const slug of toRemove) {
        const dir = path.join(sandboxRoot, slug);
        const provPath = path.join(dir, 'PROVENANCE.md');
        if (fs.existsSync(provPath)) {
          const body = fs.readFileSync(provPath, 'utf8');
          const installsSection = body.match(/## Declared installs\s*\n([\s\S]*?)\n##/);
          const implicitSection = body.match(/## Implicit.*?install commands\s*\n([\s\S]*?)\n##/);
          const allInstallLines = [];
          for (const section of [installsSection, implicitSection]) {
            if (section && !/\(none/i.test(section[1]) && !/no pip/i.test(section[1])) {
              for (const line of section[1].split('\n')) {
                const trimmed = line.replace(/^[-!?\s]+/, '').replace(/`/g, '').trim();
                if (trimmed) allInstallLines.push(trimmed);
              }
            }
          }
          if (allInstallLines.length > 0) {
            console.log(`  ${slug}: skill declared or referenced these installs:`);
            for (const install of allInstallLines) console.log(`    ${install}`);
            console.log('  (not rolled back automatically — run manually if needed)');
          }
        }
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`  Removed ${path.relative(process.cwd(), dir)}`);
      }

      try {
        if (fs.readdirSync(sandboxRoot).length === 0) {
          fs.rmdirSync(sandboxRoot);
        }
      } catch {}
    },
  });
}

module.exports = { createTryCleanupCommand };
