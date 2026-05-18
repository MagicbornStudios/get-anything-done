'use strict';
/**
 * lib/datasets/extract.cjs — convert .planning/ content into typed JSONL datasets.
 *
 * Phase 244 scaffold landed decisions + tasks real. Phase 244-03 converts the
 * remaining 5 stubs to real: errors, phases, notes (with PII scrub), state-log,
 * commits (git log). Phase 244-04 adds derived datasets: dpo-pairs, sft-pairs,
 * intent-classification.
 *
 * Each extractor returns an array of plain objects. Every row carries:
 *   id, project_id, source_path, extracted_at, schema_version
 *
 * Schema spec: .planning/research/2026-05-18-planning-to-datasets-architecture.md
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync, spawnSync } = require('node:child_process');

const SCHEMA_VERSION = '1';

function nowIso() { return new Date().toISOString(); }

function decodeXmlEntities(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ─── Real: decisions ──────────────────────────────────────────────────────────

/**
 * Parse .planning/DECISIONS.xml into structured rows.
 * Uses the same regex pattern as lib/decisions-reader.cjs to avoid an
 * XML-parser dep.
 */
function extractDecisions(projectRoot, projectId) {
  const xmlPath = path.join(projectRoot, '.planning', 'DECISIONS.xml');
  if (!fs.existsSync(xmlPath)) return [];

  const content = fs.readFileSync(xmlPath, 'utf8');
  const rows = [];
  const decisionRe = /<decision\b([^>]*)>([\s\S]*?)<\/decision>/g;
  const extractedAt = nowIso();
  const sourcePath = path.relative(projectRoot, xmlPath).replace(/\\/g, '/');

  let m;
  while ((m = decisionRe.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const idMatch = attrs.match(/\bid="([^"]*)"/);
    const id = idMatch ? idMatch[1] : '';
    if (!id) continue;

    const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = body.match(/<summary>([\s\S]*?)<\/summary>/);
    const impactMatch = body.match(/<impact>([\s\S]*?)<\/impact>/);

    const references = [];
    const refsMatch = body.match(/<references>([\s\S]*?)<\/references>/);
    if (refsMatch) {
      const fileRe = /\bpath="([^"]*)"/g;
      let f;
      while ((f = fileRe.exec(refsMatch[1])) !== null) {
        if (f[1]) references.push(f[1]);
      }
    }

    rows.push({
      id,
      project_id: projectId,
      title: titleMatch ? titleMatch[1].trim() : '',
      summary: summaryMatch ? summaryMatch[1].trim() : '',
      impact: impactMatch ? impactMatch[1].trim() : '',
      references,
      source_path: sourcePath,
      extracted_at: extractedAt,
      schema_version: SCHEMA_VERSION,
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Real: tasks ──────────────────────────────────────────────────────────────

/**
 * Read .planning/tasks/*.json into structured rows.
 * Computes wall_clock_ms from created_at/updated_at delta for done tasks.
 */
function extractTasks(projectRoot, projectId) {
  const tasksDir = path.join(projectRoot, '.planning', 'tasks');
  if (!fs.existsSync(tasksDir)) return [];

  const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.json'));
  const rows = [];
  const extractedAt = nowIso();

  for (const file of files) {
    const fullPath = path.join(tasksDir, file);
    let task;
    try { task = JSON.parse(fs.readFileSync(fullPath, 'utf8')); }
    catch (_) { continue; }
    if (!task || !task.id) continue;

    let wallClockMs = null;
    if (task.status === 'done' && task.created_at && task.updated_at) {
      const start = Date.parse(task.created_at);
      const end = Date.parse(task.updated_at);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        wallClockMs = end - start;
      }
    }

    const keywords = typeof task.keywords === 'string'
      ? task.keywords.split(',').map((s) => s.trim()).filter(Boolean)
      : (Array.isArray(task.keywords) ? task.keywords : []);

    rows.push({
      id: task.id,
      project_id: projectId,
      phase: String(task.phase || ''),
      status: task.status || '',
      goal: task.goal || '',
      type: task.type || '',
      keywords,
      depends: Array.isArray(task.depends) ? task.depends : [],
      commands: Array.isArray(task.commands) ? task.commands : [],
      files: Array.isArray(task.files) ? task.files : [],
      skill: task.skill || '',
      agent_id: task.agent_id || '',
      runtime: task.runtime || '',
      created_at: task.created_at || '',
      updated_at: task.updated_at || '',
      wall_clock_ms: wallClockMs,
      source_path: path.relative(projectRoot, fullPath).replace(/\\/g, '/'),
      extracted_at: extractedAt,
      schema_version: SCHEMA_VERSION,
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Real: errors ─────────────────────────────────────────────────────────────

/**
 * Parse .planning/ERRORS-AND-ATTEMPTS.xml <entry> elements.
 * Same regex pattern as extractDecisions.
 */
function extractErrors(projectRoot, projectId) {
  const xmlPath = path.join(projectRoot, '.planning', 'ERRORS-AND-ATTEMPTS.xml');
  if (!fs.existsSync(xmlPath)) return [];

  const content = fs.readFileSync(xmlPath, 'utf8');
  const rows = [];
  const entryRe = /<entry\b([^>]*)>([\s\S]*?)<\/entry>/g;
  const extractedAt = nowIso();
  const sourcePath = path.relative(projectRoot, xmlPath).replace(/\\/g, '/');

  let m;
  while ((m = entryRe.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const idMatch = attrs.match(/\bid="([^"]*)"/);
    const id = idMatch ? idMatch[1] : '';
    if (!id) continue;

    const statusMatch = attrs.match(/\bstatus="([^"]*)"/);
    const phaseMatch = attrs.match(/\bphase="([^"]*)"/);
    const taskMatch = attrs.match(/\b(?:task|task_id)="([^"]*)"/);
    const dateMatch = attrs.match(/\bdate="([^"]*)"/);

    const summaryMatch = body.match(/<summary>([\s\S]*?)<\/summary>/);
    const contextMatch = body.match(/<context>([\s\S]*?)<\/context>/);
    const failureMatch = body.match(/<failure>([\s\S]*?)<\/failure>/);
    const ruleMatch = body.match(/<rule>([\s\S]*?)<\/rule>/);

    // Multiple <reference> children — collect all
    const references = [];
    const refRe = /<reference>([\s\S]*?)<\/reference>/g;
    let r;
    while ((r = refRe.exec(body)) !== null) {
      const txt = decodeXmlEntities(r[1]).trim();
      if (txt) references.push(txt);
    }

    rows.push({
      id,
      project_id: projectId,
      summary: summaryMatch ? decodeXmlEntities(summaryMatch[1]).trim() : '',
      context: contextMatch ? decodeXmlEntities(contextMatch[1]).trim() : '',
      failure: failureMatch ? decodeXmlEntities(failureMatch[1]).trim() : '',
      rule: ruleMatch ? decodeXmlEntities(ruleMatch[1]).trim() : '',
      references,
      status: statusMatch ? statusMatch[1] : '',
      phase: phaseMatch ? phaseMatch[1] : '',
      task_id: taskMatch ? taskMatch[1] : '',
      date: dateMatch ? dateMatch[1] : '',
      source_path: sourcePath,
      extracted_at: extractedAt,
      schema_version: SCHEMA_VERSION,
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Real: phases ─────────────────────────────────────────────────────────────

/**
 * Parse .planning/ROADMAP.xml <phase> elements.
 * <depends> is space/comma-separated text; split into array.
 */
function extractPhases(projectRoot, projectId) {
  const xmlPath = path.join(projectRoot, '.planning', 'ROADMAP.xml');
  if (!fs.existsSync(xmlPath)) return [];

  const content = fs.readFileSync(xmlPath, 'utf8');
  const rows = [];
  const phaseRe = /<phase\b([^>]*)>([\s\S]*?)<\/phase>/g;
  const extractedAt = nowIso();
  const sourcePath = path.relative(projectRoot, xmlPath).replace(/\\/g, '/');

  let m;
  while ((m = phaseRe.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const idMatch = attrs.match(/\bid="([^"]*)"/);
    const id = idMatch ? idMatch[1] : '';
    if (!id) continue;

    const milestoneMatch = attrs.match(/\bmilestone="([^"]*)"/);
    const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/);
    const goalMatch = body.match(/<goal>([\s\S]*?)<\/goal>/);
    const statusMatch = body.match(/<status>([\s\S]*?)<\/status>/);
    const dependsMatch = body.match(/<depends>([\s\S]*?)<\/depends>/);
    const plansMatch = body.match(/<plans>([\s\S]*?)<\/plans>/);
    const requirementsMatch = body.match(/<requirements>([\s\S]*?)<\/requirements>/);

    const depends = dependsMatch
      ? dependsMatch[1].split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
      : [];

    rows.push({
      id,
      project_id: projectId,
      title: titleMatch ? decodeXmlEntities(titleMatch[1]).trim() : '',
      goal: goalMatch ? decodeXmlEntities(goalMatch[1]).trim() : '',
      status: statusMatch ? statusMatch[1].trim() : '',
      depends,
      milestone: milestoneMatch ? milestoneMatch[1] : '',
      plans: plansMatch ? decodeXmlEntities(plansMatch[1]).trim() : '',
      requirements: requirementsMatch ? decodeXmlEntities(requirementsMatch[1]).trim() : '',
      source_path: sourcePath,
      extracted_at: extractedAt,
      schema_version: SCHEMA_VERSION,
    });
  }
  return rows.sort((a, b) => {
    // Numeric phase sort when possible, fall back to string
    const ai = parseInt(a.id, 10);
    const bi = parseInt(b.id, 10);
    if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
    return a.id.localeCompare(b.id);
  });
}

// ─── Real: notes (with PII scrub) ─────────────────────────────────────────────

const SECRET_PATTERNS = [
  // Generic api-key / token / secret / password / bearer key=value
  { re: /\b(api[_-]?key|token|secret|password|bearer)\s*[:=]\s*\S+/gi, replace: (m, k) => `${k}=<redacted-credential>` },
  // OpenAI-style sk- prefix
  { re: /\bsk-[a-zA-Z0-9]{20,}\b/g, replace: () => '<redacted-credential>' },
  // Slack bot tokens
  { re: /\bxoxb-[a-zA-Z0-9-]+\b/g, replace: () => '<redacted-credential>' },
  // GitHub personal-access-tokens
  { re: /\bghp_[a-zA-Z0-9]{36,}\b/g, replace: () => '<redacted-credential>' },
];

function scrubSecrets(text) {
  if (!text) return text;
  let out = text;
  for (const { re, replace } of SECRET_PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

/**
 * Parse YAML frontmatter at top of file. Returns { meta, body, hadFrontmatter }.
 * Minimal parser — only supports flat key: value pairs and inline arrays
 * `tags: [a, b]`. Sufficient for the simple frontmatter we use; no nested keys.
 */
function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: content, hadFrontmatter: false };

  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    meta[key] = val;
  }
  return { meta, body: m[2], hadFrontmatter: true };
}

function extractTitleFromBody(body) {
  const m = body.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : '';
}

function extractDateFromFilename(slug) {
  // Match leading YYYY-MM-DD prefix
  const m = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

/**
 * Walk .planning/notes/*.md. Returns one row per file.
 * Applies PII scrub to body + title before emitting.
 */
function extractNotes(projectRoot, projectId) {
  const notesDir = path.join(projectRoot, '.planning', 'notes');
  if (!fs.existsSync(notesDir)) return [];

  const files = fs.readdirSync(notesDir).filter((f) => f.endsWith('.md'));
  const rows = [];
  const extractedAt = nowIso();

  for (const file of files) {
    const fullPath = path.join(notesDir, file);
    let raw;
    try { raw = fs.readFileSync(fullPath, 'utf8'); }
    catch (_) { continue; }

    const slug = file.replace(/\.md$/, '');
    const { meta, body } = parseFrontmatter(raw);
    const titleFromBody = extractTitleFromBody(body);
    const date = (meta.date && String(meta.date)) || extractDateFromFilename(slug) || '';

    const tags = Array.isArray(meta.tags)
      ? meta.tags
      : (typeof meta.tags === 'string'
        ? meta.tags.split(/[\s,]+/).filter(Boolean)
        : []);

    let mtimeIso = '';
    try {
      const st = fs.statSync(fullPath);
      mtimeIso = st.mtime.toISOString();
    } catch (_) {}

    rows.push({
      slug,
      project_id: projectId,
      title: scrubSecrets(meta.title ? String(meta.title) : titleFromBody),
      body: scrubSecrets(body),
      date,
      tags,
      path_relative: path.relative(projectRoot, fullPath).replace(/\\/g, '/'),
      mtime_iso: mtimeIso,
      source_path: path.relative(projectRoot, fullPath).replace(/\\/g, '/'),
      extracted_at: extractedAt,
      schema_version: SCHEMA_VERSION,
    });
  }
  return rows.sort((a, b) => a.slug.localeCompare(b.slug));
}

// ─── Real: state-log ──────────────────────────────────────────────────────────

/**
 * Parse .planning/STATE.xml <state-log><entry> elements.
 * Entry shape: <entry agent="..." at="..." tags="...">summary</entry>.
 */
function extractStateLog(projectRoot, projectId) {
  const xmlPath = path.join(projectRoot, '.planning', 'STATE.xml');
  if (!fs.existsSync(xmlPath)) return [];

  const content = fs.readFileSync(xmlPath, 'utf8');
  const stateLogMatch = content.match(/<state-log>([\s\S]*?)<\/state-log>/);
  if (!stateLogMatch) return [];

  const rows = [];
  const entryRe = /<entry\b([^>]*)>([\s\S]*?)<\/entry>/g;
  const extractedAt = nowIso();
  const sourcePath = path.relative(projectRoot, xmlPath).replace(/\\/g, '/');

  let m;
  let idx = 0;
  while ((m = entryRe.exec(stateLogMatch[1])) !== null) {
    const attrs = m[1];
    const summary = decodeXmlEntities(m[2]).trim();
    const atMatch = attrs.match(/\bat="([^"]*)"/);
    const agentMatch = attrs.match(/\bagent="([^"]*)"/);
    const runtimeMatch = attrs.match(/\bruntime="([^"]*)"/);
    const tagsMatch = attrs.match(/\btags="([^"]*)"/);
    const ts = atMatch ? atMatch[1] : '';
    const tags = tagsMatch
      ? tagsMatch[1].split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
      : [];

    rows.push({
      id: `state-log-${idx}-${ts}`,
      project_id: projectId,
      ts,
      agent: agentMatch ? agentMatch[1] : '',
      runtime: runtimeMatch ? runtimeMatch[1] : '',
      tags,
      summary,
      source_path: sourcePath,
      extracted_at: extractedAt,
      schema_version: SCHEMA_VERSION,
    });
    idx++;
  }
  // Sort newest-first by ts (already the on-disk order; keep deterministic).
  return rows.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
}

