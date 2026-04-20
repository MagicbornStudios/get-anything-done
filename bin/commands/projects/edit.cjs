'use strict';

const { defineCommand } = require('citty');

function createProjectsEditCommand(deps) {
  const { evalDataAccess } = deps;

  return defineCommand({
    meta: { name: 'edit', description: "Update an existing eval project's metadata" },
    args: {
      id: { type: 'string', description: 'Project id', required: true },
      name: { type: 'string', description: 'Display name', default: '' },
      description: { type: 'string', description: 'Description', default: '' },
      domain: { type: 'string', description: 'Domain', default: '' },
      techStack: { type: 'string', description: 'Tech stack', default: '' },
      tagline: { type: 'string', description: 'Tagline', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const updates = {};
      if (args.name) updates.name = args.name;
      if (args.description) updates.description = args.description;
      if (args.domain) updates.domain = args.domain;
      if (args.techStack) updates.techStack = args.techStack;
      if (args.tagline) updates.tagline = args.tagline;
      if (Object.keys(updates).length === 0) {
        console.error('No fields to update. Pass --name, --description, --domain, --techStack, or --tagline.');
        process.exit(1);
      }
      const result = da.updateProject(args.id, updates);
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Updated project "${args.id}"`);
      }
    },
  });
}

module.exports = { createProjectsEditCommand };
