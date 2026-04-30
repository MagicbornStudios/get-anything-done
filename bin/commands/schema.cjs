'use strict';
/**
 * gad schema — show / diff subcommands.
 *
 * Exposes the canonical GAD project / planning file-tree schema as
 * first-class commands:
 *   gad schema show [--variant <name>] [--json] [--mdx]
 *   gad schema diff [--variant <name>] [path] [--fix]
 *
 * Schema source of truth: vendor/get-anything-done/schemas/{variant}.json
 *
 * Variants: project (default), monorepo, framework
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

const VARIANTS = ['project', 'monorepo', 'framework'];
const SCHEMAS_DIR = path.resolve(__dirname, '../../schemas');

// ---------------------------------------------------------------------------
// Schema loading
// ---------------------------------------------------------------------------

function loadSchema(variant) {
  const schemaPath = path.join(SCHEMAS_DIR, `${variant}.json`);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema not found for variant "${variant}": ${schemaPath}`);
  }
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

// ---------------------------------------------------------------------------
// Tree rendering helpers
// ---------------------------------------------------------------------------

function renderTree(schema) {
  const lines = [];
  lines.push(`Schema: ${schema.name}`);
  lines.push(`${schema.description}`);
  lines.push('');

  if (schema.entries && schema.entries.length > 0) {
    lines.push('Files:');
    for (const e of schema.entries) {
      const req = e.required ? '[required]' : '[optional]';
      lines.push(`  ${e.path}`);
      lines.push(`    role:      ${e.role}`);
      lines.push(`    format:    ${e.format}`);
      lines.push(`    ${req}`);
      if (e.generator) lines.push(`    generator: ${e.generator}`);
    }
    lines.push('');
  }

  if (schema.directories && schema.directories.length > 0) {
    lines.push('Directories:');
    for (const d of schema.directories) {
      lines.push(`  ${d.path}`);
      lines.push(`    role: ${d.role}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function renderMdx(schema) {
  const lines = [];
  lines.push(`# Schema: \`${schema.name}\``);
  lines.push('');
  lines.push(schema.description);
  lines.push('');

  if (schema.entries && schema.entries.length > 0) {
    lines.push('## Files');
    lines.push('');
    lines.push('| Path | Role | Format | Required | Generator |');
    lines.push('|------|------|--------|----------|-----------|');
    for (const e of schema.entries) {
      const req = e.required ? 'yes' : 'no';
      const gen = e.generator || '—';
      lines.push(`| \`${e.path}\` | ${e.role} | \`${e.format}\` | ${req} | \`${gen}\` |`);
    }
    lines.push('');
  }

  if (schema.directories && schema.directories.length > 0) {
    lines.push('## Directories');
    lines.push('');
    lines.push('| Path | Role |');
    lines.push('|------|------|');
    for (const d of schema.directories) {
      lines.push(`| \`${d.path}\` | ${d.role} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

/**
 * Expand a schema entry path (may contain glob-like placeholders like
 * `.planning/phases/<N>-<slug>/`) into a set of canonical path prefixes
 * suitable for fs.existsSync matching.
 *
 * Strategy: if path contains '<' or '*', treat as a pattern — check whether
 * any immediate children of the parent dir match.
 */
function entryExists(basePath, entryPath) {
  // Normalise to forward slashes for comparison
  const ep = entryPath.replace(/\\/g, '/');

  // If the path has no wildcards, just check directly
  if (!ep.includes('<') && !ep.includes('*')) {
    return fs.existsSync(path.join(basePath, ep));
  }

  // Has a pattern — find the last non-pattern segment and check if
  // anything matching exists under it.
  const parts = ep.split('/');
  const firstWild = parts.findIndex(p => p.includes('<') || p.includes('*'));
  const staticPrefix = parts.slice(0, firstWild).join('/');
  const searchDir = path.join(basePath, staticPrefix);
  if (!fs.existsSync(searchDir)) return false;

  // If the parent exists and contains anything, we consider the pattern satisfied.
  try {
    const children = fs.readdirSync(searchDir);
    return children.length > 0;
  } catch {
    return false;
  }
}

