'use strict';
/**
 * `gad evolution …` command family — validate, install, promote, discard,
 * status, similarity, scan, shed (+ images delegated externally).
 *
 * Most helpers (evolutionPaths, install plumbing, scan writers) stay in
 * gad.cjs because snapshot/eval also consume them; we accept them as deps.
 *
 * Returns evolutionCmd as well as evolutionPromote/evolutionInstall, since
 * the skill family delegates into those two.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { createEvolutionValidateCommand } = require('./evolution/validate.cjs');
const { createEvolutionInstallCommand } = require('./evolution/install.cjs');
const { createEvolutionPromoteCommand } = require('./evolution/promote.cjs');
const { createEvolutionDiscardCommand } = require('./evolution/discard.cjs');
const { createEvolutionStatusCommand } = require('./evolution/status.cjs');
const { createEvolutionSimilarityCommand } = require('./evolution/similarity.cjs');
const { createEvolutionScanCommand } = require('./evolution/scan.cjs');
const { createEvolutionShedCommand } = require('./evolution/shed.cjs');
const { loadSessions } = require('./session.cjs');

/** Read current level from STATE.xml. Returns default if absent. */
function readLevelFromStateXml(stateXmlPath) {
  if (!fs.existsSync(stateXmlPath)) return null;
  const xml = fs.readFileSync(stateXmlPath, 'utf8');
  const levelMatch = xml.match(/<level\s+value="(\d+)"\s+xp="(\d+)"\s+xp_to_next="(\d+)"\s+loaded_skills="(\d+)"\/?>/);
  if (levelMatch) {
    return {
      value: parseInt(levelMatch[1], 10),
      xp: parseInt(levelMatch[2], 10),
      xpToNext: parseInt(levelMatch[3], 10),
      loadedSkills: parseInt(levelMatch[4], 10),
    };
  }
  return { value: 1, xp: 0, xpToNext: 100, loadedSkills: 0 };
}

/** Write level element back to STATE.xml (inserts if absent, replaces if present). */
function writeLevelToStateXml(stateXmlPath, level) {
  let xml = fs.readFileSync(stateXmlPath, 'utf8');
  const levelTag = `  <level value="${level.value}" xp="${level.xp}" xp_to_next="${level.xpToNext}" loaded_skills="${level.loadedSkills}"/>`;
  if (/<level\s/.test(xml)) {
    xml = xml.replace(/(\s*<level\s[^>]*\/?>)/, levelTag);
  } else {
    xml = xml.replace(/<state/, '<state\n' + levelTag);
  }
  fs.writeFileSync(stateXmlPath, xml);
}

/** Close all active sessions for a given project root. */
function closeActiveSessions(baseDir, roots, projectId) {
  const sessions = loadSessions(baseDir, roots);
  let count = 0;
  for (const s of sessions) {
    if (s.projectId === projectId && s.status === 'active') {
      s.status = 'closed';
      s.updatedAt = new Date().toISOString();
      s._file && fs.writeFileSync(s._file, JSON.stringify(
        (({ _root, _file, ...rest }) => rest)(s), null, 2,
      ));
      count++;
    }
  }
  return count;
}

