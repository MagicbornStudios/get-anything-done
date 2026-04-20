'use strict';

const { defineCommand } = require('citty');

function createProjectsArchiveCommand(deps) {
  const { evalDataAccess } = deps;

  return defineCommand({
    meta: { name: 'archive', description: 'Archive (soft-delete) an eval project' },
    args: {
      id: { type: 'string', description: 'Project id', required: true },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const result = da.archiveProject(args.id);
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Archived project "${args.id}" -> ${result.archivedTo}`);
      }
    },
  });
}

module.exports = { createProjectsArchiveCommand };
