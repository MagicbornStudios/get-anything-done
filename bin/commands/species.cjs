'use strict';
/**
 * gad species — species CRUD (decision gad-203)
 *
 * Required deps: evalDataAccess
 */

const { defineCommand } = require('citty');

function createSpeciesCommand(deps) {
  const { evalDataAccess } = deps;

  const create = defineCommand({
    meta: { name: 'create', description: 'Create a new species under a project' },
    args: {
      project:     { type: 'string',  description: 'Project id', required: true },
      name:        { type: 'string',  description: 'Species name (kebab-case)', required: true },
      workflow:    { type: 'string',  description: 'Workflow (gad, bare, emergent)', default: '' },
      description: { type: 'string',  description: 'Description', default: '' },
      inherits:    { type: 'string',  description: 'Parent species name', default: '' },
      json:        { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const data = {};
      if (args.workflow) data.workflow = args.workflow;
      if (args.description) data.description = args.description;
      if (args.inherits) data.inherits_from = args.inherits;
      const result = da.createSpecies(args.project, args.name, data);
      if (args.json) console.log(JSON.stringify(result, null, 2));
      else console.log(`Created species "${args.name}" in project "${args.project}" at ${result.speciesDir}`);
    },
  });

  const edit = defineCommand({
    meta: { name: 'edit', description: "Update a species' metadata" },
    args: {
      project:     { type: 'string',  description: 'Project id', required: true },
      name:        { type: 'string',  description: 'Species name', required: true },
      workflow:    { type: 'string',  description: 'Workflow', default: '' },
      description: { type: 'string',  description: 'Description', default: '' },
      json:        { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const updates = {};
      if (args.workflow) updates.workflow = args.workflow;
      if (args.description) updates.description = args.description;
      if (Object.keys(updates).length === 0) {
        console.error('No fields to update. Pass --workflow or --description.');
        process.exit(1);
      }
      const result = da.updateSpecies(args.project, args.name, updates);
      if (args.json) console.log(JSON.stringify(result, null, 2));
      else console.log(`Updated species "${args.name}" in project "${args.project}"`);
    },
  });

  const clone = defineCommand({
    meta: { name: 'clone', description: 'Clone a species to a new name (optionally inheriting)' },
    args: {
      project:     { type: 'string',  description: 'Project id', required: true },
      source:      { type: 'string',  description: 'Source species name', required: true },
      name:        { type: 'string',  description: 'New species name (kebab-case)', required: true },
      description: { type: 'string',  description: 'Override description', default: '' },
      noInherit:   { type: 'boolean', description: 'Do not set inherits_from on the clone', default: false },
      json:        { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const result = da.cloneSpecies(args.project, args.source, args.name, {
        inherit: !args.noInherit,
        description: args.description || undefined,
      });
      if (args.json) console.log(JSON.stringify(result, null, 2));
      else console.log(`Cloned "${args.source}" -> "${args.name}" in project "${args.project}"`);
    },
  });

  const archive = defineCommand({
    meta: { name: 'archive', description: 'Archive (soft-delete) a species' },
    args: {
      project: { type: 'string',  description: 'Project id', required: true },
      name:    { type: 'string',  description: 'Species name', required: true },
      json:    { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const result = da.archiveSpecies(args.project, args.name);
      if (args.json) console.log(JSON.stringify(result, null, 2));
      else console.log(`Archived species "${args.name}" in project "${args.project}" -> ${result.archivedTo}`);
    },
  });

  const list = defineCommand({
    meta: { name: 'list', description: 'List all species for a project' },
    args: {
      project:  { type: 'string',  description: 'Project id', required: true },
      resolved: { type: 'boolean', description: 'Show resolved (merged) configs', default: false },
      json:     { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      if (args.resolved) {
        const species = da.getAllResolvedSpecies(args.project);
        if (args.json) console.log(JSON.stringify(species, null, 2));
        else for (const s of species) {
          const gens = da.listGenerations(args.project, s.species);
          console.log(`  ${s.species}  workflow=${s.workflow || '?'}  gens=${gens.length}`);
        }
      } else {
        const raw = da.listSpecies(args.project);
        if (args.json) console.log(JSON.stringify(raw, null, 2));
        else for (const [name, cfg] of Object.entries(raw)) {
          const gens = da.listGenerations(args.project, name);
          console.log(`  ${name}  workflow=${cfg.workflow || '?'}  gens=${gens.length}`);
        }
      }
    },
  });

  return defineCommand({
    meta: { name: 'species', description: 'Manage species (list, create, edit, clone, archive, run, suite)' },
    subCommands: { list, create, edit, clone, archive },
  });
}

module.exports = { createSpeciesCommand };
module.exports.register = (ctx) => ({
  species: createSpeciesCommand(ctx.common),
});
