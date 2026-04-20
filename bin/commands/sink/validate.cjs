'use strict';

const { defineCommand } = require('citty');
const { fs, path, resolveSinkScope } = require('./shared.cjs');

function createSinkValidateCommand({ findRepoRoot, gadConfig, resolveRoots, outputError }) {
  return defineCommand({
    meta: { name: 'validate', description: 'Check all sink mappings are well-formed' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Validate all projects', default: false },
    },
    run({ args }) {
      const scopeArgs = { ...args, all: args.all || !args.projectid };
      const scope = resolveSinkScope(scopeArgs, findRepoRoot, gadConfig, resolveRoots, outputError);
      if (!scope) return;
      const { baseDir, roots, sink } = scope;
      let errors = 0;
      let ok = 0;
      for (const root of roots) {
        const planDir = path.join(baseDir, root.path, root.planningDir);
        if (!fs.existsSync(planDir)) {
          console.log(`  x [${root.id}] .planning/ missing: ${planDir}`);
          errors++;
          continue;
        }
        const sinkDir = path.join(baseDir, sink, root.id, 'planning');
        if (!fs.existsSync(sinkDir)) {
          console.log(`  ! [${root.id}] sink dir not yet compiled: ${sink}/${root.id}/planning/`);
        } else {
          console.log(`  OK [${root.id}]`);
          ok++;
        }
      }
      console.log(`\n${ok} valid, ${errors} error(s). Sink: ${sink}`);
      if (errors > 0) process.exit(1);
    },
  });
}

module.exports = { createSinkValidateCommand };
