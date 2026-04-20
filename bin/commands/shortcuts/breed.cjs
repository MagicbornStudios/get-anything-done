'use strict';

function createBreedCommand({ defineCommand, evalDataAccess }) {
  return defineCommand({
    meta: { name: 'breed', description: 'Breed two species into a new one - union + shed redundancy (decision gad-219)' },
    args: {
      project: { type: 'string', description: 'Project id', required: true },
      parentA: { type: 'string', description: 'Primary parent species (precedence on scalar conflicts)', required: true },
      parentB: { type: 'string', description: 'Secondary parent species', required: true },
      name: { type: 'string', description: 'New species name (kebab-case)', required: true },
      description: { type: 'string', description: 'Override description', default: '' },
      workflow: { type: 'string', description: 'Override workflow (gad, bare, emergent)', default: '' },
      noInherit: { type: 'boolean', description: 'Do not set inherits_from on the bred species', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const result = da.breedSpecies(args.project, args.parentA, args.parentB, args.name, {
        description: args.description || undefined,
        workflow: args.workflow || undefined,
        noInherit: args.noInherit,
      });

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`Bred "${args.parentA}" + "${args.parentB}" -> "${args.name}" in project "${args.project}"`);
      console.log(`  shed: dna=${result.shed.dna}, installedSkills=${result.shed.installedSkills}`);
      console.log(`  dir: ${result.speciesDir}`);
    },
  });
}

module.exports = { createBreedCommand };