function dirExists(basePath, dirPath) {
  const dp = dirPath.replace(/\\/g, '/');
  return fs.existsSync(path.join(basePath, dp));
}

/**
 * Detect format of an existing file.
 * Returns 'xml' | 'json' | 'md' | 'toml' | 'yaml' | 'unknown'
 */
function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.xml': 'xml',
    '.json': 'json',
    '.md': 'md',
    '.mdx': 'md',
    '.toml': 'toml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
  };
  if (map[ext]) return map[ext];
  // Try to read first bytes
  try {
    const head = fs.readFileSync(filePath, 'utf8').slice(0, 100).trimStart();
    if (head.startsWith('<')) return 'xml';
    if (head.startsWith('{') || head.startsWith('[')) return 'json';
    if (head.startsWith('#')) return 'md';
  } catch {}
  return 'unknown';
}

/**
 * Collect all direct children of basePath (files + dirs) that aren't in
 * the schema. Depth = 1 for files, depth = 2 for immediate subdirs.
 *
 * Returns array of { path, type: 'file'|'dir' }
 */
function collectExtras(basePath, schema) {
  const schemaEntryPaths = new Set(
    (schema.entries || [])
      .map(e => e.path.replace(/\\/g, '/'))
      .filter(p => !p.includes('<') && !p.includes('*'))
      .map(p => p.split('/')[0]) // top-level segment only
  );
  const schemaDirPaths = new Set(
    (schema.directories || [])
      .map(d => d.path.replace(/\\/g, '/').replace(/\/$/, ''))
      .map(p => p.split('/')[0]) // top-level segment only
  );

  const knownTopLevel = new Set([...schemaEntryPaths, ...schemaDirPaths]);
  // Also always ignore hidden dirs (gitignored derived state)
  const alwaysIgnore = new Set([
    'node_modules', '.git', 'dist', 'coverage', 'tmp',
    '.gad-log', '.trace-events.jsonl', '.trace-seq',
    '.evolution-scan.json', '.gad-agent-lanes.json', '.eval-runs',
    'sessions', // local-only, never committed
  ]);

  const extras = [];
  let children;
  try {
    children = fs.readdirSync(basePath, { withFileTypes: true });
  } catch {
    return extras;
  }

  for (const child of children) {
    const name = child.name;
    if (alwaysIgnore.has(name)) continue;
    if (knownTopLevel.has(name)) continue;
    if (name.startsWith('.')) continue; // skip hidden files
    extras.push({
      path: name,
      type: child.isDirectory() ? 'dir' : 'file',
    });
  }
  return extras;
}

/**
 * Run diff of a real directory against a schema.
 * Returns { missing, mismatched, extra, total, found }
 */
function runDiff(basePath, schema) {
  const missing = [];
  const mismatched = [];
  const entries = schema.entries || [];
  const dirs = schema.directories || [];

  for (const entry of entries) {
    if (!entryExists(basePath, entry.path)) {
      missing.push({ ...entry, kind: 'entry' });
    } else {
      // Check format mismatch for non-pattern paths
      if (!entry.path.includes('<') && !entry.path.includes('*')) {
        const fullPath = path.join(basePath, entry.path);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          const actual = detectFormat(fullPath);
          const expected = entry.format;
          // Allow pipe-separated format specs like "md|xml"
          const allowedFormats = expected.split('|');
          if (actual !== 'unknown' && !allowedFormats.includes(actual)) {
            mismatched.push({ path: entry.path, expected, actual });
          }
        }
      }
    }
  }

  // Check required dirs exist
  for (const dir of dirs) {
    if (!dirExists(basePath, dir.path)) {
      // Only flag as missing if it's a direct child (no nested pattern)
      const dp = dir.path.replace(/\\/g, '/').replace(/\/$/, '');
      if (!dp.includes('/') || dp.split('/').length <= 2) {
        missing.push({ path: dir.path, role: dir.role, kind: 'dir', required: false });
      }
    }
  }

  const extra = collectExtras(basePath, schema);

  const requiredEntries = entries.filter(e => e.required);
  const found = requiredEntries.filter(e => entryExists(basePath, e.path)).length;
  const total = requiredEntries.length;

  return { missing, mismatched, extra, total, found };
}

