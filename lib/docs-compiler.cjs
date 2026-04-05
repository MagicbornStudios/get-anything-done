'use strict';
/**
 * docs-compiler.cjs — compile planning files from all roots into MDX sink.
 *
 * Rules:
 * - Output path: {sink}/{root.id}/planning/{name}.mdx  (lowercase, in planning/ subdir)
 * - Handles MD, MDX, and XML sources transparently
 * - Only overwrites files that have `generated: true` in their frontmatter
 * - New files (no existing sink file) are always created
 * - Human-authored sink files (no `generated:` tag) are never touched
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Source file priority: preferred name first, fallback second
// Maps to sink filename (lowercase).
// ---------------------------------------------------------------------------
const SOURCE_MAP = [
  { srcs: ['STATE.md', 'STATE.xml'],           sink: 'state.mdx',          title: 'Planning State' },
  { srcs: ['ROADMAP.md', 'ROADMAP.xml'],        sink: 'roadmap.mdx',        title: 'Roadmap' },
  { srcs: ['DECISIONS.xml', 'DECISIONS.md'],    sink: 'decisions.mdx',      title: 'Decisions' },
  { srcs: ['TASK-REGISTRY.xml', 'TASK-REGISTRY.md'], sink: 'task-registry.mdx', title: 'Task Registry' },
  { srcs: ['REQUIREMENTS.xml', 'REQUIREMENTS.md'],   sink: 'requirements.mdx',  title: 'Requirements' },
  { srcs: ['ERRORS-AND-ATTEMPTS.xml'],          sink: 'errors-and-attempts.mdx', title: 'Errors & Attempts' },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile all source planning files for a root into the MDX sink.
 * Only overwrites files tagged `generated: true` in their frontmatter.
 * Returns the number of files written.
 */
function compile(baseDir, root, sink) {
  if (!sink) throw new Error('No sink path provided.');
  const planDir  = path.join(baseDir, root.path, root.planningDir);
  const outDir   = path.join(baseDir, sink, root.id, 'planning');
  const now      = new Date().toISOString();
  const srcBase  = `${root.path}/${root.planningDir}`;
  let written = 0;

  fs.mkdirSync(outDir, { recursive: true });

  for (const { srcs, sink: sinkName, title } of SOURCE_MAP) {
    // Find first source file that exists
    let srcFile = null;
    for (const s of srcs) {
      const candidate = path.join(planDir, s);
      if (fs.existsSync(candidate)) { srcFile = { p: candidate, name: s }; break; }
    }
    if (!srcFile) continue;

    const destPath = path.join(outDir, sinkName);
    const destExists = fs.existsSync(destPath);

    // If dest exists and is NOT generated — skip (human-authored)
    if (destExists && !isGenerated(destPath)) continue;

    const raw = fs.readFileSync(srcFile.p, 'utf8');
    const body = srcFile.name.endsWith('.xml') ? xmlToMdBody(srcFile.name, raw) : stripFrontmatter(raw);
    const mdx = buildMdx({
      title: `${root.id} — ${title}`,
      description: `Auto-compiled from ${srcBase}/${srcFile.name}`,
      generated: 'true',
      source: `${srcBase}/${srcFile.name}`,
      updated: now,
    }, body);

    fs.writeFileSync(destPath, mdx);
    written++;
  }

  return written;
}

/**
 * Decompile: copy sink MDX back to planning source file (preserving original format).
 * Only touches files that have `generated: true` in their frontmatter.
 */
function decompile(baseDir, root, sink) {
  if (!sink) throw new Error('No sink path provided.');
  const planDir = path.join(baseDir, root.path, root.planningDir);
  const outDir  = path.join(baseDir, sink, root.id, 'planning');
  let written = 0;

  for (const { srcs, sink: sinkName } of SOURCE_MAP) {
    const srcPath = path.join(outDir, sinkName);
    if (!fs.existsSync(srcPath)) continue;
    if (!isGenerated(srcPath)) continue;  // human-authored sink — skip

    // Write back to the preferred source format (first in srcs list)
    const dest = path.join(planDir, srcs[0]);
    const mdxContent = fs.readFileSync(srcPath, 'utf8');
    // Strip the auto-generated frontmatter, restore original content
    const body = stripFrontmatter(mdxContent);
    fs.mkdirSync(planDir, { recursive: true });
    fs.writeFileSync(dest, body);
    written++;
  }

  return written;
}

// ---------------------------------------------------------------------------
// XML → Markdown body converters
// ---------------------------------------------------------------------------

