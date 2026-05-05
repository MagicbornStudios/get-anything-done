'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

/**
 * Resolve the proto-skills directory for the given args.
 *
 * Priority:
 *   1. GAD_PROTO_SKILLS_DIR env var (escape hatch for tests / CI)
 *   2. --projectid flag → look up project root via resolveRoots, use
 *      <projectRoot>/.planning/proto-skills/
 *   3. findRepoRoot() → <repoRoot>/.planning/proto-skills/ (CWD-based)
 *   4. Fallback: <gadRepoRoot>/.planning/proto-skills/ (vendor dir — legacy)
 */
function resolveProtoSkillsDir({ args, gadRepoRoot, findRepoRoot, gadConfig, resolveRoots, evolutionPaths }) {
  if (process.env.GAD_PROTO_SKILLS_DIR) {
    return path.resolve(process.env.GAD_PROTO_SKILLS_DIR);
  }
  const baseDir = findRepoRoot();
  if (args.projectid) {
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
    if (roots.length > 0) {
      const projectRoot = path.resolve(baseDir, roots[0].path || '.');
      return path.join(projectRoot, '.planning', 'proto-skills');
    }
  }
  // CWD-based repo root (covers monorepo invocations)
  if (baseDir && baseDir !== gadRepoRoot) {
    return path.join(baseDir, '.planning', 'proto-skills');
  }
  // Fallback: GAD vendor directory's own proto-skills (framework-internal)
  return evolutionPaths(gadRepoRoot).protoSkillsDir;
}

function createEvolutionInstallCommand({
  repoRoot,
  evolutionPaths,
  resolveProtoSkillInstallRuntimes,
  installProtoSkillToRuntime,
  protoSkillRelativePath,
  findRepoRoot,
  gadConfig,
  resolveRoots,
}) {
  return defineCommand({
    meta: { name: 'install', description: 'Install a staged proto-skill into one or more coding-agent runtimes without promoting it' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug', required: true },
      projectid: { type: 'string', description: 'Project ID — resolves proto-skills from that project root', default: '' },
      claude: { type: 'boolean' },
      codex: { type: 'boolean' },
      cursor: { type: 'boolean' },
      windsurf: { type: 'boolean' },
      augment: { type: 'boolean' },
      copilot: { type: 'boolean' },
      antigravity: { type: 'boolean' },
      all: { type: 'boolean' },
      global: { type: 'boolean' },
      local: { type: 'boolean' },
      'config-dir': { type: 'string', description: 'Custom runtime config directory', default: '' },
    },
    run({ args }) {
      if (args.global && args.local) {
        console.error('Choose either --global or --local for proto-skill install, not both.');
        process.exit(1);
      }
      const protoSkillsDir = resolveProtoSkillsDir({
        args,
        gadRepoRoot: repoRoot,
        findRepoRoot,
        gadConfig,
        resolveRoots,
        evolutionPaths,
      });
      const protoDir = path.join(protoSkillsDir, args.slug);
      const skillPath = path.join(protoDir, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        console.error(`No proto-skill found at ${skillPath}`);
        process.exit(1);
      }
      const runtimes = resolveProtoSkillInstallRuntimes(args);
      const installMode = args.global ? 'global' : 'local';
      console.log(`Installing proto-skill ${args.slug} from ${path.relative(process.cwd(), protoDir)}/`);
      console.log(`  mode: ${installMode}`);
      for (const runtime of runtimes) {
        const result = installProtoSkillToRuntime(protoDir, args.slug, runtime, {
          global: Boolean(args.global),
          configDir: args['config-dir'] || '',
        });
        console.log(`  ${runtime}: ${result.nativeDir}`);
        console.log(`           ${result.mirrorDir}`);
      }
      console.log('');
      console.log('Proto-skill remains staged in .planning until you promote or discard it.');
    },
  });
}

module.exports = { createEvolutionInstallCommand, resolveProtoSkillsDir };
