'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_INIT_TEMPLATE_DIR = path.join(__dirname, '..', '..', '..', 'templates', 'project-init');

// SOUL.md is intentionally NOT in this list. `gad projects init` should not
// drop a dead soul pointer into every consumer repo — without a matching
// narrative body it reads as a junk file to outside reviewers. Souls are
// now opt-in via `gad souls init`, which writes both SOUL.md and the
// matching narrative/souls/<id>.md body in one shot.
const PROJECT_INIT_TARGETS = [
  { template: 'AGENTS.md', relativePath: 'AGENTS.md' },
  { template: 'planning-AGENTS.md', relativePath: path.join('.planning', 'AGENTS.md') },
];

// Per-runtime entrypoint files. `gad projects init --runtime <name>` writes
// the entrypoint(s) for the selected runtime(s) on top of the base targets
// above. Default is `claude` — the most-used runtime today and the one
// with a dedicated template body. Other runtimes get a thin generated
// pointer back to AGENTS.md. `none` writes no entrypoint at all.
//
// To use multiple runtimes pass --runtime "claude,gemini".
const RUNTIME_ENTRYPOINTS = {
  claude: { relativePath: 'CLAUDE.md', template: 'CLAUDE.md' },
  cursor: { relativePath: '.cursorrules', generator: 'cursor' },
  gemini: { relativePath: 'GEMINI.md', generator: 'gemini' },
  opencode: { relativePath: path.join('.opencode', 'AGENTS.md'), generator: 'opencode' },
  codex: null, // codex reads AGENTS.md directly; no extra entrypoint
  none: null,
};

const DEFAULT_RUNTIMES = ['claude'];

function parseRuntimesArg(value) {
  // Accept comma-separated, whitespace-tolerant. Empty / undefined → default.
  if (!value) return DEFAULT_RUNTIMES.slice();
  const parts = String(value)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return DEFAULT_RUNTIMES.slice();
  const unknown = parts.filter((p) => !(p in RUNTIME_ENTRYPOINTS));
  if (unknown.length > 0) {
    const known = Object.keys(RUNTIME_ENTRYPOINTS).join(', ');
    throw new Error(`Unknown runtime(s): ${unknown.join(', ')}. Known: ${known}`);
  }
  return parts;
}

function renderProjectInitTemplate(templateBody, vars) {
  return templateBody.replace(/\{\{\s*(project_id|project_name|project_upper|project_intent)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });
}

function loadProjectInitTemplate(templateName) {
  const templatePath = path.join(PROJECT_INIT_TEMPLATE_DIR, templateName);
  return fs.readFileSync(templatePath, 'utf8');
}

// Thin generated entrypoint for runtimes that don't have a dedicated
// template file. The body is intentionally minimal: read AGENTS.md, then
// add only runtime-specific addenda. This avoids duplicating the source
// contract into every entrypoint (and the drift that follows).
function generateRuntimeEntrypoint(runtime, vars) {
  const lines = [
    `# ${vars.project_name}`,
    '',
    `${labelForRuntime(runtime)} entrypoint. The source contract is \`AGENTS.md\` at the repo root — read it first.`,
    '',
    '```',
    'Read: ./AGENTS.md',
    '```',
    '',
    `## ${labelForRuntime(runtime)}-only notes`,
    '',
    '- Project id: `' + vars.project_id + '`',
    '- Run `gad snapshot --projectid ' + vars.project_id + '` at session start.',
    '- Stamp completed work via `gad tasks stamp <id> --projectid ' + vars.project_id + ` --runtime ${runtime} --agent <agent> --status done\`.`,
    '',
  ];
  return lines.join('\n');
}

function labelForRuntime(runtime) {
  switch (runtime) {
    case 'claude': return 'Claude Code';
    case 'cursor': return 'Cursor';
    case 'gemini': return 'Gemini CLI';
    case 'opencode': return 'opencode';
    case 'codex': return 'Codex';
    default: return runtime;
  }
}

function fallbackInitPath(targetPath) {
  return path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.gad-init`);
}

function scaffoldProjectInitInstructions(projectPath, vars, options = {}) {
  const runtimes = options.runtimes && options.runtimes.length
    ? options.runtimes
    : DEFAULT_RUNTIMES.slice();

  // Base targets — AGENTS.md and .planning/AGENTS.md — are always written.
  const targets = PROJECT_INIT_TARGETS.slice();

  // Per-runtime entrypoints layered on top.
  const runtimeSpecs = [];
  for (const rt of runtimes) {
    if (!(rt in RUNTIME_ENTRYPOINTS)) continue;
    const spec = RUNTIME_ENTRYPOINTS[rt];
    if (!spec) continue; // codex / none — no entrypoint
    if (spec.template) {
      targets.push({
        template: spec.template,
        relativePath: spec.relativePath,
      });
    } else if (spec.generator) {
      runtimeSpecs.push({ runtime: rt, relativePath: spec.relativePath });
    }
  }

  const results = [];

  for (const spec of targets) {
    const targetPath = path.join(projectPath, spec.relativePath);
    const rendered = renderProjectInitTemplate(loadProjectInitTemplate(spec.template), vars);
    results.push(writeOrFallback(targetPath, rendered, spec.template));
  }

  for (const rs of runtimeSpecs) {
    const targetPath = path.join(projectPath, rs.relativePath);
    const rendered = generateRuntimeEntrypoint(rs.runtime, vars);
    results.push(writeOrFallback(targetPath, rendered, `<${rs.runtime}-entrypoint>`));
  }

  return results;
}

function writeOrFallback(targetPath, rendered, templateLabel) {
  const exists = fs.existsSync(targetPath);
  const outputPath = exists ? fallbackInitPath(targetPath) : targetPath;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered);
  return {
    template: templateLabel,
    targetPath,
    outputPath,
    existed: exists,
    compareHint: exists
      ? `Compare ${path.basename(targetPath)} with ${path.basename(outputPath)} before merging.`
      : '',
  };
}

module.exports = {
  PROJECT_INIT_TARGETS,
  RUNTIME_ENTRYPOINTS,
  DEFAULT_RUNTIMES,
  parseRuntimesArg,
  renderProjectInitTemplate,
  scaffoldProjectInitInstructions,
};