function createEvolutionCommands(deps) {
  const {
    repoRoot,
    findRepoRoot,
    gadConfig,
    resolveRoots,
    outputError,
    shouldUseJson,
    evolutionPaths,
    resolveProtoSkillInstallRuntimes,
    installProtoSkillToRuntime,
    protoSkillRelativePath,
    writeEvolutionScan,
    readEvolutionScan,
    evolutionImagesCmd,
  } = deps;

  const evolutionValidate = createEvolutionValidateCommand({ repoRoot, evolutionPaths });

  const evolutionInstall = createEvolutionInstallCommand({
    repoRoot,
    evolutionPaths,
    resolveProtoSkillInstallRuntimes,
    installProtoSkillToRuntime,
    protoSkillRelativePath,
  });

  const evolutionPromote = createEvolutionPromoteCommand({ repoRoot, evolutionPaths });

  const evolutionDiscard = createEvolutionDiscardCommand({ repoRoot, evolutionPaths });

  const evolutionStatus = createEvolutionStatusCommand({
    repoRoot,
    evolutionPaths,
    protoSkillRelativePath,
  });
  const evolutionSimilarity = createEvolutionSimilarityCommand({ repoRoot });

  const evolutionScan = createEvolutionScanCommand({
    repoRoot,
    findRepoRoot,
    gadConfig,
    resolveRoots,
    writeEvolutionScan,
    shouldUseJson,
  });

  const evolutionShed = createEvolutionShedCommand({
    repoRoot,
    findRepoRoot,
    gadConfig,
    resolveRoots,
    readEvolutionScan,
    writeEvolutionScan,
    outputError,
    shouldUseJson,
  });

  // gad evolution level-up — project evolution scope (phase 126)
  const evolutionLevelUp = defineCommand({
    meta: {
      name: 'level-up',
      description: 'Advance project evolution level if XP threshold is met. Forces session reset.',
    },
    args: {
      projectid: { type: 'string', description: 'Target project ID', default: '' },
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
        outputError('level-up requires a single project. Pass --projectid <id>.');
        process.exit(1);
        return;
      }
      const root = roots[0];
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const stateXmlPath = path.join(planDir, 'STATE.xml');
      if (!fs.existsSync(stateXmlPath)) {
        outputError(`STATE.xml not found at ${stateXmlPath}`);
        process.exit(1);
        return;
      }

      const level = readLevelFromStateXml(stateXmlPath);
      if (!level) {
        outputError('Could not read level from STATE.xml');
        process.exit(1);
        return;
      }

      const short = level.xpToNext - level.xp;
      if (level.xp < level.xpToNext) {
        console.log(`${short} xp short of level ${level.value + 1} (need ${level.xpToNext}, have ${level.xp})`);
        process.exit(1);
        return;
      }

      // Stub formula until phase 127: double xp_to_next each level
      const nextLevel = level.value + 1;
      const nextXpToNext = level.xpToNext * 2;
      const newLevel = {
        value: nextLevel,
        xp: 0,
        xpToNext: nextXpToNext,
        loadedSkills: level.loadedSkills,
      };

      writeLevelToStateXml(stateXmlPath, newLevel);

      // Touch last-updated
      try {
        let xml = fs.readFileSync(stateXmlPath, 'utf8');
        const iso = new Date().toISOString();
        if (/<last-updated>/.test(xml)) {
          xml = xml.replace(/<last-updated>[^<]*<\/last-updated>/, `<last-updated>${iso}</last-updated>`);
        } else {
          xml = xml.replace(/<\/state>/, `  <last-updated>${iso}</last-updated>\n</state>`);
        }
        fs.writeFileSync(stateXmlPath, xml);
      } catch { /* non-fatal */ }

      // Close active sessions for this project
      const allRoots = config.roots;
      const sessionsDir = path.join(baseDir, root.path, root.planningDir, 'sessions');
      if (fs.existsSync(sessionsDir)) {
        closeActiveSessions(baseDir, allRoots, root.id);
      }

      console.log(`Leveled up to ${nextLevel}!`);
      console.log(`XP reset. Next level requires ${nextXpToNext} xp.`);
      console.log(`Sessions closed. Run \`gad startup --projectid ${root.id}\` to begin level ${nextLevel}.`);
    },
  });

  const evolutionCmd = defineCommand({
    meta: { name: 'evolution', description: 'Manage GAD evolution proto-skills (validate/promote/discard/status/similarity/images) and project level (level-up)' },
    subCommands: {
      scan: evolutionScan,
      install: evolutionInstall,
      validate: evolutionValidate,
      promote: evolutionPromote,
      discard: evolutionDiscard,
      status: evolutionStatus,
      similarity: evolutionSimilarity,
      shed: evolutionShed,
      images: evolutionImagesCmd,
      'level-up': evolutionLevelUp,
    },
  });

  return { evolutionCmd, evolutionPromote, evolutionInstall };
}

module.exports = { createEvolutionCommands };

// evolution.provides reads ctx.services['evolution-images'].cmd — loader must
// run evolution-images.provides first. Alphabetical default ordering breaks
// this (evolution < evolution-images), so declare the edge explicitly.
module.exports.dependsOn = ['evolution-images'];

module.exports.provides = (ctx) => {
  const built = createEvolutionCommands({
    ...ctx.common,
    evolutionImagesCmd: ctx.services['evolution-images'].cmd,
  });
  return {
    built,
    evolutionPromote: built.evolutionPromote,
    evolutionInstall: built.evolutionInstall,
  };
};

module.exports.register = (ctx) => ({
  evolution: ctx.services.evolution.built.evolutionCmd,
});
