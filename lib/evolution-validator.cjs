'use strict';

/**
 * evolution-validator.cjs — advisory checker for proto-skill SKILL.md files.
 *
 * Reads a proto-skill's SKILL.md, extracts file references and `gad <subcommand>`
 * CLI commands cited in the body, then checks each against the actual repo:
 *
 *   - File references: do they exist on disk under the repo root or
 *     vendor/get-anything-done/?
 *   - CLI commands: are they listed in `gad --help` / `gad <subcommand> --help`?
 *
 * Writes a VALIDATION.md alongside the SKILL.md with a table of pass/fail per
 * check. The validator is ADVISORY, not blocking — the human reviewer uses it
 * as a heads-up before promoting or discarding the proto-skill.
 *
 * This is the v1 implementation. JSON shape comparison (e.g. checking that
 * gad.json examples in the skill match real eval projects' gad.json shapes)
 * is deferred until needed.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function safeExec(cmd, cwd) {
  try {
    return execSync(cmd, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
    }).toString('utf8');
  } catch {
    return '';
  }
}

/**
 * Extract file references cited in a SKILL.md body. Looks for path-like strings
 * inside backticks, single quotes, or double quotes — anything containing a
 * forward slash plus a file extension.
 */
function extractFileRefs(body) {
  const refs = new Set();
  // `path/with/slashes.ext` or "path/with/slashes.ext" or 'path/with/slashes.ext'
  const re = /[`"']([\w./@-]+\/[\w./@-]+\.[a-z][a-z0-9]{0,5})[`"']/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    refs.add(m[1]);
  }
  // Also catch backtick-wrapped bare directory references like `evals/escape-the-dungeon/`
  const dirRe = /[`"']([\w./@-]+\/[\w./@-]+\/)[`"']/g;
  while ((m = dirRe.exec(body)) !== null) {
    refs.add(m[1]);
  }
  // Dedup overlapping path prefixes (task 42.2-04). When both a long-form path
  // and its trailing substring appear (e.g. `skills/vcs/SKILL.md` and
  // `vcs/SKILL.md`), keep only the longer. A ref is a "trailing substring" of
  // another when it equals the other with a leading path component stripped.
  const all = [...refs];
  const keep = new Set(all);
  for (const short of all) {
    for (const long of all) {
      if (long === short) continue;
      if (long.length > short.length && long.endsWith('/' + short)) {
        keep.delete(short);
        break;
      }
    }
  }
  return [...keep].sort();
}

/**
 * Extract `gad <subcommand>` CLI commands cited in a SKILL.md body.
 * Captures the first token after `gad ` as the subcommand.
 */
function extractCliCommands(body) {
  const cmds = new Set();
  const re = /\bgad\s+([a-z][a-z-]*)\b/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    if (m[1] !== 'cli') cmds.add(m[1]); // skip "gad cli" mentions
  }
  return [...cmds].sort();
}

/**
 * Discover the set of valid top-level `gad` subcommands by parsing
 * `gad --help` output. Returns a Set of subcommand names.
 */
function discoverGadCommands(repoRoot) {
  const gadBin = path.join(repoRoot, 'vendor', 'get-anything-done', 'bin', 'gad.cjs');
  const exists = fs.existsSync(gadBin);
  if (!exists) return new Set();
  const helpOut = safeExec(`node "${gadBin}" --help 2>&1`, repoRoot);
  const valid = new Set();
  // The top-level USAGE line is `gad ls|workspace|projects|...`
  const usageLine = helpOut.split('\n').find((l) => l.includes('USAGE') || l.includes('gad ls'));
  if (usageLine) {
    const pipeMatch = usageLine.match(/gad\s+([a-z][a-z|-]+)/);
    if (pipeMatch) {
      pipeMatch[1].split('|').forEach((c) => valid.add(c.trim()));
    }
  }
  // Also pick up subcommand lines in the help output
  for (const line of helpOut.split('\n')) {
    const m = line.match(/^\s+([a-z][a-z-]*)\s{2,}/);
    if (m) valid.add(m[1]);
  }
  return valid;
}

/**
 * Resolve a file ref against multiple plausible roots. Returns true if found
 * in any of them.
 */
