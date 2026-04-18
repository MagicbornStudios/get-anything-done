'use strict';
/**
 * skill-linter.cjs — non-blocking linter for SKILL.md files.
 *
 * Surfaces formatting / contract / reference issues without failing the
 * build. Consumed by `gad skill lint` (all skills) and `gad skill status
 * <id>` (single-skill health). Can also run inside a pre-commit hook if
 * the project opts in — but the default install does NOT block on lint
 * failures per operator intent ("should not be blocking, but easily
 * found").
 *
 * Contract: pure function. Reads files, returns structured issue array.
 * No stdout, no side effects beyond fs.readFileSync / fs.statSync. The
 * CLI layer (bin/gad.cjs) is responsible for rendering / exit codes.
 *
 * Issue shape:
 *   { severity: 'error'|'warning'|'info', code: 'X', message: '...',
 *     line?: N, hint?: '...' }
 */

const fs = require('fs');
const path = require('path');

const SDK_ALIAS_MAP = {
  '@skills': 'skills',
  '@workflows': 'workflows',
  '@templates': 'templates',
  '@references': 'references',
  '@agents': 'agents',
  '@hooks': 'hooks',
};

const VALID_LANES = new Set(['dev', 'prod', 'meta']);
const REQUIRED_FRONTMATTER = ['name', 'description'];
const RECOMMENDED_FRONTMATTER = ['lane'];

/**
 * Parse a naive YAML frontmatter block. Handles only what SKILL.md needs:
 *   - top-level scalar values (key: value)
 *   - folded block scalars (>-, >, |)
 *   - simple flow-style arrays (lane: [dev, meta])
 *   - bracketless arrays on same line as key (NOT supported — flag as issue)
 *
 * Returns { fields, duplicateKeys, rawLines }.
 */
function parseFrontmatter(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { fields: {}, duplicateKeys: [], rawLines: [], hasFrontmatter: false };
  }
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { endIdx = i; break; }
  }
  if (endIdx === -1) {
    return { fields: {}, duplicateKeys: [], rawLines: lines, hasFrontmatter: false, unterminated: true };
  }
  const frontLines = lines.slice(1, endIdx);
  const fields = {};
  const duplicateKeys = [];
  let i = 0;
  while (i < frontLines.length) {
    const line = frontLines[i];
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    const inlineValue = m[2];
    if (key in fields) duplicateKeys.push({ key, line: i + 2 });
    if (inlineValue === '>' || inlineValue === '>-' || inlineValue === '|' || inlineValue === '|-') {
      const body = [];
      i++;
      while (i < frontLines.length && /^\s/.test(frontLines[i])) {
        body.push(frontLines[i].replace(/^\s+/, ''));
        i++;
      }
      fields[key] = inlineValue.startsWith('>') ? body.join(' ').trim() : body.join('\n');
    } else if (/^\[.*\]$/.test(inlineValue.trim())) {
      const inner = inlineValue.trim().slice(1, -1);
      fields[key] = inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      i++;
    } else {
      fields[key] = inlineValue.replace(/^['"]|['"]$/g, '');
      i++;
    }
  }
  return { fields, duplicateKeys, rawLines: lines, hasFrontmatter: true, frontmatterEnd: endIdx };
}

/**
 * Resolve an SDK-alias reference (e.g. "@workflows/foo.md") to an absolute
 * path against the given gadDir. Returns null if the reference doesn't
 * start with a known alias.
 */
function resolveSdkAlias(ref, gadDir) {
  for (const [alias, rel] of Object.entries(SDK_ALIAS_MAP)) {
    if (ref.startsWith(`${alias}/`)) {
      return path.join(gadDir, rel, ref.slice(alias.length + 1));
    }
  }
  return null;
}

/**
 * Resolve a relative-path reference (e.g. "../../workflows/foo.md") from
 * a SKILL.md location.
 */
function resolveRelativeRef(ref, skillPath) {
  return path.resolve(path.dirname(skillPath), ref);
}

/**
 * Extract file-reference candidates from a SKILL.md body. Looks for:
 *   - @<alias>/... strings
 *   - Markdown links: (./path) or (../path) or (path.md)
 *   - `workflow:` frontmatter value (top-level, different path)
 */
function stripFencedCodeBlocks(body) {
  return body.replace(/```[\s\S]*?```/g, (block) => ' '.repeat(block.length));
}

function extractBodyRefs(body) {
  const scanned = stripFencedCodeBlocks(body);
  const refs = [];
  const aliasRe = /@(skills|workflows|templates|references|agents|hooks)\/[A-Za-z0-9_/-]+(?:\.[A-Za-z0-9]+)?/g;
  let m;
  while ((m = aliasRe.exec(scanned)) !== null) {
    refs.push({ kind: 'alias', ref: m[0], index: m.index });
  }
  const linkRe = /\]\((\.{1,2}\/[^)]+\.(?:md|cjs|ts|tsx|js|jsx|py|json|toml|yaml|yml|sh))\)/g;
  while ((m = linkRe.exec(scanned)) !== null) {
    refs.push({ kind: 'relative', ref: m[1], index: m.index });
  }
  return refs;
}

