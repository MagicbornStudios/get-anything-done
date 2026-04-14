'use strict';
/**
 * docs-compiler.cjs — compile planning files from all roots into MDX sink.
 *
 * Rules:
 * - Output path: {sink}/{root.id}/planning/{name}.mdx  (lowercase, in planning/ subdir)
 * - Handles MD, MDX, and XML sources transparently
 * - Only overwrites files that have `generated: true` in their frontmatter
 * - New files (no existing sink file) are always created
 * - Human-authored sink files (no `generated:` tag) are never touched unless
 *   `compile(..., { force: true })` — use after `gad sink diff`
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Source file priority: preferred name first, fallback second
// Maps to sink filename (lowercase).
// ---------------------------------------------------------------------------
const SOURCE_MAP = [
  { srcs: ['STATE.xml', 'STATE.md'],                    sink: 'state.mdx',              title: 'Planning State' },
  { srcs: ['ROADMAP.xml', 'ROADMAP.md'],                sink: 'roadmap.mdx',            title: 'Roadmap' },
  { srcs: ['DECISIONS.xml', 'DECISIONS.md'],            sink: 'decisions.mdx',          title: 'Decisions' },
  { srcs: ['TASK-REGISTRY.xml', 'TASK-REGISTRY.md'],    sink: 'task-registry.mdx',      title: 'Task Registry' },
  { srcs: ['REQUIREMENTS.xml', 'REQUIREMENTS.md'],      sink: 'requirements.mdx',       title: 'Requirements' },
  { srcs: ['ERRORS-AND-ATTEMPTS.xml'],                  sink: 'errors-and-attempts.mdx', title: 'Errors & Attempts' },
  { srcs: ['BLOCKERS.xml'],                             sink: 'blockers.mdx',           title: 'Blockers' },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile all source planning files for a root into the MDX sink.
 * Only overwrites files tagged `generated: true` in their frontmatter,
 * unless `options.force` is true (overwrites human-authored sink files).
 * Returns the number of files written.
 */
