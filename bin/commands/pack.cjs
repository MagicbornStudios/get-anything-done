'use strict';
/**
 * gad pack — bundle all planning data for a project into portable JSON.
 *
 * Required deps:
 *   findRepoRoot, gadConfig, resolveRoots, outputError,
 *   readState, readPhases, readTasks, readDecisions, readRequirements,
 *   readErrors, readBlockers, readDocsMap
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createPackCommand(deps) {
  const {
    findRepoRoot, gadConfig, resolveRoots, outputError,
    readState, readPhases, readTasks, readDecisions, readRequirements,
    readErrors, readBlockers, readDocsMap,
  } = deps;

  return defineCommand({
    meta: { name: 'pack', description: 'Bundle all planning data for a project into a portable JSON pack' },
    args: {
      projectid: { type: 'string', description: 'Project id to pack (default: session or first root)', default: '' },
      output:    { type: 'string', description: 'Output path for pack JSON (default: .planning/pack.json)', default: '' },
      stdout:    { type: 'boolean', description: 'Print pack JSON to stdout instead of writing file', default: false },
      pretty:    { type: 'boolean', description: 'Pretty-print JSON (default true)', default: true },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) { outputError('No project found. Use --projectid or start a session.'); return; }
      if (roots.length > 1) { outputError('pack only supports a single project. Use --projectid to specify one.'); return; }

      const root = roots[0];
      const state   = readState(root, baseDir);
      const phases  = readPhases(root, baseDir);
      const tasks   = readTasks(root, baseDir);
      const decisions = readDecisions(root, baseDir);
      const reqs    = readRequirements(root, baseDir);
      const errors  = readErrors(root, baseDir);
      const blockers = readBlockers(root, baseDir);
      const docsMap = readDocsMap(root, baseDir);

      const docRefs = [];
      for (const d of decisions) for (const ref of d.references) docRefs.push({ source: 'decisions', via: d.id, path: ref });
      for (const r of reqs) if (r.docPath) docRefs.push({ source: 'requirements', via: r.kind, path: r.docPath });
      for (const p of phases) if (p.plans) docRefs.push({ source: 'phases', via: `phase-${p.id}`, path: p.plans });
      for (const d of docsMap) docRefs.push({ source: 'docs-map', via: d.skill || d.kind, path: d.sink });

      const pack = {
        version: 1,
        project: root.id,
        projectPath: root.path,
        planningDir: root.planningDir,
        packedAt: new Date().toISOString(),
        state, phases, tasks, decisions,
        requirements: reqs, errors, blockers, docsMap, docRefs,
      };

      const json = args.pretty ? JSON.stringify(pack, null, 2) : JSON.stringify(pack);

      if (args.stdout) { console.log(json); return; }

      const outPath = args.output
        ? path.resolve(baseDir, args.output)
        : path.join(baseDir, root.path, root.planningDir, 'pack.json');

      fs.writeFileSync(outPath, json, 'utf8');
      console.log(`✓ Pack written: ${path.relative(baseDir, outPath)}`);
      console.log(`  project:   ${root.id}`);
      console.log(`  phases:    ${phases.length}`);
      console.log(`  tasks:     ${tasks.length}`);
      console.log(`  decisions: ${decisions.length}`);
      console.log(`  doc refs:  ${docRefs.length}`);
    },
  });
}

module.exports = { createPackCommand };
module.exports.register = (ctx) => ({ pack: createPackCommand(ctx.common) });
