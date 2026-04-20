'use strict';

const { defineCommand } = require('citty');
const { buildEvalPrompt } = require('../../../lib/eval-helpers.cjs');
const { discoverEvalProjects, fs, parseSelectedProjects, path } = require('./shared.cjs');

function createEvalSuiteCommand({ listAllEvalProjects, defaultEvalsDir, outputError }) {
  return defineCommand({
    meta: { name: 'suite', description: 'Generate bootstrap prompts for all eval projects in parallel' },
    args: {
      projects: { type: 'string', description: 'Comma-separated project names (default: all with templates)', default: '' },
    },
    run({ args }) {
      const discovered = discoverEvalProjects(listAllEvalProjects, outputError);
      if (!discovered) return;

      const runnable = discovered.filter((d) => fs.existsSync(path.join(d.projectDir, 'template')));
      const projectDirByName = new Map(discovered.map((d) => [d.name, d.projectDir]));
      const selectedProjects = parseSelectedProjects(args.projects, runnable.map((d) => d.name));

      if (selectedProjects.length === 0) {
        outputError('No runnable eval projects found (need template/ directory).');
      }

      const suiteDir = path.join(defaultEvalsDir(), '.suite-runs', new Date().toISOString().replace(/[:.]/g, '-'));
      fs.mkdirSync(suiteDir, { recursive: true });

      console.log(`\nEval Suite: ${selectedProjects.length} project(s)\n`);

      const results = [];
      for (const project of selectedProjects) {
        const projectDir = projectDirByName.get(project) || path.join(defaultEvalsDir(), project);
        if (!fs.existsSync(projectDir)) {
          console.log(`  x ${project} - not found, skipping`);
          continue;
        }

        const runs = fs.readdirSync(projectDir).filter((n) => /^v\d+$/.test(n)).map((n) => parseInt(n.slice(1), 10));
        const runNum = runs.length > 0 ? Math.max(...runs) + 1 : 1;
        const prompt = buildEvalPrompt(projectDir, project, runNum);
        const promptFile = path.join(suiteDir, `${project}-v${runNum}.md`);
        fs.writeFileSync(promptFile, prompt);

        const tokens = Math.ceil(prompt.length / 4);
        results.push({ project, version: `v${runNum}`, chars: prompt.length, tokens, file: `${project}-v${runNum}.md` });
        console.log(`  OK ${project} v${runNum} - ${tokens} tokens -> ${project}-v${runNum}.md`);
      }

      fs.writeFileSync(path.join(suiteDir, 'SUITE.json'), JSON.stringify({
        created: new Date().toISOString(),
        projects: results,
      }, null, 2));

      console.log(`\nOK Suite prepared: ${results.length} prompt(s) in:`);
      console.log(`  ${path.relative(process.cwd(), suiteDir)}/`);
      console.log('\nTo run: launch each prompt as a separate agent with worktree isolation.');
      console.log('After all complete: gad generation report');
    },
  });
}

module.exports = { createEvalSuiteCommand };