// ─── Real: commits ────────────────────────────────────────────────────────────

const TASK_ID_RE = /\b(?:[A-Z]+-T-)?(\d{1,3})-(\d{2,3})\b/g;

function parseTaskIdsFromMessage(msg) {
  const ids = new Set();
  let m;
  TASK_ID_RE.lastIndex = 0;
  while ((m = TASK_ID_RE.exec(msg)) !== null) {
    // Normalize to <phase>-<n> form (without project prefix); preserve prefix
    // if present in original token.
    ids.add(m[0]);
  }
  return Array.from(ids);
}

/**
 * Walk last 1000 commits via `git log`. Build rows with parsed task ids and
 * --numstat-derived files_changed + insertions/deletions.
 *
 * Uses a unique record separator so commit messages with arbitrary content
 * (newlines, %, etc.) can't break parsing.
 */
function extractCommits(projectRoot, projectId, { limit = 1000 } = {}) {
  const RS = ''; // record separator
  const FS = ''; // field separator
  const extractedAt = nowIso();

  // Format: sha | author_name | author_email | committer_iso | subject | body
  const pretty = `${RS}%H${FS}%an${FS}%ae${FS}%cI${FS}%s${FS}%b`;

  // Use spawnSync (no shell tokenization) so the raw RS/FS control chars
  // survive into git's argv intact. execSync via cmd.exe would mangle them.
  let out = '';
  try {
    const res = spawnSync(
      'git',
      ['log', `-n`, String(limit), '--numstat', `--pretty=format:${pretty}`],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    if (res.status !== 0) return [];
    out = res.stdout || '';
  } catch (_) {
    return [];
  }
  // Silence the unused-import warning for execSync (kept for parity with
  // other libs that might import it).
  void execSync;

  const rows = [];
  // Split on RS; first chunk before any RS is empty
  const chunks = out.split(RS).filter((c) => c.length > 0);
  for (const chunk of chunks) {
    // chunk shape: HEADER\nnumstat-line\nnumstat-line\n...
    const newlineIdx = chunk.indexOf('\n');
    const header = newlineIdx === -1 ? chunk : chunk.slice(0, newlineIdx);
    const rest = newlineIdx === -1 ? '' : chunk.slice(newlineIdx + 1);

    const parts = header.split(FS);
    if (parts.length < 5) continue;
    const [sha, authorName, authorEmail, ts, subject, bodyRaw = ''] = parts;
    const message = bodyRaw ? `${subject}\n\n${bodyRaw}` : subject;

    const filesChanged = [];
    let insertions = 0;
    let deletions = 0;
    for (const line of rest.split('\n')) {
      if (!line.trim()) continue;
      // numstat: <added>\t<deleted>\t<path>  (binary = '-')
      const np = line.split('\t');
      if (np.length < 3) continue;
      const ins = np[0] === '-' ? 0 : parseInt(np[0], 10) || 0;
      const del = np[1] === '-' ? 0 : parseInt(np[1], 10) || 0;
      insertions += ins;
      deletions += del;
      filesChanged.push(np.slice(2).join('\t'));
    }

    rows.push({
      sha,
      project_id: projectId,
      ts,
      author: authorName + (authorEmail ? ` <${authorEmail}>` : ''),
      message,
      task_ids: parseTaskIdsFromMessage(message),
      files_changed: filesChanged,
      insertions,
      deletions,
      source_path: 'git',
      extracted_at: extractedAt,
      schema_version: SCHEMA_VERSION,
    });
  }
  return rows;
}

// ─── Derived: dpo-pairs ───────────────────────────────────────────────────────

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const out = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch (_) { /* skip malformed */ }
  }
  return out;
}

