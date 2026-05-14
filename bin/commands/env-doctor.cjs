'use strict';
/**
 * gad env doctor — validate a project's env against its gad-env.schema.toml.
 *
 * Phase 206. Sibling of `gad env get/set/list/...` (BYOK secrets); doctor is
 * the SCHEMA-DRIVEN side: it knows which env vars unlock which features and
 * prints a status report so the operator (or Kael) can see at a glance what
 * needs pasting.
 *
 * Usage:
 *   gad env doctor                              # global projectid, terminal output
 *   gad env doctor --projectid <id>             # specific project
 *   gad env doctor --projectid <id> --seed-todos
 *   gad env doctor --json                       # machine-readable, exit 0
 *
 * NOT registered at the top level — exported as a citty subcommand factory,
 * slotted into bin/commands/env.cjs under subCommands.doctor.
 */

const fs = require('node:fs');
const path = require('node:path');
const { defineCommand } = require('citty');

const envDoctor = require('../../lib/env-doctor.cjs');

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const useAnsi = Boolean(process.stdout && process.stdout.isTTY) && !process.env.NO_COLOR;
function ansi(code, text) {
  if (!useAnsi) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}
const green = (t) => ansi('32', t);
const red = (t) => ansi('31', t);
const yellow = (t) => ansi('33', t);
const dim = (t) => ansi('2', t);
const bold = (t) => ansi('1', t);
const cyan = (t) => ansi('36', t);

// ---------------------------------------------------------------------------
// gad-config.toml planning-roots parser (minimal — mirrors apps/platform/lib/projects-data.ts)
// ---------------------------------------------------------------------------

function parsePlanningRoots(tomlText) {
  const out = [];
  const headerRe = /^\[\[?[^\]\n]+\]\]?\s*$/gm;
  const headers = [];
  let m;
  while ((m = headerRe.exec(tomlText)) !== null) {
    headers.push({ index: m.index, text: m[0].trim() });
  }
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h.text !== '[[planning.roots]]') continue;
    const start = h.index + h.text.length;
    const end = i + 1 < headers.length ? headers[i + 1].index : tomlText.length;
    const body = tomlText.slice(start, end);
    const id = matchKey(body, 'id');
    const pth = matchKey(body, 'path');
    const planningDir = matchKey(body, 'planningDir') || '.planning';
    if (!id || !pth) continue;
    out.push({ id, path: pth, planningDir });
  }
  return out;
}

function matchKey(body, key) {
  const re = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm');
  const mm = body.match(re);
  if (!mm) return null;
  const raw = mm[1].trim();
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\\\/g, '\\');
  }
  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1);
  }
  return raw;
}

function loadPlanningRoots(workspaceRoot) {
  const candidates = [
    path.join(workspaceRoot, '.planning', 'gad-config.toml'),
    path.join(workspaceRoot, 'gad-config.toml'),
  ];
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    const text = fs.readFileSync(c, 'utf8');
    for (const r of parsePlanningRoots(text)) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Project resolution
// ---------------------------------------------------------------------------

/** Returns { projectRoot, workspaceRoot, projectid, schemaPath, schemaPathFallback }. */
function resolveProjectPaths(projectid) {
  // workspace root: nearest gad-config.toml ancestor of cwd
  const workspaceRoot = envDoctor.findGadWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    throw new Error(
      `gad env doctor: no gad-config.toml found above ${process.cwd()}. ` +
      `Run from inside a gad workspace.`,
    );
  }
  const roots = loadPlanningRoots(workspaceRoot);
  const id = projectid || 'global';
  const entry = roots.find((r) => r.id === id);
  if (!entry) {
    const known = roots.map((r) => r.id).sort().join(', ') || '<none>';
    throw new Error(
      `gad env doctor: projectid "${id}" not found in gad-config.toml. ` +
      `Known projects: ${known}`,
    );
  }
  const normalized = entry.path.replace(/\\/g, '/');
  const projectRoot =
    path.isAbsolute(normalized) || normalized === '.'
      ? path.resolve(workspaceRoot, normalized)
      : path.join(workspaceRoot, normalized);

  // Schema discovery: <projectRoot>/gad-env.schema.toml first; if absent and
  // projectid is "global" (which maps to .), fall back to apps/platform —
  // that's where the canonical platform schema lives in this monorepo.
  const directSchema = path.join(projectRoot, 'gad-env.schema.toml');
  let schemaRoot = projectRoot;
  let usedFallback = false;
  if (!fs.existsSync(directSchema) && id === 'global') {
    const fallback = path.join(workspaceRoot, 'apps', 'platform');
    if (fs.existsSync(path.join(fallback, 'gad-env.schema.toml'))) {
      schemaRoot = fallback;
      usedFallback = true;
    }
  }
  return {
    projectid: id,
    projectRoot,
    workspaceRoot,
    schemaRoot,
    usedFallback,
  };
}