function xmlToMdBody(filename, xml) {
  const base = filename.toUpperCase();

  if (base === 'STATE.XML')          return stateXmlToMd(xml);
  if (base === 'ROADMAP.XML')        return roadmapXmlToMd(xml);
  if (base === 'DECISIONS.XML')      return decisionsXmlToMd(xml);
  if (base === 'TASK-REGISTRY.XML')  return taskRegistryXmlToMd(xml);
  if (base === 'REQUIREMENTS.XML')   return requirementsXmlToMd(xml);
  if (base === 'ERRORS-AND-ATTEMPTS.XML') return errorsXmlToMd(xml);
  // Generic fallback: strip tags
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tag(xml, name) {
  // Extract first occurrence of <name>...</name> (non-greedy, handles nested content)
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? m[1].trim() : '';
}

function allTags(xml, name) {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi');
  const results = [];
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
  return results;
}

function attr(str, name) {
  const m = str.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

function stateXmlToMd(xml) {
  const phase   = tag(xml, 'current-phase');
  const plan    = tag(xml, 'current-plan');
  const status  = tag(xml, 'status');
  const next    = tag(xml, 'next-action');
  const updated = tag(xml, 'last-updated') || tag(xml, 'updated');

  const lines = ['# Planning State', ''];
  lines.push('## Current position', '');
  if (phase)   lines.push(`- **Phase:** ${phase}`);
  if (plan)    lines.push(`- **Plan:** ${plan}`);
  if (status)  lines.push(`- **Status:** ${status}`);
  if (updated) lines.push(`- **Updated:** ${updated}`);
  if (next) {
    lines.push('', '## Next action', '', next);
  }
  return lines.join('\n') + '\n';
}

function roadmapXmlToMd(xml) {
  // Extract all <phase> blocks
  const phaseRe = /<phase[^>]*>([\s\S]*?)<\/phase>/gi;
  const lines = ['# Roadmap', ''];
  let m;
  while ((m = phaseRe.exec(xml)) !== null) {
    const block   = m[0];
    const id      = attr(block, 'id');
    const title   = tag(block, 'title');
    const goal    = tag(block, 'goal');
    const status  = tag(block, 'status');
    const depends = tag(block, 'depends');

    lines.push(`## Phase ${id}${title ? ` — ${title}` : ''}`, '');
    if (status)  lines.push(`**Status:** ${status}`);
    if (goal)    lines.push(`**Goal:** ${goal}`);
    if (depends) lines.push(`**Depends:** ${depends}`);
    lines.push('');
  }
  return lines.join('\n');
}

function decisionsXmlToMd(xml) {
  const decisionRe = /<decision[^>]*>([\s\S]*?)<\/decision>/gi;
  const lines = ['# Decisions', ''];
  let m;
  while ((m = decisionRe.exec(xml)) !== null) {
    const block   = m[0];
    const id      = attr(block, 'id');
    const title   = tag(block, 'title');
    const summary = tag(block, 'summary');
    const impact  = tag(block, 'impact');

    lines.push(`## ${id}${title ? `: ${title}` : ''}`, '');
    if (summary) lines.push(summary, '');
    if (impact)  lines.push(`**Impact:** ${impact}`, '');
  }
  return lines.join('\n');
}

function taskRegistryXmlToMd(xml) {
  const phaseRe = /<phase[^>]*>([\s\S]*?)<\/phase>/gi;
  const lines = ['# Task Registry', ''];
  let m;
  while ((m = phaseRe.exec(xml)) !== null) {
    const phaseBlock = m[0];
    const phaseId = attr(phaseBlock, 'id');
    lines.push(`## Phase ${phaseId}`, '');

    const taskRe = /<task[^>]*>([\s\S]*?)<\/task>/gi;
    let t;
    while ((t = taskRe.exec(phaseBlock)) !== null) {
      const taskBlock  = t[0];
      const taskId     = attr(taskBlock, 'id');
      const status     = attr(taskBlock, 'status');
      const goal       = tag(taskBlock, 'goal');
      const statusMark = status === 'done' ? '✓' : status === 'in-progress' ? '→' : '○';
      lines.push(`- ${statusMark} **${taskId}** ${goal}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function requirementsXmlToMd(xml) {
  const text = xml.replace(/<\?[^>]+\?>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return `# Requirements\n\n${text}\n`;
}

function errorsXmlToMd(xml) {
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  const lines = ['# Errors & Attempts', ''];
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const block   = m[0];
    const id      = attr(block, 'id') || attr(block, 'date');
    const error   = tag(block, 'error') || tag(block, 'problem');
    const attempt = tag(block, 'attempt') || tag(block, 'solution');
    lines.push(`## ${id}`, '');
    if (error)   lines.push(`**Error:** ${error}`, '');
    if (attempt) lines.push(`**Attempt:** ${attempt}`, '');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return true if the MDX file has `generated: "true"` in its frontmatter. */
function isGenerated(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.startsWith('---')) return false;
    const end = content.indexOf('\n---', 3);
    if (end === -1) return false;
    const fm = content.slice(3, end);
    return /generated:\s*["']?true["']?/i.test(fm);
  } catch { return false; }
}

/** Strip YAML frontmatter from Markdown/MDX content. */
function stripFrontmatter(content) {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return content;
  return content.slice(end + 4).replace(/^\n/, '');
}

/** Build a MDX file with frontmatter. */
function buildMdx(frontmatter, body) {
  const fm = Object.entries(frontmatter)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: "${String(v).replace(/"/g, '\\"')}"`)
    .join('\n');
  return `---\n${fm}\n---\n\n${body}`;
}

module.exports = { compile, decompile, isGenerated };
