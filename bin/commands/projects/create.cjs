'use strict';

const { defineCommand } = require('citty');

function createProjectsCreateCommand(deps) {
  const { evalDataAccess } = deps;

  return defineCommand({
    meta: { name: 'create', description: 'Create a new eval project' },
    args: {
      id: { type: 'string', description: 'Project id (kebab-case)', required: true },
      name: { type: 'string', description: 'Display name', default: '' },
      description: { type: 'string', description: 'Project description', default: '' },
      domain: { type: 'string', description: 'Domain (game, site, cli, etc.)', default: '' },
      techStack: { type: 'string', description: 'Tech stack (kaplay, next.js, etc.)', default: '' },
      root: { type: 'string', description: 'Target eval root id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const data = {};
      if (args.name) data.name = args.name;
      if (args.description) data.description = args.description;
      if (args.domain) data.domain = args.domain;
      if (args.techStack) data.techStack = args.techStack;
      const opts = {};
      if (args.root) opts.rootId = args.root;
      const result = da.createProject(args.id, data, opts);
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Created project "${args.id}" at ${result.projectDir}`);
      }
    },
  });
}

module.exports = { createProjectsCreateCommand };