function scoreDiff(diff) {
  if (diff.total === 0) return 100;
  return Math.round((diff.found / diff.total) * 100);
}

// ---------------------------------------------------------------------------
// Scaffold helper (--fix)
// ---------------------------------------------------------------------------

const MINIMAL_TEMPLATES = {
  '.planning/DECISIONS.xml': `<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <!-- gad decisions add <id> --summary "..." --projectid <id> -->
</decisions>
`,
  '.planning/ERRORS-AND-ATTEMPTS.xml': `<?xml version="1.0" encoding="UTF-8"?>
<errors>
  <!-- gad errors add <id> --summary "..." --projectid <id> -->
</errors>
`,
  '.planning/STATE.xml': `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <next-action></next-action>
  <state-log></state-log>
</state>
`,
  '.planning/ROADMAP.xml': `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <!-- phases go here -->
</roadmap>
`,
};

function scaffoldMissing(basePath, missing) {
  const created = [];
  const skipped = [];

  for (const entry of missing) {
    if (entry.kind !== 'entry') continue; // skip dirs
    if (entry.path.includes('<') || entry.path.includes('*')) continue;

    const fullPath = path.join(basePath, entry.path);
    if (fs.existsSync(fullPath)) {
      skipped.push(entry.path);
      continue;
    }

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const template = MINIMAL_TEMPLATES[entry.path.replace(/\\/g, '/')];
    if (template) {
      fs.writeFileSync(fullPath, template, 'utf8');
      created.push(entry.path);
    } else if (entry.format === 'md') {
      fs.writeFileSync(fullPath, `# ${path.basename(entry.path, '.md')}\n\n${entry.role}\n`, 'utf8');
      created.push(entry.path);
    } else if (entry.format === 'json') {
      fs.writeFileSync(fullPath, '{}', 'utf8');
      created.push(entry.path);
    } else {
      skipped.push(entry.path + ' (no template, create manually)');
    }
  }

  return { created, skipped };
}

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

