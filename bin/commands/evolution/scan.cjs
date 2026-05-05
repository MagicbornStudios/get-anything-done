'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { defineCommand } = require('citty');

function createEvolutionScanCommand({
  repoRoot,
  findRepoRoot,
  gadConfig,
  resolveRoots,
  writeEvolutionScan,
  shouldUseJson,
  installProtoSkillToRuntime,
  resolveProtoSkillInstallRuntimes,
}) {
  const evolutionScan = defineCommand({
    meta: { name: 'scan', description: 'Run the lightweight evolution scan and write .planning/.evolution-scan.json' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
      'no-auto-install': { type: 'boolean', description: 'Skip automatic proto-skill install after scan', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) return;
      const root = roots[0];
      const { scan, filePath } = writeEvolutionScan(root, baseDir, repoRoot);
      const payload = {
        project: root.id,
        file: path.relative(baseDir, filePath),
        candidateCount: scan.candidates.length,
        shedCount: scan.shedCandidates.length,
        scan,
      };
      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log(`Evolution scan: ${payload.candidateCount} candidate(s), ${payload.shedCount} shed candidate(s) -> ${payload.file}`);
      }

      // Auto-install proto-skills found in project-root .planning/proto-skills/
      // after the scan completes. Bypass with --no-auto-install.
      if (args['no-auto-install']) return;
      const projectRoot = path.resolve(baseDir, root.path || '.');
      const protoSkillsDir = path.join(projectRoot, '.planning', 'proto-skills');
      if (!fs.existsSync(protoSkillsDir)) return;

      const slugs = fs.readdirSync(protoSkillsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(protoSkillsDir, entry.name, 'SKILL.md')))
        .map((entry) => entry.name);

      if (slugs.length === 0) return;

      // Use --all (all supported runtimes) in local mode.
      const installArgs = { all: true };
      let runtimes;
      try {
        runtimes = resolveProtoSkillInstallRuntimes(installArgs);
      } catch {
        runtimes = ['claude'];
      }

      const installed = [];
      const errors = [];
      for (const slug of slugs) {
        const protoDir = path.join(protoSkillsDir, slug);
        for (const runtime of runtimes) {
          try {
            installProtoSkillToRuntime(protoDir, slug, runtime, { global: false });
            installed.push(`${slug} -> ${runtime}`);
          } catch (err) {
            errors.push(`${slug}/${runtime}: ${err.message}`);
          }
        }
      }

      if (!args.json && !shouldUseJson()) {
        if (installed.length > 0) {
          console.log(`Auto-installed ${slugs.length} proto-skill(s) to ${runtimes.length} runtime(s):`);
          for (const entry of installed) console.log(`  ${entry}`);
        }
        if (errors.length > 0) {
          console.error(`Auto-install errors (${errors.length}):`);
          for (const e of errors) console.error(`  ${e}`);
        }
      }
    },
  });
  return evolutionScan;
}

module.exports = { createEvolutionScanCommand };