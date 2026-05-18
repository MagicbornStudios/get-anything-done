'use strict';
/**
 * gad datasets export — extract .planning/ content into typed JSONL datasets.
 *
 * Phase 244 scaffold landed decisions + tasks real. Phase 244-03 made all 7 raw
 * extractors real (errors, phases, notes w/ PII scrub, state-log, commits).
 * Phase 244-04 wires derived datasets via --derived flag (dpo, sft, intent).
 *
 * Schema and CLI surface spec:
 *   .planning/research/2026-05-18-planning-to-datasets-architecture.md
 *
 * Wired into the `datasets` family by bin/commands/datasets.cjs.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { defineCommand } = require('citty');

const {
  extractDecisions,
  extractTasks,
  extractErrors,
  extractPhases,
  extractNotes,
  extractStateLog,
  extractCommits,
  deriveDpoPairs,
  deriveSftPairs,
  deriveIntentClassification,
  writeJsonl,
  SCHEMA_VERSION,
} = require('../../../lib/datasets/extract.cjs');

const DEFAULT_INCLUDE = 'decisions,tasks,errors,phases,notes,state-log,commits';

// Map dataset name → { extractor, isStubbed }. Phase 244-03 flipped the
// remaining 5 to real.
const EXTRACTORS = {
  'decisions':    { fn: extractDecisions,   stubbed: false },
  'tasks':        { fn: extractTasks,       stubbed: false },
  'errors':       { fn: extractErrors,      stubbed: false },
  'phases':       { fn: extractPhases,      stubbed: false },
  'notes':        { fn: extractNotes,       stubbed: false },
  'state-log':    { fn: extractStateLog,    stubbed: false },
  'commits':      { fn: extractCommits,     stubbed: false },
};

// Derived dataset name → derivation fn(extractedDir).
const DERIVED = {
  'dpo':    { fn: deriveDpoPairs,             filename: 'dpo-pairs.jsonl' },
  'sft':    { fn: deriveSftPairs,             filename: 'sft-pairs.jsonl' },
  'intent': { fn: deriveIntentClassification, filename: 'intent-classification.jsonl' },
};

function resolveProjectRoot(deps, projectid) {
  const { findRepoRoot, gadConfig, resolveRoots } = deps;
  const repoRoot = findRepoRoot();
  const config = gadConfig.load(repoRoot);
  const roots = resolveRoots({ projectid }, repoRoot, config.roots || []);
  const root = roots[0];
  if (!root) return repoRoot;
  return path.join(repoRoot, root.path);
}

function defaultOutDir(projectid) {
  // %APPDATA%/gad-desk/datasets/<projectid>/  (Windows-first)
  // ~/.gad-desk/datasets/<projectid>/         (POSIX fallback)
  const appdata = process.env.APPDATA || path.join(os.homedir(), '.gad-desk');
  const base = process.env.APPDATA ? path.join(appdata, 'gad-desk') : appdata;
  return path.join(base, 'datasets', projectid);
}

function createExportCommand(deps) {
  return defineCommand({
    meta: {
      name: 'export',
      description: 'Extract .planning/ content into typed JSONL datasets. All 7 raw extractors real; --derived enables synthesized training datasets.',
    },
    args: {
      projectid: { type: 'string',  description: 'Project id (required)', default: '' },
      out:       { type: 'string',  description: 'Output directory (default: %APPDATA%/gad-desk/datasets/<projectid>/)', default: '' },
      include:   { type: 'string',  description: 'Comma-separated dataset list', default: DEFAULT_INCLUDE },
      derived:   { type: 'string',  description: 'Comma-separated derived datasets (dpo,sft,intent). Default: none.', default: '' },
      json:      { type: 'boolean', description: 'Emit manifest JSON', default: false },
    },
    async run({ args }) {
      const projectid = String(args.projectid || '').trim();
      if (!projectid) {
        console.error('error: --projectid is required');
        process.exit(1);
        return;
      }

      let projectRoot;
      try { projectRoot = resolveProjectRoot(deps, projectid); }
      catch (e) {
        console.error(`error: could not resolve project root for ${projectid}: ${e.message}`);
        process.exit(1);
        return;
      }

      const outDir = args.out
        ? path.resolve(args.out)
        : defaultOutDir(projectid);
      const rawDir = path.join(outDir, 'raw');
      fs.mkdirSync(rawDir, { recursive: true });

      const include = String(args.include || DEFAULT_INCLUDE)
        .split(',').map((s) => s.trim()).filter(Boolean);
      const derivedList = String(args.derived || '')
        .split(',').map((s) => s.trim()).filter(Boolean);

      const manifest = {
        project_id: projectid,
        project_root: projectRoot,
        out_dir: outDir,
        extracted_at: new Date().toISOString(),
        schema_version: SCHEMA_VERSION,
        datasets: {},
        derived: {},
      };

      for (const name of include) {
        const spec = EXTRACTORS[name];
        if (!spec) {
          console.error(`warning: unknown dataset "${name}", skipping`);
          continue;
        }
        const rows = spec.fn(projectRoot, projectid);
        const filename = `${name}.jsonl`;
        const outPath = path.join(rawDir, filename);
        const written = writeJsonl(rows, outPath);

        manifest.datasets[name] = {
          path: path.relative(outDir, outPath).replace(/\\/g, '/'),
          row_count: written.rowCount,
          stubbed: spec.stubbed,
        };

        // Clean up any stale .todo marker from previous-scaffold runs.
        const todoPath = `${outPath}.todo`;
        if (!spec.stubbed && fs.existsSync(todoPath)) {
          try { fs.unlinkSync(todoPath); } catch (_) {}
        }
        if (spec.stubbed) {
          fs.writeFileSync(`${outPath}.todo`,
            `TODO: real ${name} extractor not yet implemented.\n` +
            `See .planning/research/2026-05-18-planning-to-datasets-architecture.md §1.2.\n`);
        }
      }

      // ── derived ──────────────────────────────────────────────────────────────
      if (derivedList.length > 0) {
        const derivedDir = path.join(outDir, 'derived');
        fs.mkdirSync(derivedDir, { recursive: true });
        for (const name of derivedList) {
          const spec = DERIVED[name];
          if (!spec) {
            console.error(`warning: unknown derived dataset "${name}", skipping`);
            continue;
          }
          const rows = spec.fn(outDir);
          const outPath = path.join(derivedDir, spec.filename);
          const written = writeJsonl(rows, outPath);
          manifest.derived[name] = {
            path: path.relative(outDir, outPath).replace(/\\/g, '/'),
            row_count: written.rowCount,
          };
        }
      }

      const manifestPath = path.join(outDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

      if (args.json) {
        process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
        return;
      }

      console.log(`\ngad datasets export — projectid=${projectid}`);
      console.log(`source : ${projectRoot}`);
      console.log(`out    : ${outDir}`);
      console.log('');
      console.log('dataset            rows    status');
      console.log('-----------------  ------  ------');
      for (const [name, info] of Object.entries(manifest.datasets)) {
        const status = info.stubbed ? 'stub' : 'real';
        console.log(`${name.padEnd(17)}  ${String(info.row_count).padStart(6)}  ${status}`);
      }
      if (Object.keys(manifest.derived).length > 0) {
        console.log('');
        console.log('derived            rows');
        console.log('-----------------  ------');
        for (const [name, info] of Object.entries(manifest.derived)) {
          console.log(`${name.padEnd(17)}  ${String(info.row_count).padStart(6)}`);
        }
      }
      console.log('');
      console.log(`manifest: ${manifestPath}`);
    },
  });
}

module.exports = { createExportCommand };
