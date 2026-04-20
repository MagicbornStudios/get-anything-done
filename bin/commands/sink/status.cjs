'use strict';

const { defineCommand } = require('citty');
const { fs, path, resolveSinkScope, SINK_SOURCE_MAP } = require('./shared.cjs');

function createSinkStatusCommand({ findRepoRoot, gadConfig, resolveRoots, outputError, output }) {
  return defineCommand({
    meta: { name: 'status', description: 'Show sync status between .planning/ files and docs sink' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Show all projects', default: false },
    },
    run({ args }) {
      const scope = resolveSinkScope(args, findRepoRoot, gadConfig, resolveRoots, outputError);
      if (!scope || scope.roots.length === 0) return;

      const { baseDir, roots, sink } = scope;
      const { isGenerated } = require('../../../lib/docs-compiler.cjs');
      const rows = [];
      for (const root of roots) {
        const planDir = path.join(baseDir, root.path, root.planningDir);
        for (const { srcs, sink: sinkName } of SINK_SOURCE_MAP) {
          const srcFile = srcs.find((src) => fs.existsSync(path.join(planDir, src)));
          if (!srcFile) continue;
          const srcPath = path.join(planDir, srcFile);
          const destPath = path.join(baseDir, sink, root.id, 'planning', sinkName);
          const destExists = fs.existsSync(destPath);
          const destMtime = destExists ? fs.statSync(destPath).mtimeMs : 0;
          const status = !destExists ? 'missing' : !isGenerated(destPath) ? 'human-authored' : fs.statSync(srcPath).mtimeMs > destMtime ? 'stale' : 'ok';
          rows.push({ project: root.id, src: srcFile, sink: `${root.id}/planning/${sinkName}`, status });
        }
      }

      output(rows, { title: `Sink Status  [sink: ${sink}]` });
      const needSync = rows.filter((row) => row.status === 'missing' || row.status === 'stale').length;
      const humanAuthored = rows.filter((row) => row.status === 'human-authored').length;
      if (needSync > 0) console.log(`\n${needSync} file(s) need sync. Run \`gad sink diff\`, then \`gad sink compile\`.`);
      else console.log('\nOK All generated sink files are up to date.');
      if (humanAuthored > 0) console.log(`${humanAuthored} sink file(s) are not tagged generated - run \`gad sink diff\`; use \`gad sink compile --force\` only after review.`);
    },
  });
}

module.exports = { createSinkStatusCommand };