/**
 * Read errors.jsonl from <extractedDir>/raw/, emit DPO pairs from entries with
 * both failure + rule. {prompt, chosen, rejected}.
 * Note + commit synthesis stubbed for future phase.
 */
function deriveDpoPairs(extractedDir) {
  const errorsPath = path.join(extractedDir, 'raw', 'errors.jsonl');
  const errors = readJsonl(errorsPath);
  const rows = [];
  const extractedAt = nowIso();
  for (const e of errors) {
    if (!e.failure || !e.rule) continue;
    rows.push({
      id: `dpo-error-${e.id}`,
      project_id: e.project_id,
      prompt: e.context || e.summary || '',
      chosen: e.rule,
      rejected: e.failure,
      source_type: 'error',
      source_id: e.id,
      extracted_at: extractedAt,
      schema_version: SCHEMA_VERSION,
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Derived: sft-pairs ───────────────────────────────────────────────────────

/**
 * Read decisions.jsonl, emit SFT pairs from entries with summary + impact.
 * {prompt, completion}.
 * Note → SFT synthesis stubbed.
 */
function deriveSftPairs(extractedDir) {
  const decisionsPath = path.join(extractedDir, 'raw', 'decisions.jsonl');
  const decisions = readJsonl(decisionsPath);
  const rows = [];
  const extractedAt = nowIso();
  for (const d of decisions) {
    if (!d.summary || !d.impact) continue;
    const refsLine = (d.references && d.references.length)
      ? `\n\nReferences: ${d.references.join(', ')}`
      : '';
    rows.push({
      id: `sft-decision-${d.id}`,
      project_id: d.project_id,
      prompt: `Given impact: ${d.impact}${refsLine}\n\nWhat should we decide?`,
      completion: `${d.title ? d.title + '\n\n' : ''}${d.summary}`,
      source_type: 'decision',
      source_id: d.id,
      extracted_at: extractedAt,
      schema_version: SCHEMA_VERSION,
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Derived: intent-classification ───────────────────────────────────────────

/**
 * Read tasks.jsonl, emit text → label rows for every task with a non-empty
 * skill field.
 */
function deriveIntentClassification(extractedDir) {
  const tasksPath = path.join(extractedDir, 'raw', 'tasks.jsonl');
  const tasks = readJsonl(tasksPath);
  const rows = [];
  const extractedAt = nowIso();
  for (const t of tasks) {
    if (!t.skill || !t.goal) continue;
    rows.push({
      id: `intent-${t.id}`,
      project_id: t.project_id,
      text: t.goal,
      label: t.skill,
      task_id: t.id,
      source_type: 'task',
      extracted_at: extractedAt,
      schema_version: SCHEMA_VERSION,
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Writer ───────────────────────────────────────────────────────────────────

/**
 * Write rows[] as newline-delimited JSON. Creates parent dirs.
 * Deterministic field order via JSON.stringify with explicit key list when row
 * is shape-consistent (callers already produce consistent shapes).
 */
function writeJsonl(rows, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const lines = rows.map((r) => JSON.stringify(r));
  fs.writeFileSync(outPath, lines.join('\n') + (rows.length ? '\n' : ''));
  return { path: outPath, rowCount: rows.length };
}

module.exports = {
  SCHEMA_VERSION,
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
  // Test helpers
  _scrubSecrets: scrubSecrets,
  _parseFrontmatter: parseFrontmatter,
  _parseTaskIdsFromMessage: parseTaskIdsFromMessage,
};