// ---------------------------------------------------------------------------
// Status assembly + render
// ---------------------------------------------------------------------------

function buildStatus(ctx) {
  const features = envDoctor.listFeatures(ctx.schemaRoot);
  const schema = envDoctor.loadSchema(ctx.schemaRoot);
  const pool = envDoctor.describePoolLocation(ctx.schemaRoot);
  const satisfied = features.filter((f) => f.satisfied).length;
  const missingRequiredVars = new Set();
  for (const f of features) for (const v of f.missingRequired) missingRequiredVars.add(v);
  return {
    projectid: ctx.projectid,
    project_root: ctx.projectRoot,
    workspace_root: ctx.workspaceRoot,
    schema_root: ctx.schemaRoot,
    schema_used_fallback: ctx.usedFallback,
    schema: schema && {
      project: schema.meta.project,
      description: schema.meta.description,
      path: schema.meta.schemaPath,
      feature_count: schema.features.length,
      var_count: Object.keys(schema.vars).length,
    },
    shared_pool: pool,
    features: features.map((fs2) => ({
      key: fs2.feature.key,
      title: fs2.feature.title,
      satisfied: fs2.satisfied,
      required: fs2.feature.required,
      optional: fs2.feature.optional,
      missing_required: fs2.missingRequired,
      missing_optional: fs2.missingOptional,
      unlocks: fs2.feature.unlocks,
      degrades_to: fs2.feature.degrades_to,
      var_statuses: Object.fromEntries(
        Object.entries(fs2.varStatuses).map(([k, v]) => [
          k,
          { source: v.source, has_value: v.source !== 'missing' },
        ]),
      ),
    })),
    summary: {
      features_total: features.length,
      features_satisfied: satisfied,
      missing_required_total: missingRequiredVars.size,
    },
  };
}

function renderTerminal(status) {
  const lines = [];
  lines.push(bold(`GAD env doctor`) + ` ${dim('—')} projectid: ${cyan(status.projectid)}`);
  lines.push(`Workspace root: ${dim(status.workspace_root)}`);
  const pool = status.shared_pool;
  const poolMark = pool.poolExists ? green('✓ found') : red('✗ missing');
  lines.push(`Shared pool:    ${dim(pool.poolPath || '<none>')} (${poolMark})`);
  if (!status.schema) {
    lines.push(`Schema:         ${red('✗ no gad-env.schema.toml')} at ${dim(status.schema_root)}`);
    lines.push('');
    lines.push(red('No schema — nothing to validate. Create gad-env.schema.toml to declare your env contract.'));
    return lines.join('\n');
  }
  const fallbackNote = status.schema_used_fallback ? dim(' (fallback: apps/platform)') : '';
  lines.push(
    `Schema:         ${dim(status.schema.path)} (${status.schema.feature_count} features, ${status.schema.var_count} vars)${fallbackNote}`,
  );
  lines.push('');
  lines.push(bold('Features:'));
  for (const f of status.features) {
    const mark = f.satisfied ? green('✓') : red('✗');
    lines.push(`  ${mark} ${bold(f.key.padEnd(18))} ${f.title}`);
    if (!f.satisfied) {
      lines.push(`    ${red('Missing required:')} ${f.missing_required.join(', ')}`);
      if (f.unlocks) lines.push(`    ${dim('Unlocks:')} ${f.unlocks}`);
      if (f.degrades_to) lines.push(`    ${dim('Degrades to:')} ${f.degrades_to}`);
      const helpUrls = collectHelpUrls(status, f.missing_required);
      for (const url of helpUrls) lines.push(`    ${dim('Get it:')} ${url}`);
    } else if (f.missing_optional && f.missing_optional.length > 0) {
      lines.push(`    ${yellow('Missing optional:')} ${dim(f.missing_optional.join(', '))}`);
    }
  }
  lines.push('');
  const sum = status.summary;
  const ratio = `${sum.features_satisfied}/${sum.features_total}`;
  const tail = sum.missing_required_total === 0
    ? green('all required vars satisfied.')
    : red(`${sum.missing_required_total} required vars missing.`);
  lines.push(`${bold('Summary:')} ${ratio} features satisfied. ${tail}`);
  if (sum.missing_required_total > 0) {
    lines.push('');
    lines.push(dim(`Run with --seed-todos to create operator-todos for missing required vars.`));
  }
  return lines.join('\n');
}