/**
 * Lint a single SKILL.md file.
 *
 * @param {string} skillPath absolute path to SKILL.md
 * @param {object} [ctx]
 * @param {string} [ctx.gadDir] GAD framework root for alias resolution
 * @param {object} [ctx.fsImpl] injectable fs mock for tests
 * @returns {{ skillPath, issues, frontmatter, tokenEstimate }}
 */
function lintSkill(skillPath, ctx = {}) {
  const impl = ctx.fsImpl || fs;
  const gadDir = ctx.gadDir || path.resolve(path.dirname(skillPath), '..', '..');
  const issues = [];
  let raw;
  try {
    raw = impl.readFileSync(skillPath, 'utf8');
  } catch (e) {
    return {
      skillPath,
      issues: [{ severity: 'error', code: 'READ_FAILED', message: `Cannot read file: ${e.message}` }],
      frontmatter: null,
      tokenEstimate: 0,
    };
  }
  const parsed = parseFrontmatter(raw);
  if (!parsed.hasFrontmatter) {
    issues.push({
      severity: 'error',
      code: 'NO_FRONTMATTER',
      message: 'SKILL.md must open with a `---`-delimited YAML frontmatter block.',
      hint: 'Add name/description/lane at minimum.',
    });
    return { skillPath, issues, frontmatter: null, tokenEstimate: Math.ceil(raw.length / 4) };
  }
  if (parsed.unterminated) {
    issues.push({
      severity: 'error',
      code: 'UNTERMINATED_FRONTMATTER',
      message: 'Frontmatter opened with `---` but never closed.',
    });
  }
  for (const { key, line } of parsed.duplicateKeys) {
    issues.push({
      severity: 'error',
      code: 'DUPLICATE_KEY',
      message: `Frontmatter key \`${key}\` appears multiple times.`,
      line,
      hint: 'Keep one canonical occurrence; body-level `lane:` or `description:` strings get inserted here by mistake.',
    });
  }
  for (const req of REQUIRED_FRONTMATTER) {
    if (!(req in parsed.fields) || !parsed.fields[req]) {
      issues.push({
        severity: 'error',
        code: 'MISSING_REQUIRED_FIELD',
        message: `Required frontmatter field \`${req}\` is missing or empty.`,
      });
    }
  }
  for (const rec of RECOMMENDED_FRONTMATTER) {
    if (!(rec in parsed.fields) || !parsed.fields[rec]) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_RECOMMENDED_FIELD',
        message: `Recommended frontmatter field \`${rec}\` is missing.`,
        hint: 'lane must be one of dev|prod|meta (or an array of those).',
      });
    }
  }
  if (parsed.fields.lane) {
    const laneValues = Array.isArray(parsed.fields.lane) ? parsed.fields.lane : [parsed.fields.lane];
    for (const v of laneValues) {
      if (!VALID_LANES.has(v)) {
        issues.push({
          severity: 'error',
          code: 'INVALID_LANE',
          message: `lane value \`${v}\` is not one of dev|prod|meta.`,
        });
      }
    }
  }
  if (parsed.fields.description && typeof parsed.fields.description === 'string') {
    const desc = parsed.fields.description;
    if (desc.length < 40) {
      issues.push({
        severity: 'warning',
        code: 'DESCRIPTION_TOO_SHORT',
        message: `Description is ${desc.length} chars; runtimes rely on it for skill-firing. Aim for 200-400 chars with concrete trigger phrases.`,
      });
    } else if (desc.length > 1200) {
      issues.push({
        severity: 'warning',
        code: 'DESCRIPTION_TOO_LONG',
        message: `Description is ${desc.length} chars; long descriptions eat skill-catalog tokens on every session. Trim to ~400-800.`,
      });
    }
  }
  if (parsed.fields.workflow) {
    const workflowRef = String(parsed.fields.workflow);
    const candidates = [
      path.resolve(path.dirname(skillPath), workflowRef),
      path.join(gadDir, workflowRef),
    ];
    const found = candidates.some((p) => {
      try { return impl.statSync(p).isFile(); } catch { return false; }
    });
    if (!found) {
      issues.push({
        severity: 'warning',
        code: 'BROKEN_WORKFLOW_REF',
        message: `Frontmatter \`workflow: ${workflowRef}\` does not resolve to an existing file.`,
        hint: `Tried: ${candidates.map((p) => path.relative(gadDir, p)).join(', ')}`,
      });
    }
  }
  const bodyStart = parsed.frontmatterEnd + 1;
  const body = parsed.rawLines.slice(bodyStart).join('\n');
  const refs = extractBodyRefs(body);
  for (const r of refs) {
    const abs = r.kind === 'alias'
      ? resolveSdkAlias(r.ref, gadDir)
      : resolveRelativeRef(r.ref, skillPath);
    if (!abs) continue;
    try {
      impl.statSync(abs);
    } catch {
      issues.push({
        severity: 'info',
        code: 'BROKEN_BODY_REF',
        message: `Body references \`${r.ref}\` but the target file is missing.`,
        hint: `Resolved to ${path.relative(gadDir, abs)}`,
      });
    }
  }
  const tokenEstimate = Math.ceil(raw.length / 4);
  return { skillPath, issues, frontmatter: parsed.fields, tokenEstimate };
}