function fileRefExists(ref, repoRoot) {
  // Strip trailing slashes for directory refs
  const cleaned = ref.replace(/\/$/, '');
  const candidates = [
    path.resolve(repoRoot, cleaned),
    path.resolve(repoRoot, 'vendor', 'get-anything-done', cleaned),
  ];
  // Also try without leading dirs in case the skill cites a relative path
  // from inside vendor/get-anything-done/
  const stripped = cleaned.replace(/^vendor\/get-anything-done\//, '');
  if (stripped !== cleaned) {
    candidates.push(path.resolve(repoRoot, 'vendor', 'get-anything-done', stripped));
  }
  return candidates.some((p) => fs.existsSync(p));
}

/**
 * Validate a proto-skill SKILL.md against the repo. Returns a structured
 * result the formatter can turn into VALIDATION.md.
 */
function validateProtoSkill(skillPath, repoRoot) {
  if (!fs.existsSync(skillPath)) {
    throw new Error(`SKILL.md not found at ${skillPath}`);
  }
  const body = fs.readFileSync(skillPath, 'utf8');
  const fileRefs = extractFileRefs(body);
  const cliCommands = extractCliCommands(body);
  const validCmds = discoverGadCommands(repoRoot);

  const fileRefResults = fileRefs.map((ref) => ({
    ref,
    exists: fileRefExists(ref, repoRoot),
  }));

  const cliCommandResults = cliCommands.map((cmd) => ({
    cmd,
    valid: validCmds.size === 0 ? null : validCmds.has(cmd),
  }));

  return {
    skillPath,
    fileRefs: fileRefResults,
    cliCommands: cliCommandResults,
    cliDiscovered: validCmds.size > 0,
  };
}

/**
 * Format a validation result as a VALIDATION.md document body.
 */
function formatValidation(result, slug) {
  const okFiles = result.fileRefs.filter((f) => f.exists).length;
  const totalFiles = result.fileRefs.length;
  const okCmds = result.cliCommands.filter((c) => c.valid === true).length;
  const totalCmds = result.cliCommands.length;
  const missingFiles = result.fileRefs.filter((f) => !f.exists);
  const missingCmds = result.cliCommands.filter((c) => c.valid === false);

  const date = new Date().toISOString().slice(0, 10);
  let md = `# Validation — ${slug}\n\n`;
  md += `**Generated by gad-evolution-validator on ${date}.**\n\n`;
  md += `Advisory only. The human reviewer reads this alongside SKILL.md before\n`;
  md += `promoting (\`gad evolution promote\`) or discarding (\`gad evolution discard\`)\n`;
  md += `the proto-skill. Failures here do not block promotion — they're heads-up\n`;
  md += `notes that the skill may reference things that don't exist in the repo today.\n\n`;
  md += `## Summary\n\n`;
  md += `| Check | Pass | Total | Status |\n|---|---|---|---|\n`;
  md += `| File references exist in repo | ${okFiles} | ${totalFiles} | ${okFiles === totalFiles ? '✅' : '⚠️'} |\n`;
  md += `| CLI commands recognized by \`gad --help\` | ${okCmds} | ${totalCmds} | ${okCmds === totalCmds ? '✅' : '⚠️'} |\n\n`;
  if (!result.cliDiscovered) {
    md += `> Note: could not discover \`gad\` CLI surface (binary not found at \`vendor/get-anything-done/bin/gad.cjs\`). CLI command validation skipped.\n\n`;
  }

  md += `## File references\n\n`;
  if (result.fileRefs.length === 0) {
    md += `_No file references found in SKILL.md._\n\n`;
  } else {
    md += `| Path | Found |\n|---|---|\n`;
    for (const r of result.fileRefs) {
      md += `| \`${r.ref}\` | ${r.exists ? '✓' : '✗ MISSING'} |\n`;
    }
    md += '\n';
  }

  md += `## CLI commands\n\n`;
  if (result.cliCommands.length === 0) {
    md += `_No \`gad <subcommand>\` references found in SKILL.md._\n\n`;
  } else {
    md += `| Command | Recognized |\n|---|---|\n`;
    for (const c of result.cliCommands) {
      const mark = c.valid === true ? '✓' : c.valid === false ? '✗ NOT IN gad --help' : '— skipped';
      md += `| \`gad ${c.cmd}\` | ${mark} |\n`;
    }
    md += '\n';
  }

  if (missingFiles.length > 0 || missingCmds.length > 0) {
    md += `## Why this matters\n\n`;
    md += `These items couldn't be verified against the repo. Possible causes:\n\n`;
    md += `1. The skill cites planned-future paths or commands that don't exist yet.\n`;
    md += `2. The skill is wrong about repo conventions (regenerate the candidate from raw data).\n`;
    md += `3. The path/command got renamed since the skill was drafted.\n\n`;
    md += `Investigate before promoting. If the discrepancies are real, either fix the SKILL.md by hand or discard and re-evolve.\n`;
  }

  return md;
}

/**
 * Write a VALIDATION.md next to the SKILL.md it validates.
 */
function writeValidation(skillPath, repoRoot) {
  const result = validateProtoSkill(skillPath, repoRoot);
  const dir = path.dirname(skillPath);
  const slug = path.basename(dir);
  const md = formatValidation(result, slug);
  const outPath = path.join(dir, 'VALIDATION.md');
  fs.writeFileSync(outPath, md, 'utf8');
  return { outPath, result };
}

module.exports = {
  validateProtoSkill,
  formatValidation,
  writeValidation,
  extractFileRefs,
  extractCliCommands,
  discoverGadCommands,
};