function compile(baseDir, root, sink, options = {}) {
  if (!sink) throw new Error('No sink path provided.');
  const force = options.force === true;
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

    // If dest exists and is NOT generated — skip (human-authored) unless force
    if (destExists && !force && !isGenerated(destPath)) continue;

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
 * Decompile: ensure the planning source directory exists and is scaffolded.
 *
 * Rules:
 * - Always creates root.planningDir if it doesn't exist.
 * - If a source XML already exists — skip it (XML is authoritative, not the sink).
 * - If no source XML exists (project only known from sink) — create an empty stub XML.
 * - Never overwrites existing source files.
 *
 * Returns the number of stub files created.
 */
function decompile(baseDir, root, sink) {
  if (!sink) throw new Error('No sink path provided.');
  const planDir = path.join(baseDir, root.path, root.planningDir);
  const outDir  = path.join(baseDir, sink, root.id, 'planning');

  // Always ensure the planning dir exists
  fs.mkdirSync(planDir, { recursive: true });

  // If the sink dir for this project doesn't exist either — nothing to do
  if (!fs.existsSync(outDir)) return 0;

  let created = 0;
  for (const { srcs, sink: sinkName, title } of SOURCE_MAP) {
    const sinkPath = path.join(outDir, sinkName);
    if (!fs.existsSync(sinkPath)) continue;

    // Find preferred source file name (first xml entry in srcs)
    const preferredSrc = srcs.find(s => s.endsWith('.xml')) || srcs[0];
    const destPath = path.join(planDir, preferredSrc);

    // Source already exists — XML is authoritative, do not overwrite
    if (fs.existsSync(destPath)) continue;

    // Sink exists but no source: create a stub XML
    const rootTag = preferredSrc.replace('.xml', '').replace('-AND-', '-and-').toLowerCase()
      .replace('state', 'state')
      .replace('roadmap', 'roadmap')
      .replace('task-registry', 'task-registry')
      .replace('decisions', 'decisions')
      .replace('requirements', 'requirements')
      .replace('errors-and-attempts', 'errors-and-attempts')
      .replace('blockers', 'blockers');

    const xmlRoot = preferredSrc.replace('.xml', '').toLowerCase();
    const stub = `<?xml version="1.0" encoding="UTF-8"?>\n<${xmlRoot}>\n  <!-- Stub created by gad sink decompile on ${new Date().toISOString().slice(0, 10)}. Populate from sink: ${sink}/${root.id}/planning/${sinkName} -->\n</${xmlRoot}>\n`;
    fs.writeFileSync(destPath, stub);
    created++;
  }

  return created;
}

// ---------------------------------------------------------------------------
// XML → Markdown body converters
// ---------------------------------------------------------------------------

function xmlToMdBody(filename, xml) {
  const base = filename.toUpperCase();

  if (base === 'STATE.XML')                return stateXmlToMd(xml);
  if (base === 'ROADMAP.XML')              return roadmapXmlToMd(xml);
  if (base === 'DECISIONS.XML')            return decisionsXmlToMd(xml);
  if (base === 'TASK-REGISTRY.XML')        return taskRegistryXmlToMd(xml);
  if (base === 'REQUIREMENTS.XML')         return requirementsXmlToMd(xml);
  if (base === 'ERRORS-AND-ATTEMPTS.XML')  return errorsXmlToMd(xml);
  if (base === 'BLOCKERS.XML')             return blockersXmlToMd(xml);
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
  const docRe = /<doc\b([^>]*)>([\s\S]*?)<\/doc>/g;
  const lines = ['# Requirements', '', '_Pointers to canonical requirement docs._', ''];
  let m;
  while ((m = docRe.exec(xml)) !== null) {
    const attrs = m[1];
    const body  = m[2];
    const kindMatch = attrs.match(/\bkind="([^"]*)"/);
    const kind = kindMatch ? kindMatch[1] : 'doc';
    const pathMatch = body.match(/<path>([\s\S]*?)<\/path>/);
    const docPath = pathMatch ? pathMatch[1].trim() : '';
    const contentMatch = body.match(/<content[^>]*>([\s\S]*?)<\/content>/);
    const rawContent = contentMatch ? contentMatch[1] : '';
    const description = rawContent
      .replace(/<!\[CDATA\[/, '').replace(/\]\]>/, '')
      .replace(/<[^>]+>/g, '').trim()
      .split('\n').map(l => l.trim()).filter(Boolean).join(' ');
    lines.push(`## ${kind}`, '');
    if (docPath)     lines.push(`**Path:** \`${docPath}\``, '');
    if (description) lines.push(description, '');
  }
  return lines.join('\n');
}

