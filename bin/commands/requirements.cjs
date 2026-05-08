'use strict';
/**
 * gad requirements — distill / verify / drift / audit-closure subcommands.
 *
 * Phase 115 (2026-05-07, sonnet-requirements).
 *
 * Subcommands:
 *   gad requirements distill   [--projectid X] [--out PATH]
 *   gad requirements verify    [--projectid X] [--json]
 *   gad requirements drift     [--projectid X] [--json]
 *   gad requirements audit-closure [--projectid X] [--json]
 *
 * Library:
 *   lib/requirements/index.cjs        — distillRequirements / verifyRequirements / driftPercentage
 *   lib/requirements/closure-audit.cjs — auditPhaseClosure
 *
 * Required deps (from common):
 *   findRepoRoot, gadConfig, resolveRoots, outputError, render, shouldUseJson
 */

const path = require('path');
const { defineCommand } = require('citty');
const {
  distillRequirements,
  verifyRequirements,
  driftPercentage,
} = require('../../lib/requirements/index.cjs');
const { auditPhaseClosure } = require('../../lib/requirements/closure-audit.cjs');

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createRequirementsCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError, render, shouldUseJson } = deps;

  // -------------------------------------------------------------------------
  // distill
  // -------------------------------------------------------------------------
  const distillCmd = defineCommand({
    meta: { name: 'distill', description: 'Distill requirements from planning artifacts + source heuristics. Writes <planningDir>/requirements.md.' },
    args: {
      projectid: { type: 'string', description: 'Project id (uses active session if omitted)', default: '' },
      out:       { type: 'string', description: 'Override output path (default: <planningDir>/requirements.md)', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config  = gadConfig.load(baseDir);
      const roots   = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or run from a project root.');
        return;
      }
      if (roots.length > 1) {
        outputError('requirements distill requires a single project. Pass --projectid <id>.');
        return;
      }
      const root = roots[0];
      const projectRoot = path.resolve(baseDir, root.path || '.');
      const planningDir = path.resolve(projectRoot, root.planningDir || '.planning');

      const outPath = distillRequirements({
        projectRoot,
        projectid: root.id,
        planningDir,
      });

      const finalPath = args.out ? (() => {
        // If --out given, copy/move to that path
        const fs = require('fs');
        const dest = path.resolve(args.out);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(outPath, dest);
        return dest;
      })() : outPath;

      console.log(`Requirements distilled to: ${finalPath}`);
    },
  });

  // -------------------------------------------------------------------------
  // verify
  // -------------------------------------------------------------------------
  const verifyCmd = defineCommand({
    meta: { name: 'verify', description: 'Verify each requirement in requirements.md against the codebase. Returns met|partial|missing per bullet.' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      json:      { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config  = gadConfig.load(baseDir);
      const roots   = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or run from a project root.');
        return;
      }
      if (roots.length > 1) {
        outputError('requirements verify requires a single project. Pass --projectid <id>.');
        return;
      }
      const root = roots[0];
      const projectRoot = path.resolve(baseDir, root.path || '.');
      const planningDir = path.resolve(projectRoot, root.planningDir || '.planning');

      const results = verifyRequirements({ projectRoot, planningDir });
      const drift   = driftPercentage(results);

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify({ drift, results }, null, 2));
        return;
      }

      // Table output
      const rows = results.map(r => ({
        section:     r.section,
        verdict:     r.verdict,
        requirement: r.requirement.length > 70 ? r.requirement.slice(0, 67) + '…' : r.requirement,
        evidence:    r.evidence.slice(0, 2).join('; '),
      }));

      if (rows.length === 0) {
        console.log('No requirements found. Run: gad requirements distill');
        return;
      }

      console.log(render(rows, { format: 'table', title: `Requirements Verify (${results.length})` }));
      console.log(`\nDrift: ${drift}%  (missing + 0.5*partial / total)`);
    },
  });

  // -------------------------------------------------------------------------
  // drift
  // -------------------------------------------------------------------------
  const driftCmd = defineCommand({
    meta: { name: 'drift', description: 'Print drift percentage for the project. 0% = all requirements met.' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      json:      { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config  = gadConfig.load(baseDir);
      const roots   = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or run from a project root.');
        return;
      }
      if (roots.length > 1) {
        outputError('requirements drift requires a single project. Pass --projectid <id>.');
        return;
      }
      const root = roots[0];
      const projectRoot = path.resolve(baseDir, root.path || '.');
      const planningDir = path.resolve(projectRoot, root.planningDir || '.planning');

      const results = verifyRequirements({ projectRoot, planningDir });
      const drift   = driftPercentage(results);

      if (args.json || shouldUseJson()) {
        const counts = { met: 0, partial: 0, missing: 0 };
        for (const r of results) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
        console.log(JSON.stringify({ drift, total: results.length, ...counts }, null, 2));
        return;
      }

      console.log(`Drift: ${drift}%  (${results.length} requirements — lower is better)`);
    },
  });

  // -------------------------------------------------------------------------
  // audit-closure
  // -------------------------------------------------------------------------
  const auditClosureCmd = defineCommand({
    meta: { name: 'audit-closure', description: 'Audit phase closure: check done phases for missing file refs, unlinked git commits, and orphan features.' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      json:      { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config  = gadConfig.load(baseDir);
      const roots   = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or run from a project root.');
        return;
      }
      if (roots.length > 1) {
        outputError('requirements audit-closure requires a single project. Pass --projectid <id>.');
        return;
      }
      const root = roots[0];
      const projectRoot = path.resolve(baseDir, root.path || '.');
      const planningDir = path.resolve(projectRoot, root.planningDir || '.planning');

      const results = auditPhaseClosure({ projectRoot, planningDir });

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log('No done phases found in ROADMAP.xml.');
        return;
      }

      // Summary table
      const rows = results.map(r => ({
        phase:   r.phaseId,
        title:   (r.title || '').length > 45 ? r.title.slice(0, 42) + '…' : (r.title || ''),
        status:  r.status,
        tasks:   String(r.taskCount),
        gaps:    String(r.gaps.length),
        orphans: String(r.orphan_features.length),
      }));

      console.log(render(rows, { format: 'table', title: `Phase Closure Audit (${results.length} done phases)` }));

      // Detail for non-ok phases
      for (const r of results) {
        if (r.status === 'ok') continue;
        console.log(`\n── Phase ${r.phaseId} [${r.status}] ──`);
        if (r.gaps.length > 0) {
          console.log('  Gaps:');
          for (const g of r.gaps) console.log(`    - ${g}`);
        }
        if (r.orphan_features.length > 0) {
          console.log('  Orphan files (changed in phase commits but not in any task):');
          for (const o of r.orphan_features.slice(0, 10)) console.log(`    - ${o}`);
        }
      }
    },
  });

  // -------------------------------------------------------------------------
  // Root command
  // -------------------------------------------------------------------------
  return defineCommand({
    meta: { name: 'requirements', description: 'Distill, verify, and drift-check project requirements against the codebase' },
    subCommands: {
      distill:        distillCmd,
      verify:         verifyCmd,
      drift:          driftCmd,
      'audit-closure': auditClosureCmd,
    },
  });
}

module.exports = { createRequirementsCommand };
// Note: top-level 'requirements' command is owned by bin/commands/readers.cjs.
// That file imports createRequirementsCommand from here and merges the distill/
// verify/drift/audit-closure subcommands into the existing requirements family.
// This module does NOT export a register hook to avoid duplicate registration.
