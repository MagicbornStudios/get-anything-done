'use strict';
/**
 * gad species — species CRUD (decision gad-203) + project level/XP (phase 127)
 *
 * Required deps: evalDataAccess
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const xpMath = require('../../lib/xp-math.cjs');
const taskFiles = require('../../lib/task-files.cjs');

function createSpeciesCommand(deps) {
  const { evalDataAccess, findRepoRoot, gadConfig, resolveRoots, outputError } = deps;

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

  // gad species level — show project evolution level + XP + loadout (phase 127)
  const level = defineCommand({
    meta: { name: 'level', description: 'Show project evolution level, XP, and threshold' },
    args: {
      projectid: { type: 'string', description: 'Project id', required: true },
      json:      { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id>.');
        process.exit(1);
        return;
      }
      if (roots.length > 1) {
        outputError('level requires a single project. Pass --projectid <id>.');
        process.exit(1);
        return;
      }
      const root = roots[0];

      const stateXmlPath = path.join(baseDir, root.path, root.planningDir, 'STATE.xml');
      if (!fs.existsSync(stateXmlPath)) {
        console.error(`STATE.xml not found at ${stateXmlPath}`);
        process.exit(1);
        return;
      }

      const xml = fs.readFileSync(stateXmlPath, 'utf8');
      const levelMatch = xml.match(/<level\s+value="(\d+)"\s+xp="(\d+)"\s+xp_to_next="(\d+)"\s+loaded_skills="(\d+)"\/?>/);
      if (!levelMatch) {
        console.error('<level> element not found in STATE.xml');
        process.exit(1);
        return;
      }

      const level = {
        value: parseInt(levelMatch[1], 10),
        xp: parseInt(levelMatch[2], 10),
        xpToNext: parseInt(levelMatch[3], 10),
        loadedSkills: parseInt(levelMatch[4], 10),
      };

      const stampedIds = xpMath.readStampedTasks(stateXmlPath, fs);
      const remaining = Math.max(0, level.xpToNext - level.xp);
      const ready = level.xp >= level.xpToNext;

      if (args.json) {
        console.log(JSON.stringify({
          level: level.value,
          xp: level.xp,
          xp_to_next: level.xpToNext,
          remaining,
          level_up_ready: ready,
          loaded_skills: level.loadedSkills,
          stamped_task_count: stampedIds.length,
        }, null, 2));
        return;
      }

      console.log(`Level ${level.value} (XP ${level.xp} / ${level.xpToNext} → ${remaining} to next)`);
      console.log(`Stamped tasks: ${stampedIds.length}`);
      console.log(`Status: ${ready ? 'level-up ready' : 'climbing'}`);
    },
  });

  // gad species recalculate-xp — backfill XP from full task-stamp history (phase 127)
  const recalculateXp = defineCommand({
    meta: { name: 'recalculate-xp', description: 'Recompute XP from all done+stamped tasks. Idempotent backfill.' },
    args: {
      projectid: { type: 'string', description: 'Project id', required: true },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id>.');
        process.exit(1);
        return;
      }
      if (roots.length > 1) {
        outputError('recalculate-xp requires a single project. Pass --projectid <id>.');
        process.exit(1);
        return;
      }
      const root = roots[0];

      const planningDir = path.join(baseDir, root.path, root.planningDir);
      if (!taskFiles.hasTasksDir(planningDir)) {
        console.error(`No tasks directory at ${planningDir}/tasks`);
        process.exit(1);
        return;
      }

      const stateXmlPath = path.join(planningDir, 'STATE.xml');
      if (!fs.existsSync(stateXmlPath)) {
        console.error(`STATE.xml not found at ${stateXmlPath}`);
        process.exit(1);
        return;
      }

      // Read all tasks
      const allTasks = taskFiles.listAll(planningDir);
      const doneWithSkill = allTasks.filter(t => t.status === 'done' && t.skill);

      // Sum XP
      let totalXp = 0;
      const stampedTaskIds = [];
      for (const task of doneWithSkill) {
        const weight = xpMath.getSkillWeight(task.skill);
        totalXp += weight;
        stampedTaskIds.push(task.id);
      }

      // Read current level to preserve value and loaded_skills
      let xml = fs.readFileSync(stateXmlPath, 'utf8');
      const levelMatch = xml.match(/<level\s+value="(\d+)"\s+xp="(\d+)"\s+xp_to_next="(\d+)"\s+loaded_skills="(\d+)"\/?>/);
      if (!levelMatch) {
        console.error('<level> element not found in STATE.xml');
        process.exit(1);
        return;
      }

      const curValue = parseInt(levelMatch[1], 10);
      const curLoadedSkills = parseInt(levelMatch[4], 10);
      const newXpToNext = xpMath.xpToNextLevel(curValue);

      // Auto-advance level if XP exceeds current threshold
      let finalValue = curValue;
      let finalXp = totalXp;
      let finalXpToNext = newXpToNext;

      while (finalXp >= finalXpToNext) {
        // Level up: reset XP, advance level, recalc threshold with phase 127 formula
        finalXp -= finalXpToNext;
        finalValue += 1;
        finalXpToNext = xpMath.xpToNextLevel(finalValue);
      }

      // Write updated level
      const levelTag = `  <level value="${finalValue}" xp="${finalXp}" xp_to_next="${finalXpToNext}" loaded_skills="${curLoadedSkills}"/>`;
      xml = xml.replace(/(\s*<level\s[^>]*\/?>)/, levelTag);

      // Write stamped-tasks
      const stampedContent = stampedTaskIds.map(id => `    ${id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`).join('\n');
      const stampedBlock = `  <stamped-tasks>\n${stampedContent}\n  </stamped-tasks>`;
      if (/<stamped-tasks[^>]*>[\s\S]*?<\/stamped-tasks>/s.test(xml)) {
        xml = xml.replace(/<stamped-tasks[^>]*>[\s\S]*?<\/stamped-tasks>/s, stampedBlock);
      } else {
        xml = xml.replace(/(\s*<level\s[^>]*\/?>)/, `$1\n${stampedBlock}`);
      }

      fs.writeFileSync(stateXmlPath, xml);

      // Summary
      console.log(`Recalculated XP for project "${args.projectid}":`);
      console.log(`  Done tasks with skill: ${doneWithSkill.length}`);
      console.log(`  Total XP: ${totalXp}`);
      console.log(`  Level: ${finalValue} (XP ${finalXp} / ${finalXpToNext})`);
      if (finalValue > curValue) {
        console.log(`  Auto-leveled up from ${curValue} → ${finalValue}`);
      }
      console.log(`  Stamped tasks tracked: ${stampedTaskIds.length}`);
    },
  });

  return defineCommand({
    meta: { name: 'species', description: 'Manage species (list, create, edit, clone, archive, run, suite) and project evolution level' },
    subCommands: { list, create, edit, clone, archive, level, 'recalculate-xp': recalculateXp },
  });
}

module.exports = { createSpeciesCommand };
module.exports.register = (ctx) => ({
  species: createSpeciesCommand(ctx.common),
});