/**
 * Lint every SKILL.md discoverable under skillsDir.
 *
 * @param {string} skillsDir absolute path (typically <gadDir>/skills)
 * @param {object} [ctx]
 * @returns {Array<{ skillPath, issues, frontmatter, tokenEstimate }>}
 */
function lintAllSkills(skillsDir, ctx = {}) {
  const impl = ctx.fsImpl || fs;
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = impl.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name === 'SKILL.md') out.push(lintSkill(full, ctx));
    }
  };
  walk(skillsDir);
  return out;
}

/**
 * Aggregate a lint report into counts by severity + top-N bloat.
 */
function summarizeLint(reports) {
  const bySeverity = { error: 0, warning: 0, info: 0 };
  const byCode = {};
  let totalTokens = 0;
  for (const r of reports) {
    totalTokens += r.tokenEstimate;
    for (const i of r.issues) {
      bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
      byCode[i.code] = (byCode[i.code] || 0) + 1;
    }
  }
  const byTokens = [...reports].sort((a, b) => b.tokenEstimate - a.tokenEstimate).slice(0, 10);
  const clean = reports.filter((r) => r.issues.length === 0).length;
  return {
    totalSkills: reports.length,
    clean,
    bySeverity,
    byCode,
    totalTokens,
    averageTokens: reports.length > 0 ? Math.round(totalTokens / reports.length) : 0,
    topByTokens: byTokens.map((r) => ({ path: r.skillPath, tokens: r.tokenEstimate })),
  };
}

/**
 * Per-section token audit. Splits a SKILL.md body by top-level ## headers
 * and reports (section-name, chars, token-estimate) tuples so trim work
 * can target the longest section rather than guessing.
 *
 * @param {string} skillPath absolute path to SKILL.md
 * @param {object} [ctx]
 * @returns {{ skillPath, sections: Array<{name, chars, tokens, lines}>, totalTokens, frontmatterTokens }}
 */
function auditSkillTokens(skillPath, ctx = {}) {
  const impl = ctx.fsImpl || fs;
  let raw;
  try {
    raw = impl.readFileSync(skillPath, 'utf8');
  } catch (e) {
    return { skillPath, sections: [], totalTokens: 0, frontmatterTokens: 0, error: e.message };
  }
  const parsed = parseFrontmatter(raw);
  const frontmatterEndLine = parsed.hasFrontmatter ? parsed.frontmatterEnd + 1 : 0;
  const lines = parsed.rawLines.length > 0 ? parsed.rawLines : raw.split(/\r?\n/);
  const frontmatter = lines.slice(0, frontmatterEndLine).join('\n');
  const body = lines.slice(frontmatterEndLine).join('\n');
  const sections = [];
  const sectionRe = /^## (.+)$/gm;
  const markers = [];
  let m;
  while ((m = sectionRe.exec(body)) !== null) {
    markers.push({ name: m[1].trim(), index: m.index, line: body.slice(0, m.index).split('\n').length });
  }
  if (markers.length === 0) {
    sections.push({
      name: '(no ## sections)',
      chars: body.length,
      tokens: Math.ceil(body.length / 4),
      lines: body.split('\n').length,
    });
  } else {
    const preludeLength = markers[0].index;
    if (preludeLength > 0) {
      const prelude = body.slice(0, preludeLength);
      sections.push({
        name: '(prelude)',
        chars: prelude.length,
        tokens: Math.ceil(prelude.length / 4),
        lines: prelude.split('\n').length,
      });
    }
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index;
      const end = i + 1 < markers.length ? markers[i + 1].index : body.length;
      const chunk = body.slice(start, end);
      sections.push({
        name: markers[i].name,
        chars: chunk.length,
        tokens: Math.ceil(chunk.length / 4),
        lines: chunk.split('\n').length,
      });
    }
  }
  return {
    skillPath,
    frontmatterTokens: Math.ceil(frontmatter.length / 4),
    sections,
    totalTokens: Math.ceil(raw.length / 4),
  };
}

module.exports = {
  parseFrontmatter,
  extractBodyRefs,
  stripFencedCodeBlocks,
  resolveSdkAlias,
  resolveRelativeRef,
  lintSkill,
  lintAllSkills,
  summarizeLint,
  auditSkillTokens,
  SDK_ALIAS_MAP,
  VALID_LANES,
};