function collectHelpUrls(status, varNames) {
  // We don't pass schema.vars into renderTerminal directly; rebuild a quick
  // lookup from the source schema. Cheap because we only render N missing.
  const cache = collectHelpUrls._cache || (collectHelpUrls._cache = new WeakMap());
  let urls = cache.get(status);
  if (!urls) {
    urls = {};
    // We can't access raw schema here; instead, fetch from the loaded schema
    // again via the resolver. This is cached internally.
    try {
      const schema = envDoctor.loadSchema(status.schema_root);
      if (schema) {
        for (const [name, v] of Object.entries(schema.vars)) {
          if (v.help_url) urls[name] = v.help_url;
        }
      }
    } catch (_) { /* ignore */ }
    cache.set(status, urls);
  }
  const seen = new Set();
  for (const n of varNames) {
    if (urls[n]) seen.add(urls[n]);
  }
  return Array.from(seen);
}

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

function createEnvDoctorCommand() {
  return defineCommand({
    meta: {
      name: 'doctor',
      description: 'Validate project env against gad-env.schema.toml. Prints feature satisfaction, missing required/optional vars, and the layer each value resolved from. --seed-todos creates paste_env_var operator-todos for missing required vars. --json emits machine-readable output for programmatic consumers (CI, gad CLI extensions, Kael tools).',
    },
    args: {
      projectid: {
        type: 'string',
        description: 'Project id (from gad-config.toml [[planning.roots]]). Defaults to "global" (monorepo root).',
        default: 'global',
      },
      'seed-todos': {
        type: 'boolean',
        description: 'Append a paste_env_var operator-todo for every REQUIRED missing var, skipping those already open. Writes to <workspaceRoot>/.planning/datasets/operator-todos/<today>.jsonl.',
        default: false,
      },
      json: {
        type: 'boolean',
        description: 'Emit machine-readable JSON status (mirrors the /api/_diag/health shape) instead of the human-readable terminal report. Exits 0 either way unless --strict is added later.',
        default: false,
      },
    },
    async run({ args }) {
      let ctx;
      try {
        ctx = resolveProjectPaths(args.projectid ? String(args.projectid) : 'global');
      } catch (err) {
        process.stderr.write(`${err && err.message ? err.message : String(err)}\n`);
        process.exit(2);
        return;
      }
      const status = buildStatus(ctx);

      if (args.json) {
        process.stdout.write(JSON.stringify(status, null, 2) + '\n');
      } else {
        process.stdout.write(renderTerminal(status) + '\n');
      }

      if (args['seed-todos']) {
        if (!status.schema) {
          process.stderr.write(red('Cannot seed todos: no schema loaded.\n'));
          process.exit(2);
          return;
        }
        let result;
        try {
          result = envDoctor.seedTodosForMissing(ctx.schemaRoot, { phaseId: '206' });
        } catch (err) {
          process.stderr.write(`Seed failed: ${err && err.message}\n`);
          process.exit(2);
          return;
        }
        if (args.json) {
          process.stdout.write(JSON.stringify({ seed_todos: result }, null, 2) + '\n');
        } else {
          process.stdout.write('\n');
          if (result.created.length > 0) {
            process.stdout.write(
              green(`Created ${result.created.length} todos`) + ` for: ${result.created.join(', ')}\n`,
            );
            process.stdout.write(dim(`File: ${result.filePath}\n`));
          } else {
            process.stdout.write(dim('No new todos created.\n'));
          }
          if (result.skipped.length > 0) {
            process.stdout.write(
              yellow(`Skipped ${result.skipped.length}`) + ` (already open): ${result.skipped.join(', ')}\n`,
            );
          }
        }
      }
    },
  });
}

module.exports = { createEnvDoctorCommand };

// Loader contract: env-doctor.cjs is consumed by env.cjs (slotted as
// `gad env doctor` sub-subcommand). Returning {} from register tells
// bin/commands/_loader.cjs to NOT promote env-doctor to a top-level
// command of its own when the loader falls back to filesystem discovery.
module.exports.register = () => ({});