function createSchemaCommand(deps) {
  // deps not used by schema commands (all self-contained), but kept for
  // factory-pattern consistency per CLAUDE.md modular-commands spec.
  void deps;

  // -------------------------------------------------------------------------
  // gad schema show
  // -------------------------------------------------------------------------
  const schemaShowCmd = defineCommand({
    meta: { name: 'show', description: 'Print the canonical schema for a GAD project variant' },
    args: {
      variant: {
        type: 'string',
        description: `Schema variant: ${VARIANTS.join(', ')}`,
        default: 'project',
      },
      json: { type: 'boolean', description: 'Machine-readable JSON output', default: false },
      mdx: { type: 'boolean', description: 'MDX doc output', default: false },
    },
    run({ args }) {
      const variant = args.variant || 'project';
      if (!VARIANTS.includes(variant)) {
        console.error(`Error: unknown variant "${variant}". Valid: ${VARIANTS.join(', ')}`);
        process.exit(1);
      }

      let schema;
      try {
        schema = loadSchema(variant);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }

      if (args.json) {
        console.log(JSON.stringify(schema, null, 2));
      } else if (args.mdx) {
        console.log(renderMdx(schema));
      } else {
        console.log(renderTree(schema));
      }
    },
  });

  // -------------------------------------------------------------------------
  // gad schema diff
  // -------------------------------------------------------------------------
  const schemaDiffCmd = defineCommand({
    meta: { name: 'diff', description: 'Compare a directory to the canonical schema and report gaps' },
    args: {
      variant: {
        type: 'string',
        description: `Schema variant: ${VARIANTS.join(', ')}`,
        default: 'project',
      },
      path: {
        type: 'positional',
        description: 'Directory to compare (default: cwd)',
        required: false,
        default: '',
      },
      fix: {
        type: 'boolean',
        description: 'Scaffold missing required entries that have templates',
        default: false,
      },
      json: { type: 'boolean', description: 'Machine-readable JSON output', default: false },
    },
    run({ args }) {
      const variant = args.variant || 'project';
      if (!VARIANTS.includes(variant)) {
        console.error(`Error: unknown variant "${variant}". Valid: ${VARIANTS.join(', ')}`);
        process.exit(1);
      }

      const targetPath = args.path ? path.resolve(args.path) : process.cwd();
      if (!fs.existsSync(targetPath)) {
        console.error(`Error: path not found: ${targetPath}`);
        process.exit(1);
      }

      let schema;
      try {
        schema = loadSchema(variant);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }

      const diff = runDiff(targetPath, schema);
      const score = scoreDiff(diff);

      const missingRequired = diff.missing.filter(m => m.required !== false && m.kind === 'entry');
      const missingOptional = diff.missing.filter(m => m.required === false || m.kind === 'dir');

      if (args.json) {
        console.log(JSON.stringify({
          path: targetPath,
          variant,
          score,
          found: diff.found,
          total: diff.total,
          missing_required: missingRequired,
          missing_optional: missingOptional,
          mismatched: diff.mismatched,
          extra: diff.extra,
        }, null, 2));
        return;
      }

      // Human-readable output
      console.log(`\nSchema diff: variant=${variant}`);
      console.log(`Path: ${targetPath}`);
      console.log(`Match: ${score}% (${diff.found}/${diff.total} required entries present)\n`);

      if (missingRequired.length > 0) {
        console.log(`Missing required (${missingRequired.length}):`);
        for (const m of missingRequired) {
          console.log(`  MISSING  ${m.path}`);
          console.log(`           role: ${m.role}`);
          if (m.generator) console.log(`           generate: ${m.generator}`);
        }
        console.log('');
      }

      if (missingOptional.length > 0) {
        console.log(`Missing optional / directories (${missingOptional.length}):`);
        for (const m of missingOptional) {
          console.log(`  absent   ${m.path}  — ${m.role || ''}`);
        }
        console.log('');
      }

      if (diff.mismatched.length > 0) {
        console.log(`Format mismatches (${diff.mismatched.length}):`);
        for (const mm of diff.mismatched) {
          console.log(`  MISMATCH ${mm.path}  expected=${mm.expected} actual=${mm.actual}`);
        }
        console.log('');
      }

      if (diff.extra.length > 0) {
        console.log(`Extra (not in schema) (${diff.extra.length}):`);
        for (const ex of diff.extra) {
          console.log(`  extra    ${ex.path}  [${ex.type}]  — extend schema? or remove?`);
        }
        console.log('');
      }

      console.log(`Summary: ${targetPath} matches schema variant=${variant}: ${score}% (${missingRequired.length} missing required, ${diff.extra.length} extra)\n`);

      if (args.fix) {
        console.log('Running --fix: scaffolding missing entries with templates...');
        const result = scaffoldMissing(targetPath, diff.missing);
        if (result.created.length > 0) {
          console.log(`  Created: ${result.created.join(', ')}`);
        }
        if (result.skipped.length > 0) {
          console.log(`  Skipped (no template or already exists): ${result.skipped.join(', ')}`);
        }
        console.log('');
      }
    },
  });

  // -------------------------------------------------------------------------
  // gad schema (root — help + subcommands)
  // -------------------------------------------------------------------------
  return defineCommand({
    meta: { name: 'schema', description: 'Show or diff the canonical GAD planning file-tree schema' },
    subCommands: {
      show: schemaShowCmd,
      diff: schemaDiffCmd,
    },
  });
}

// ---------------------------------------------------------------------------
// Loader contract
// ---------------------------------------------------------------------------

function register(ctx) {
  const schemaCmd = createSchemaCommand(ctx.common);
  return { schema: schemaCmd };
}

module.exports = { createSchemaCommand, register };
