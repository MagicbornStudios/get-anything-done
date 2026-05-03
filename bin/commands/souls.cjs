'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const { defineCommand } = require('citty');

const {
  listSouls,
  readNarrativeToml,
  resolveProjectRoot,
  slugify,
  writeNarrativeToml,
  writeSoul,
  writeSoulPointer,
} = require('../../lib/souls.cjs');
const { scaffoldProjectInitInstructions } = require('./projects/init-contract.cjs');

function projectVars(projectRoot, args) {
  const projectName = args.name || path.basename(projectRoot);
  const projectId = args.projectid || slugify(projectName);
  return {
    projectName,
    projectId,
    templateVars: {
      project_name: projectName,
      project_id: projectId,
      project_upper: projectId.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
    },
  };
}

function printInstructionResults(projectRoot, results) {
  console.log('Initial instructions:');
  for (const result of results) {
    if (result.existed) {
      console.log(`  Preserved ${path.relative(projectRoot, result.targetPath)}; wrote ${path.relative(projectRoot, result.outputPath)}`);
      console.log(`    ${result.compareHint}`);
    } else {
      console.log(`  Created ${path.relative(projectRoot, result.outputPath)}`);
    }
  }
}

function maybeInstallSkills(projectRoot, args) {
  if (!args['install-skills']) return;
  const runtimes = [];
  if (args.claude || !args.cursor) runtimes.push('--claude');
  if (args.cursor) runtimes.push('--cursor');
  const result = spawnSync('gad', ['install', ...runtimes, '--local'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`gad install exited with ${result.status}`);
  }
}

function createSoulsCommand() {
  const commonArgs = {
    path: { type: 'string', description: 'Project path (default: cwd)', default: '' },
    projectid: { type: 'string', description: 'Project id for generated guidance', default: '' },
    name: { type: 'string', description: 'Project display name (default: folder name)', default: '' },
  };

  const init = defineCommand({
    meta: { name: 'init', description: 'Create narrative soul files and install GAD initial instruction contracts.' },
    args: {
      ...commonArgs,
      soul: { type: 'string', description: 'Soul id/name to activate', default: 'gilgamesh' },
      body: { type: 'string', description: 'Optional first paragraph for the soul body', default: '' },
      force: { type: 'boolean', description: 'Overwrite SOUL.md and existing soul file', default: false },
      'install-skills': { type: 'boolean', description: 'Also run `gad install --claude --local` in the project', default: false },
      claude: { type: 'boolean', description: 'Install Claude runtime skills when --install-skills is set', default: true },
      cursor: { type: 'boolean', description: 'Install Cursor runtime skills when --install-skills is set', default: false },
    },
    run({ args }) {
      const projectRoot = resolveProjectRoot(process.cwd(), args.path);
      const { projectName, projectId, templateVars } = projectVars(projectRoot, args);
      const soulResult = writeSoul(projectRoot, {
        soul: args.soul,
        name: args.soul,
        projectName,
        body: args.body,
        force: args.force,
      });
      const narrativeToml = writeNarrativeToml(projectRoot, soulResult.soulId);
      const pointer = writeSoulPointer(projectRoot, soulResult.soulId, { force: args.force });
      const instructionResults = scaffoldProjectInitInstructions(projectRoot, templateVars);

      maybeInstallSkills(projectRoot, args);

      console.log(`✓ Soul initialized for ${projectName} (${projectId})`);
      console.log(`  Project: ${projectRoot}`);
      console.log(`  Active soul: ${soulResult.soulId}`);
      console.log(`  Soul body: ${path.relative(projectRoot, soulResult.filePath)}`);
      console.log(`  Narrative config: ${path.relative(projectRoot, narrativeToml)}`);
      if (pointer.existed) console.log(`  Preserved SOUL.md; wrote ${path.relative(projectRoot, pointer.outputPath)}`);
      printInstructionResults(projectRoot, instructionResults);
      console.log('');
      console.log('Next:');
      console.log(`  gad snapshot --projectid ${projectId}`);
      console.log(`  gad souls list --path "${projectRoot}"`);
      if (!args['install-skills']) console.log(`  gad install --claude --local   # run from ${projectRoot} to install runtime skills`);
    },
  });

  const list = defineCommand({
    meta: { name: 'list', description: 'List souls in a project narrative.' },
    args: { path: commonArgs.path, json: { type: 'boolean', default: false } },
    run({ args }) {
      const projectRoot = resolveProjectRoot(process.cwd(), args.path);
      const rows = listSouls(projectRoot);
      if (args.json) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }
      if (!rows.length) {
        console.log('No souls found. Run `gad souls init` or `gad souls add <name>`.');
        return;
      }
      for (const row of rows) {
        console.log(`${row.active ? '*' : ' '} ${row.id}  ${path.relative(projectRoot, row.path)}`);
      }
    },
  });

  const add = defineCommand({
    meta: { name: 'add', description: 'Add a soul markdown file without activating it unless --use is passed.' },
    args: {
      path: commonArgs.path,
      soul: { type: 'string', default: '', description: 'Soul id/name' },
      body: { type: 'string', default: '' },
      use: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
    run({ args }) {
      const projectRoot = resolveProjectRoot(process.cwd(), args.path);
      const soul = args.soul || args._?.[0];
      if (!soul) {
        console.error('Usage: gad souls add <soul>');
        process.exitCode = 1;
        return;
      }
      const result = writeSoul(projectRoot, { soul, name: soul, body: args.body, force: args.force });
      if (args.use) {
        writeNarrativeToml(projectRoot, result.soulId);
        writeSoulPointer(projectRoot, result.soulId, { force: args.force });
      }
      console.log(`${result.written ? 'Created' : 'Kept'} ${path.relative(projectRoot, result.filePath)}`);
      if (args.use) console.log(`Active soul: ${result.soulId}`);
    },
  });

  const use = defineCommand({
    meta: { name: 'use', description: 'Set the active soul and update SOUL.md pointer.' },
    args: {
      path: commonArgs.path,
      soul: { type: 'string', default: '', description: 'Soul id/name' },
      force: { type: 'boolean', default: true },
    },
    run({ args }) {
      const projectRoot = resolveProjectRoot(process.cwd(), args.path);
      const soul = slugify(args.soul || args._?.[0] || '');
      if (!soul) {
        console.error('Usage: gad souls use <soul>');
        process.exitCode = 1;
        return;
      }
      writeNarrativeToml(projectRoot, soul);
      writeSoulPointer(projectRoot, soul, { force: args.force });
      console.log(`Active soul: ${readNarrativeToml(projectRoot).activeSoul}`);
    },
  });

  return defineCommand({
    meta: { name: 'souls', description: 'Create and manage project souls used by GAD startup guidance.' },
    subCommands: { init, list, add, use },
  });
}

module.exports = { createSoulsCommand };
module.exports.register = () => ({ souls: createSoulsCommand() });