function errorsXmlToMd(xml) {
  // Handles <attempt id="..." phase="..." task="..." status="..."> schema
  const attemptRe = /<attempt\s([^>]*)>([\s\S]*?)<\/attempt>/gi;
  const lines = ['# Errors & Attempts', ''];
  let m;
  while ((m = attemptRe.exec(xml)) !== null) {
    const block   = m[0];
    const id      = attr(block, 'id');
    const phase   = attr(block, 'phase');
    const task    = attr(block, 'task');
    const status  = attr(block, 'status');
    const title   = tag(block, 'title');
    const symptom = tag(block, 'symptom');
    const cause   = tag(block, 'cause');
    const fix     = tag(block, 'attempted-fix');
    const cmds    = allTags(block, 'command');

    const header = [id, phase && `phase ${phase}`, task && `task ${task}`, status].filter(Boolean).join(' — ');
    lines.push(`## ${header}`, '');
    if (title)   lines.push(`**${title}**`, '');
    if (symptom) lines.push('', `**Symptom:** ${symptom}`);
    if (cause)   lines.push('', `**Cause:** ${cause}`);
    if (fix)     lines.push('', `**Fix:** ${fix}`);
    if (cmds.length) {
      lines.push('', '**Verification:**');
      for (const c of cmds) lines.push(`\`\`\`\n${c}\n\`\`\``);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function blockersXmlToMd(xml) {
  const blockerRe = /<blocker\s([^>]*)>([\s\S]*?)<\/blocker>/gi;
  const lines = ['# Blockers', ''];
  let m;
  while ((m = blockerRe.exec(xml)) !== null) {
    const block   = m[0];
    const id      = attr(block, 'id');
    const status  = attr(block, 'status');
    const title   = tag(block, 'title');
    const summary = tag(block, 'summary');
    const taskRef = tag(block, 'task-ref');

    lines.push(`## ${id}${title ? ` — ${title}` : ''}  (${status})`, '');
    if (summary) lines.push(summary, '');
    if (taskRef) lines.push(`**Task:** ${taskRef}`, '');
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

/** Normalize MDX for equality comparison (ignore `updated:` so diff isn’t noisy). */
function stripUpdatedFromFrontmatterYaml(mdx) {
  if (!mdx.startsWith('---')) return mdx;
  const end = mdx.indexOf('\n---', 3);
  if (end === -1) return mdx;
  const fm = mdx.slice(3, end);
  const rest = mdx.slice(end + 4);
  const fmNoUpdated = fm.split('\n').filter((l) => !/^\s*updated\s*:/.test(l)).join('\n');
  return `---\n${fmNoUpdated}\n---\n${rest}`;
}

function normalizeLf(s) {
  return String(s).replace(/\r\n/g, '\n');
}

/**
 * Git unified diff between two string contents; labels appear in the diff header.
 * Falls back to a simple line dump if `git` is unavailable.
 */
function unifiedDiffStrings(labelA, labelB, contentA, contentB) {
  const a = normalizeLf(contentA);
  const b = normalizeLf(contentB);
  if (a === b) return '';

  const baseA = `gad-sink-a-${process.pid}-${Date.now()}`;
  const baseB = `gad-sink-b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const tmpA = path.join(os.tmpdir(), baseA);
  const tmpB = path.join(os.tmpdir(), baseB);
  const ensureNl = (s) => (s.endsWith('\n') ? s : `${s}\n`);
  try {
    fs.writeFileSync(tmpA, ensureNl(a), 'utf8');
    fs.writeFileSync(tmpB, ensureNl(b), 'utf8');
    const r = spawnSync('git', ['diff', '--no-index', '--no-color', '--', tmpA, tmpB], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    if (r.error && r.error.code === 'ENOENT') return fallbackUnifiedDiff(labelA, labelB, a, b);
    let out = r.stdout || '';
    if (!out.trim()) return fallbackUnifiedDiff(labelA, labelB, a, b);
    // Replace full temp paths only (never replace basename alone — it can splice into the path).
    out = rewriteDiffTempPaths(out, tmpA, tmpB, labelA, labelB);
    return out;
  } finally {
    try { fs.unlinkSync(tmpA); } catch {}
    try { fs.unlinkSync(tmpB); } catch {}
  }
}

function rewriteDiffTempPaths(out, tmpA, tmpB, labelA, labelB) {
  const variants = (abs) => {
    const s = new Set([
      abs,
      abs.replace(/\\/g, '/'),
      abs.replace(/\//g, '\\'),
      // Git quoted lines on Windows often double each backslash
      abs.replace(/\\/g, '\\\\'),
    ]);
    return [...s];
  };
  let s = out;
  for (const v of variants(tmpA)) if (v) s = s.split(v).join(labelA);
  for (const v of variants(tmpB)) if (v) s = s.split(v).join(labelB);
  return s;
}

function fallbackUnifiedDiff(labelA, labelB, a, b) {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  return [
    `diff --git a/${labelA} b/${labelB}`,
    `--- a/${labelA}`,
    `+++ b/${labelB}`,
    `@@ content differs (${linesA.length} vs ${linesB.length} lines) @@`,
    ...linesA.map((l) => `- ${l}`),
    ...linesB.map((l) => `+ ${l}`),
    '',
  ].join('\n');
}

/**
 * Compare compiled sink output vs files on disk for one root.
 * Returns { chunks: string[], changed: number, needsForce: number }.
 * "Changed" counts entries where the on-disk file would differ from compile output
 * (excluding timestamp-only drift via stripUpdatedFromFrontmatterYaml).
 */
function diffSink(baseDir, root, sink) {
  if (!sink) throw new Error('No sink path provided.');
  const planDir = path.join(baseDir, root.path, root.planningDir);
  const outDir = path.join(baseDir, sink, root.id, 'planning');
  const now = new Date().toISOString();
  const srcBase = `${root.path}/${root.planningDir}`;
  const chunks = [];
  let changed = 0;
  let needsForce = 0;

  for (const { srcs, sink: sinkName, title } of SOURCE_MAP) {
    let srcFile = null;
    for (const s of srcs) {
      const candidate = path.join(planDir, s);
      if (fs.existsSync(candidate)) { srcFile = { p: candidate, name: s }; break; }
    }
    if (!srcFile) continue;

    const destPath = path.join(outDir, sinkName);
    const destExists = fs.existsSync(destPath);
    const current = destExists ? fs.readFileSync(destPath, 'utf8') : '';

    const raw = fs.readFileSync(srcFile.p, 'utf8');
    const body = srcFile.name.endsWith('.xml') ? xmlToMdBody(srcFile.name, raw) : stripFrontmatter(raw);
    const mdx = buildMdx({
      title: `${root.id} — ${title}`,
      description: `Auto-compiled from ${srcBase}/${srcFile.name}`,
      generated: 'true',
      source: `${srcBase}/${srcFile.name}`,
      updated: now,
    }, body);

    const comparableCurrent = normalizeLf(stripUpdatedFromFrontmatterYaml(current));
    const comparableExpected = normalizeLf(stripUpdatedFromFrontmatterYaml(mdx));
    if (comparableCurrent === comparableExpected) continue;

    changed++;
    const rel = path.relative(baseDir, destPath).split(path.sep).join('/');
    const humanBlocked = destExists && !isGenerated(destPath);
    if (humanBlocked) needsForce++;

    const diff = unifiedDiffStrings(rel, rel, current, mdx);
    const banner = humanBlocked
      ? `${rel} — on disk is not generated; only \`gad sink compile --force\` will overwrite.\n`
      : `${rel} — would update on \`gad sink compile\`.\n`;
    chunks.push(`${banner}\n${diff}\n`);
  }

  return { chunks, changed, needsForce };
}

// ---------------------------------------------------------------------------
// Markdown → XML hydrators (inverse of *XmlToMd)
// ---------------------------------------------------------------------------
//
// Each of these parses a markdown body (produced by its *XmlToMd sibling, or
// hand-authored in the same shape) into the canonical XML shape that the
// readers in bin/gad.cjs depend on. Per the audit in
// references/sink-md-xml-audit.md §6 (task 42.4-10), this is a focused
// best-effort transformer — it does not attempt to be a general-purpose
// markdown parser. It mirrors the forward converters field-for-field.

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function wrapXml(rootTag, innerLines) {
  const body = innerLines.length ? innerLines.join('\n') + '\n' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n${body}</${rootTag}>\n`;
}

function stripFrontmatterLocal(md) {
  return stripFrontmatter(md);
}

// Match a labeled bullet like "- **Label:** value"
function labeledValue(md, label) {
  const re = new RegExp(`^\\s*[-*]\\s*\\*\\*${label}:\\*\\*\\s*(.+)$`, 'im');
  const m = md.match(re);
  return m ? m[1].trim() : '';
}

// Section body — everything after "## Heading" until next "## " or EOF
function sectionBody(md, heading) {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'im');
  const m = md.match(re);
  if (!m) return '';
  const start = m.index + m[0].length;
  const rest = md.slice(start);
  const next = rest.match(/^##\s/m);
  const end = next ? next.index : rest.length;
  return rest.slice(0, end).trim();
}

function stateMdToXml(md) {
  const body = stripFrontmatterLocal(md);
  const phase   = labeledValue(body, 'Phase');
  const plan    = labeledValue(body, 'Plan');
  const status  = labeledValue(body, 'Status');
  const updated = labeledValue(body, 'Updated');
  const next    = sectionBody(body, 'Next action');

  const lines = [];
  lines.push(`  <current-phase>${escapeXml(phase)}</current-phase>`);
  lines.push(`  <current-plan>${escapeXml(plan)}</current-plan>`);
  if (status)  lines.push(`  <status>${escapeXml(status)}</status>`);
  if (updated) lines.push(`  <last-updated>${escapeXml(updated)}</last-updated>`);
  if (next)    lines.push(`  <next-action>${escapeXml(next)}</next-action>`);
  return wrapXml('state', lines);
}

function roadmapMdToXml(md) {
  const body = stripFrontmatterLocal(md);
  // Match each "## Phase <id>[ — title]" block and collect labeled bullets
  const headRe = /^##\s+Phase\s+([^\s—\n]+)(?:\s*—\s*(.+))?\s*$/gim;
  const headers = [];
  let m;
  while ((m = headRe.exec(body)) !== null) {
    headers.push({ id: m[1].trim(), title: (m[2] || '').trim(), index: m.index + m[0].length });
  }
  const lines = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const end = i + 1 < headers.length ? headers[i + 1].index : body.length;
    const section = body.slice(h.index, end);
    const status  = (section.match(/\*\*Status:\*\*\s*(.+)/i) || [, ''])[1].trim();
    const goal    = (section.match(/\*\*Goal:\*\*\s*(.+)/i) || [, ''])[1].trim();
    const depends = (section.match(/\*\*Depends:\*\*\s*(.+)/i) || [, ''])[1].trim();

    const attrs = [`id="${escapeXml(h.id)}"`];
    if (status) attrs.push(`status="${escapeXml(status)}"`);
    lines.push(`  <phase ${attrs.join(' ')}>`);
    if (h.title) lines.push(`    <title>${escapeXml(h.title)}</title>`);
    if (goal)    lines.push(`    <goal>${escapeXml(goal)}</goal>`);
    if (depends) lines.push(`    <depends>${escapeXml(depends)}</depends>`);
    lines.push(`  </phase>`);
  }
  return wrapXml('roadmap', lines);
}

function decisionsMdToXml(md) {
  const body = stripFrontmatterLocal(md);
  // "## <id>[: title]" blocks; summary = first non-empty paragraph; impact = **Impact:** line
  const headRe = /^##\s+([^\s:\n]+)(?:\s*:\s*(.+))?\s*$/gim;
  const headers = [];
  let m;
  while ((m = headRe.exec(body)) !== null) {
    headers.push({ id: m[1].trim(), title: (m[2] || '').trim(), index: m.index + m[0].length });
  }
  const lines = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const end = i + 1 < headers.length ? headers[i + 1].index : body.length;
    const section = body.slice(h.index, end).trim();
    const impactMatch = section.match(/\*\*Impact:\*\*\s*(.+)/i);
    const impact = impactMatch ? impactMatch[1].trim() : '';
    // Summary: first paragraph that's not a "**Impact:**" line
    const paragraphs = section.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const summary = paragraphs.find(p => !/^\*\*Impact:\*\*/i.test(p)) || '';

    lines.push(`  <decision id="${escapeXml(h.id)}">`);
    if (h.title) lines.push(`    <title>${escapeXml(h.title)}</title>`);
    if (summary) lines.push(`    <summary>${escapeXml(summary)}</summary>`);
    if (impact)  lines.push(`    <impact>${escapeXml(impact)}</impact>`);
    lines.push(`  </decision>`);
  }
  return wrapXml('decisions', lines);
}

function taskRegistryMdToXml(md) {
  const body = stripFrontmatterLocal(md);
  // "## Phase <id>" blocks, each containing task bullets:
  //   "- <mark> **<taskId>** <goal>"  where mark is ✓|→|○
  const phaseRe = /^##\s+Phase\s+(\S+)\s*$/gim;
  const headers = [];
  let m;
  while ((m = phaseRe.exec(body)) !== null) {
    headers.push({ id: m[1].trim(), index: m.index + m[0].length });
  }
  const lines = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const end = i + 1 < headers.length ? headers[i + 1].index : body.length;
    const section = body.slice(h.index, end);
    lines.push(`  <phase id="${escapeXml(h.id)}">`);
    const taskRe = /^-\s+(✓|→|○)\s+\*\*([^*]+)\*\*\s*(.*)$/gim;
    let t;
    while ((t = taskRe.exec(section)) !== null) {
      const mark = t[1];
      const taskId = t[2].trim();
      const goal = t[3].trim();
      const status = mark === '✓' ? 'done' : mark === '→' ? 'in-progress' : 'planned';
      lines.push(`    <task id="${escapeXml(taskId)}" status="${status}"><goal>${escapeXml(goal)}</goal></task>`);
    }
    lines.push(`  </phase>`);
  }
  return wrapXml('task-registry', lines);
}

function requirementsMdToXml(md) {
  const body = stripFrontmatterLocal(md);
  // "## <kind>" blocks with optional "**Path:** `path`" + free-text description
  const headRe = /^##\s+(.+?)\s*$/gim;
  const headers = [];
  let m;
  while ((m = headRe.exec(body)) !== null) {
    headers.push({ kind: m[1].trim(), index: m.index + m[0].length });
  }
  const lines = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const end = i + 1 < headers.length ? headers[i + 1].index : body.length;
    const section = body.slice(h.index, end).trim();
    const pathMatch = section.match(/\*\*Path:\*\*\s*`([^`]+)`/i);
    const docPath = pathMatch ? pathMatch[1].trim() : '';
    const description = section
      .replace(/\*\*Path:\*\*\s*`[^`]+`/i, '')
      .trim();

    lines.push(`  <doc kind="${escapeXml(h.kind)}">`);
    if (docPath)     lines.push(`    <path>${escapeXml(docPath)}</path>`);
    if (description) lines.push(`    <content>${escapeXml(description)}</content>`);
    lines.push(`  </doc>`);
  }
  return wrapXml('requirements', lines);
}

// Dispatch table for the hydrate walker. Keyed by the preferred XML output
// filename so we can mirror SOURCE_MAP. Each entry names the MD slot it
// consumes and the inverse parser that builds the XML body.
const HYDRATE_MAP = [
  { md: 'STATE.md',         xml: 'STATE.xml',         fn: stateMdToXml },
  { md: 'ROADMAP.md',       xml: 'ROADMAP.xml',       fn: roadmapMdToXml },
  { md: 'DECISIONS.md',     xml: 'DECISIONS.xml',     fn: decisionsMdToXml },
  { md: 'TASK-REGISTRY.md', xml: 'TASK-REGISTRY.xml', fn: taskRegistryMdToXml },
  { md: 'REQUIREMENTS.md',  xml: 'REQUIREMENTS.xml',  fn: requirementsMdToXml },
];

/**
 * Hydrate a planning directory from sibling markdown files.
 *
 * For each slot in HYDRATE_MAP: if FOO.md exists in `fromDir` and (FOO.xml
 * does NOT exist in `planDir` OR options.force), parse the MD body into XML
 * and write it to planDir/FOO.xml. With `force`, the prior XML is first
 * archived under `.planning/archive/xml/<ts>/`. With `dryRun`, nothing is
 * written — the planned actions are returned for the caller to print.
 *
 * Returns { written, skipped, archived, results } where results is an array
 * of per-slot { slot, status: 'written'|'skipped'|'dry-run'|'missing-md',
 * reason?, destPath, xml? } objects.
 */
function hydrateFromMd(planDir, fromDir, options = {}) {
  const force  = options.force === true;
  const dryRun = options.dryRun === true;
  const results = [];
  let written = 0, skipped = 0, archived = 0;

  if (!dryRun) fs.mkdirSync(planDir, { recursive: true });

  let archiveDir = null;
  const ensureArchive = () => {
    if (archiveDir) return archiveDir;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    archiveDir = path.join(planDir, 'archive', 'xml', ts);
    if (!dryRun) fs.mkdirSync(archiveDir, { recursive: true });
    return archiveDir;
  };

  for (const slot of HYDRATE_MAP) {
    const mdPath  = path.join(fromDir, slot.md);
    const xmlPath = path.join(planDir, slot.xml);
    if (!fs.existsSync(mdPath)) {
      results.push({ slot: slot.md, status: 'missing-md', destPath: xmlPath });
      continue;
    }
    if (fs.existsSync(xmlPath) && !force) {
      skipped++;
      results.push({ slot: slot.md, status: 'skipped', reason: 'xml exists (use --force)', destPath: xmlPath });
      continue;
    }

    const mdRaw = fs.readFileSync(mdPath, 'utf8');
    const xmlOut = slot.fn(mdRaw);

    if (dryRun) {
      results.push({ slot: slot.md, status: 'dry-run', destPath: xmlPath, xml: xmlOut });
      continue;
    }

    if (fs.existsSync(xmlPath) && force) {
      const ad = ensureArchive();
      fs.copyFileSync(xmlPath, path.join(ad, slot.xml));
      archived++;
    }
    fs.writeFileSync(xmlPath, xmlOut);
    written++;
    results.push({ slot: slot.md, status: 'written', destPath: xmlPath });
  }

  return { written, skipped, archived, results };
}

module.exports = {
  compile,
  decompile,
  isGenerated,
  diffSink,
  hydrateFromMd,
  // Exported for tests / CLI --dry-run introspection
  stateMdToXml,
  roadmapMdToXml,
  decisionsMdToXml,
  taskRegistryMdToXml,
  requirementsMdToXml,
};
