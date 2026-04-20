'use strict';

const { defineCommand } = require('citty');
const { fs, path } = require('./shared.cjs');

function createEvalSetupCommand({ resolveOrDefaultEvalProjectDir }) {
  return defineCommand({
    meta: { name: 'setup', description: 'Scaffold a new eval project with planning template' },
    args: {
      project: { type: 'string', description: 'Eval project name (e.g. escape-the-dungeon)', default: '' },
      requirements: { type: 'string', description: 'Path to source requirements file to copy', default: '' },
    },
    run({ args }) {
      if (!args.project) {
        console.error('\nUsage: gad eval setup --project <name> [--requirements <path>]\n');
        process.exit(1);
      }
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);
      const templateDir = path.join(projectDir, 'template', '.planning');

      if (fs.existsSync(projectDir)) {
        console.log(`Eval project "${args.project}" already exists at ${projectDir}`);
        return;
      }

      fs.mkdirSync(templateDir, { recursive: true });

      const now = new Date().toISOString().split('T')[0];
      fs.writeFileSync(path.join(templateDir, 'STATE.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase></current-phase>
  <current-plan></current-plan>
  <milestone>${args.project}-eval</milestone>
  <status>not-started</status>
  <next-action>Read REQUIREMENTS.xml. Use /gad:discuss-phase to collect requirements and open questions before planning phases.</next-action>
  <last-updated>${now}</last-updated>
</state>
`);

      fs.writeFileSync(path.join(templateDir, 'ROADMAP.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <!-- Phases will be planned after discussion phase -->
</roadmap>
`);

      fs.writeFileSync(path.join(templateDir, 'TASK-REGISTRY.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<task-registry>
  <!-- Tasks will be planned after discussion phase -->
</task-registry>
`);

      fs.writeFileSync(path.join(templateDir, 'DECISIONS.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <!-- Decisions will be captured during discussion and implementation -->
</decisions>
`);

      if (args.requirements && fs.existsSync(args.requirements)) {
        const ext = path.extname(args.requirements);
        const dest = path.join(projectDir, `source-requirements${ext}`);
        fs.copyFileSync(args.requirements, dest);
        console.log(`  Copied ${args.requirements} -> ${dest}`);
      }

      fs.writeFileSync(path.join(projectDir, 'REQUIREMENTS.md'), `# Eval: ${args.project}

## What this eval measures

1. **Skill trigger accuracy** - are /gad:* skills triggered at the right moments
2. **Planning quality** - coherent phases, tasks, decisions from requirements
3. **CLI context efficiency** - gad snapshot delivers what the agent needs
4. **End-to-end loop** - discuss -> plan -> execute -> verify -> score
5. **Time-to-completion** - wall clock and token counts

## Eval flow

1. Pre-planning: \`/gad:discuss-phase\` - collect open questions, clarify requirements
2. Planning: \`/gad:plan-phase\` - break into implementable phases with tasks
3. Execution: \`/gad:execute-phase\` - implement, update planning docs, commit
4. Verification: \`/gad:verify-work\` - check against definition of done
5. Scoring: TRACE.json + SCORE.md

## Human review

After eval agent completes, human reviews output quality.
Manual score added to SCORE.md.
`);

      console.log(`\nOK Eval project created: ${projectDir}`);
      console.log('\n  template/.planning/ - STATE.xml, ROADMAP.xml, TASK-REGISTRY.xml, DECISIONS.xml');
      console.log('  REQUIREMENTS.md - eval definition');
      if (args.requirements) console.log(`  source-requirements${path.extname(args.requirements)} - copied source`);
      console.log('\n  Next: add REQUIREMENTS.xml to template/.planning/ with structured requirements');
      console.log(`  Then: gad species run --project ${args.project}`);
    },
  });
}

module.exports = { createEvalSetupCommand };
