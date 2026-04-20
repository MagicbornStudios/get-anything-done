'use strict';
/**
 * gad recipes — recipes are branch templates (decision gad-206)
 *
 * Required deps: evalDataAccess
 */

const { defineCommand } = require('citty');

function createRecipesCommand(deps) {
  const { evalDataAccess } = deps;

  const list = defineCommand({
    meta: { name: 'list', description: 'List all recipes for a project' },
    args: {
      project: { type: 'string',  description: 'Project id', required: true },
      json:    { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const recipes = da.listRecipes(args.project);
      if (args.json) { console.log(JSON.stringify(recipes, null, 2)); return; }
      if (recipes.length === 0) { console.log(`No recipes in project "${args.project}"`); return; }
      for (const r of recipes) {
        const skills = (r.installedSkills || []).length;
        const constraints = r.constraints ? Object.keys(r.constraints).length : 0;
        console.log(`  ${r.slug}  workflow=${r.workflow || '?'}  constraints=${constraints}  skills=${skills}`);
      }
    },
  });

  const create = defineCommand({
    meta: { name: 'create', description: 'Create a new recipe under a project' },
    args: {
      project:     { type: 'string',  description: 'Project id', required: true },
      name:        { type: 'string',  description: 'Recipe slug (kebab-case)', required: true },
      workflow:    { type: 'string',  description: 'Workflow (gad, bare, emergent)', default: '' },
      description: { type: 'string',  description: 'Description', default: '' },
      json:        { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const data = {};
      if (args.workflow) data.workflow = args.workflow;
      if (args.description) data.description = args.description;
      data.name = args.name;
      const result = da.createRecipe(args.project, args.name, data);
      if (args.json) console.log(JSON.stringify(result, null, 2));
      else console.log(`Created recipe "${args.name}" in project "${args.project}" at ${result.recipeDir}`);
    },
  });

  const apply = defineCommand({
    meta: { name: 'apply', description: 'Create a new species from a recipe template' },
    args: {
      project: { type: 'string',  description: 'Project id', required: true },
      recipe:  { type: 'string',  description: 'Recipe slug', required: true },
      species: { type: 'string',  description: 'New species name (kebab-case)', required: true },
      json:    { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const result = da.applyRecipe(args.project, args.recipe, args.species);
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Applied recipe "${args.recipe}" -> new species "${args.species}" in project "${args.project}"`);
        console.log(`  ${result.speciesDir}`);
      }
    },
  });

  const del = defineCommand({
    meta: { name: 'delete', description: 'Delete a recipe' },
    args: {
      project: { type: 'string',  description: 'Project id', required: true },
      name:    { type: 'string',  description: 'Recipe slug', required: true },
      json:    { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const result = da.deleteRecipe(args.project, args.name);
      if (args.json) console.log(JSON.stringify(result, null, 2));
      else console.log(`Deleted recipe "${args.name}" from project "${args.project}"`);
    },
  });

  return defineCommand({
    meta: { name: 'recipes', description: 'Manage recipes (list, create, apply, delete)' },
    subCommands: { list, create, apply, delete: del },
  });
}

module.exports = { createRecipesCommand };
module.exports.register = (ctx) => ({ recipes: createRecipesCommand(ctx.common) });
