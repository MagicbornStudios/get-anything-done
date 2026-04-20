'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createProjectsAuditCommand(deps) {
  const {
    findRepoRoot,
    gadConfig,
    output,
    shouldUseJson,
    computeCanonicalShape,
    REQUIRED_FILES_BY_FORMAT,
    RECOMMENDED_FILES,
  } = deps;

  return defineCommand({
    meta: { name: 'audit', description: 'Audit all projects for missing files, format violations, and sink gaps' },
    args: {
      project: { type: 'string', description: 'Scope to one project ID', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const sink = config.docs_sink;
      let roots = config.roots;
      if (args.project) roots = roots.filter((root) => root.id === args.project);

      const { isGenerated } = require('../../../lib/docs-compiler.cjs');
      const results = [];

      for (const root of roots) {
        const planDir = path.join(baseDir, root.path, root.planningDir);
        const checks = [];

        const dirExists = fs.existsSync(planDir);
        checks.push({ check: 'planning_dir_exists', pass: dirExists, detail: dirExists ? planDir : `missing: ${planDir}` });
        if (!dirExists) {
          results.push({ project: root.id, checks });
          continue;
        }

        const filesPresent = fs.readdirSync(planDir);
        const hasXml = REQUIRED_FILES_BY_FORMAT.xml.every((file) => filesPresent.includes(file));
        const hasMd = REQUIRED_FILES_BY_FORMAT.md.every((file) => filesPresent.includes(file));
        const hasRequired = hasXml || hasMd;
        const detectedFormat = hasXml ? 'xml' : hasMd ? 'md' : 'unknown';
        checks.push({
          check: 'required_files',
          pass: hasRequired,
          detail: hasRequired ? `format=${detectedFormat}` : 'missing STATE+ROADMAP (checked xml and md)',
        });

        const missingRec = RECOMMENDED_FILES.filter((file) => !filesPresent.includes(file));
        const hasRec = missingRec.length < RECOMMENDED_FILES.length;
        checks.push({
          check: 'recommended_files',
          pass: hasRec,
          detail: hasRec ? 'present' : `none of: ${RECOMMENDED_FILES.join(', ')}`,
        });

        if (sink) {
          const sinkPlanDir = path.join(baseDir, sink, root.id, 'planning');
          const sinkExists = fs.existsSync(sinkPlanDir);
          if (!sinkExists) {
            checks.push({ check: 'sink_exists', pass: false, detail: `no sink dir: ${sink}/${root.id}/planning/` });
          } else {
            const sinkFiles = fs.readdirSync(sinkPlanDir).filter((file) => file.endsWith('.mdx'));
            const generatedCount = sinkFiles.filter((file) => isGenerated(path.join(sinkPlanDir, file))).length;
            const humanCount = sinkFiles.length - generatedCount;
            checks.push({
              check: 'sink_exists',
              pass: true,
              detail: `${sinkFiles.length} mdx (${humanCount} human, ${generatedCount} generated)`,
            });

            const stale = [];
            for (const srcName of filesPresent.filter((file) => /\.(xml|md)$/.test(file))) {
              const srcPath = path.join(planDir, srcName);
              const sinkName = srcName.replace(/\.(xml|md)$/, '.mdx').toLowerCase();
              const sinkPath = path.join(sinkPlanDir, sinkName);
              if (fs.existsSync(sinkPath)) {
                const srcMtime = fs.statSync(srcPath).mtimeMs;
                const sinkMtime = fs.statSync(sinkPath).mtimeMs;
                if (srcMtime > sinkMtime && isGenerated(sinkPath)) stale.push(srcName);
              }
            }
            checks.push({
              check: 'sink_fresh',
              pass: stale.length === 0,
              detail: stale.length === 0 ? 'all generated files current' : `stale: ${stale.join(', ')}`,
            });
          }
        }

        const shape = computeCanonicalShape(planDir);
        const minPass = shape.minimumMissing.length === 0;
        checks.push({
          check: 'canonical_minimum',
          pass: minPass,
          detail: minPass
            ? `${shape.minimumPresent.length}/${shape.minimumPresent.length + shape.minimumMissing.length} present`
            : `missing: ${shape.minimumMissing.join(', ')}`,
        });
        checks.push({
          check: 'canonical_optional',
          pass: true,
          detail: shape.optionalPresent.length === 0
            ? 'none present'
            : `present: ${shape.optionalPresent.join(', ')}`,
        });
        checks.push({
          check: 'canonical_legacy',
          pass: shape.legacyPresent.length === 0,
          detail: shape.legacyPresent.length === 0
            ? 'none detected'
            : `legacy: ${shape.legacyPresent.map((entry) => `${entry.name} (${entry.reason})`).join('; ')}`,
        });

        results.push({ project: root.id, format: detectedFormat, checks, shape });
      }

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      const rows = [];
      for (const result of results) {
        for (const check of result.checks) {
          rows.push({
            project: result.project,
            check: check.check,
            pass: check.pass ? '✓' : '✗',
            detail: check.detail,
          });
        }
      }
      output(rows, { title: `Projects Audit (${results.length} projects)` });

      console.log('\n—— Canonical planning-root shape ———————————————————————');
      console.log('Source: references/project-shape.md (decision gad-185)');
      for (const result of results) {
        if (!result.shape) continue;
        const shape = result.shape;
        const status = shape.minimumMissing.length === 0 ? '✓ clean' : `✗ missing ${shape.minimumMissing.length}`;
        console.log(`  ${result.project.padEnd(22)} ${status}`);
        console.log(`    minimum:  ${shape.minimumPresent.length}/${shape.minimumPresent.length + shape.minimumMissing.length} present${shape.minimumMissing.length ? ` — missing: ${shape.minimumMissing.join(', ')}` : ''}`);
        if (shape.optionalPresent.length) {
          console.log(`    optional: ${shape.optionalPresent.join(', ')}`);
        }
        if (shape.legacyPresent.length) {
          console.log(`    legacy:   ${shape.legacyPresent.map((entry) => entry.name).join(', ')}`);
        }
      }

      const failed = results.flatMap((result) => result.checks).filter((check) => !check.pass).length;
      console.log(failed === 0 ? '\n✓ All checks passed.' : `\n${failed} check(s) failed.`);
    },
  });
}

module.exports = { createProjectsAuditCommand };
