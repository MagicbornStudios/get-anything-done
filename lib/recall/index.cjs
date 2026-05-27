'use strict';
/**
 * lib/recall/index.cjs — planning-grounded retrieval engine.
 *
 * Decision GLOBAL-D-450. Phase 284, task 284-04.
 *
 * Given a natural-language question, scans the planning corpus for the most
 * relevant artifacts and returns ranked snippets with source citations.
 *
 * Corpus: DECISIONS.xml, STATE.xml (state-log entries), handoffs/**\/*.md,
 *         notes/**\/*.md, tasks/*.json — all under a project .planning/ dir.
 *
 * Ranking: term-overlap score + recency bonus.  No external deps — only
 * node built-ins + fs.
 */

const fs   = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Tokenise a string into lower-case alphanum tokens. */
function tokenise(text) {
  return (text || '').toLowerCase().match(/[a-z0-9_-]+/g) || [];
}

/**
 * Score a document's content against a set of query tokens.
 * Returns a number ≥ 0: sum of per-token term-frequency hits, weighted by
 * token rarity across the query set.
 */
function termScore(queryTokens, docText) {
  if (!queryTokens.length || !docText) return 0;
  const lower = docText.toLowerCase();
  let score = 0;
  for (const tok of queryTokens) {
    // Count occurrences (capped at 5 to avoid single-keyword dominance)
    let idx = lower.indexOf(tok);
    let hits = 0;
    while (idx !== -1 && hits < 5) {
      hits++;
      idx = lower.indexOf(tok, idx + 1);
    }
    score += hits;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Corpus readers
// ---------------------------------------------------------------------------

/**
 * Parse <decision id="..."> blocks from DECISIONS.xml.
 * Returns Array<{ id, title, summary, raw }>.
 */
function readDecisions(planningDir) {
  const xmlPath = path.join(planningDir, 'DECISIONS.xml');
  if (!fs.existsSync(xmlPath)) return [];
  let xml;
  try { xml = fs.readFileSync(xmlPath, 'utf8'); } catch { return []; }

  const results = [];
  const blockRe = /<decision\s[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/decision>/g;
  let m;
  while ((m = blockRe.exec(xml)) !== null) {
    const id   = m[1];
    const body = m[2];
    const titleM   = body.match(/<title>([\s\S]*?)<\/title>/);
    const summaryM = body.match(/<summary>([\s\S]*?)<\/summary>/);
    const title   = titleM   ? titleM[1].trim()   : '';
    const summary = summaryM ? summaryM[1].trim() : '';
    const raw = `${title} ${summary}`;
    results.push({ id: `DECISION:${id}`, sourceId: id, type: 'decision', title, summary, raw, path: xmlPath });
  }
  return results;
}

/**
 * Parse <entry> blocks from the <state-log> section of STATE.xml.
 * Returns Array<{ id, raw }>.
 */
function readStateLog(planningDir) {
  const xmlPath = path.join(planningDir, 'STATE.xml');
  if (!fs.existsSync(xmlPath)) return [];
  let xml;
  try { xml = fs.readFileSync(xmlPath, 'utf8'); } catch { return []; }

  const results = [];
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
  let idx = 0;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const raw = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (raw.length > 10) {
      results.push({ id: `STATE-LOG:entry-${idx}`, sourceId: `STATE-LOG:entry-${idx}`, type: 'state-log', raw, path: xmlPath });
    }
    idx++;
  }
  return results;
}

/**
 * Read markdown handoff files from .planning/handoffs/**.
 * Returns Array<{ id, raw, path }>.
 */
function readHandoffs(planningDir) {
  const handoffsDir = path.join(planningDir, 'handoffs');
  if (!fs.existsSync(handoffsDir)) return [];
  return walkMarkdown(handoffsDir, 'HANDOFF', planningDir);
}

/**
 * Read markdown note files from .planning/notes/**.
 * Returns Array<{ id, raw, path }>.
 */
function readNotes(planningDir) {
  const notesDir = path.join(planningDir, 'notes');
  if (!fs.existsSync(notesDir)) return [];
  return walkMarkdown(notesDir, 'NOTE', planningDir);
}

/**
 * Walk a directory reading .md files.  Returns artifact array.
 */
function walkMarkdown(dir, typePrefix, planningDir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith('.md')) continue;
      try {
        const raw = fs.readFileSync(full, 'utf8');
        const relPath = path.relative(planningDir, full).replace(/\\/g, '/');
        const id = `${typePrefix}:${relPath}`;
        results.push({ id, sourceId: id, type: typePrefix.toLowerCase(), raw: raw.slice(0, 4000), path: full });
      } catch { /* skip unreadable */ }
    }
  }
  walk(dir);
  return results;
}

/**
 * Read task JSON files from .planning/tasks/*.json.
 * Returns Array<{ id, goal, raw }>.
 */
function readTasks(planningDir) {
  const tasksDir = path.join(planningDir, 'tasks');
  if (!fs.existsSync(tasksDir)) return [];
  let files;
  try { files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json')); }
  catch { return []; }

  const results = [];
  for (const file of files) {
    try {
      const obj = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf8'));
      const taskId = obj.id || file.replace('.json', '');
      const goal = obj.goal || obj.title || obj.summary || '';
      const keywords = obj.keywords || '';
      const raw = [goal, keywords, taskId].filter(Boolean).join(' ');
      if (raw.trim()) {
        results.push({
          id: `TASK:${taskId}`,
          sourceId: taskId,
          type: 'task',
          goal,
          status: obj.status,
          phase: obj.phase,
          raw,
          path: path.join(tasksDir, file),
        });
      }
    } catch { /* skip malformed */ }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Recency scoring
// ---------------------------------------------------------------------------

/**
 * Extract a date-like token from a path or id string (ISO prefix YYYY-MM-DD
 * or YYYY-MM-DDTHH) and return a small bonus in [0, 0.5].
 */
function recencyBonus(artifact) {
  const text = artifact.path + artifact.id;
  const m = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  try {
    const ts = new Date(`${m[0]}T00:00:00Z`).getTime();
    const ageDays = (Date.now() - ts) / 86400000;
    // Decays from 0.5 at ageDays=0 to ~0 at ageDays=180
    return Math.max(0, 0.5 * (1 - ageDays / 180));
  } catch { return 0; }
}

// ---------------------------------------------------------------------------
// Main retrieval
// ---------------------------------------------------------------------------

/**
 * Load all artifacts from the planning corpus.
 * @param {string} planningDir — absolute path to .planning/
 * @returns {Array<object>}
 */
function loadCorpus(planningDir) {
  return [
    ...readDecisions(planningDir),
    ...readStateLog(planningDir),
    ...readHandoffs(planningDir),
    ...readNotes(planningDir),
    ...readTasks(planningDir),
  ];
}

/**
 * Retrieve top-K artifacts relevant to `question`.
 *
 * @param {string} question   — natural-language query
 * @param {object} opts
 * @param {string}   opts.planningDir  — absolute path to the .planning/ directory
 * @param {number}  [opts.topK=6]      — how many results to return
 * @returns {Array<{id, sourceId, type, snippet, score, path}>}  ranked, best-first
 */
function retrieve(question, { planningDir, topK = 6 }) {
  if (!planningDir) throw new Error('recall.retrieve: planningDir is required');

  try {
    const { query: queryPlanningIndex } = require('../context-pack/planning-index.cjs');
    const indexed = queryPlanningIndex(question, {
      planningDir,
      repoRoot: path.dirname(planningDir),
      topK,
    });

    if (indexed.length > 0) {
      return indexed.map((artifact) => ({
        id: artifact.id,
        sourceId: artifact.sourceId,
        type: artifact.type,
        snippet: artifact.snippet,
        score: artifact.score,
        path: artifact.path,
      }));
    }
  } catch {
    // Fall through to the legacy scan path below.
  }

  const queryTokens = tokenise(question);
  if (queryTokens.length === 0) return [];

  const corpus = loadCorpus(planningDir);
  const scored = corpus.map(artifact => {
    const base  = termScore(queryTokens, artifact.raw);
    const bonus = base > 0 ? recencyBonus(artifact) : 0;
    return { ...artifact, _baseScore: base, score: base + bonus };
  });

  // Filter out zero-BASE-score hits (recency alone is not enough).
  // The recency bonus is only meaningful when at least one query term hit.
  return scored
    .filter(a => a._baseScore > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(a => ({
      id:       a.id,
      sourceId: a.sourceId,
      type:     a.type,
      snippet:  buildSnippet(a),
      score:    a.score,
      path:     a.path,
    }));
}

/**
 * Build a short human-readable snippet for display / prompt injection.
 */
function buildSnippet(artifact) {
  switch (artifact.type) {
    case 'decision':
      return `[${artifact.sourceId}] ${artifact.title}: ${artifact.summary}`.slice(0, 600);
    case 'task':
      return `[${artifact.sourceId}] (phase ${artifact.phase}, ${artifact.status}) ${artifact.goal}`.slice(0, 400);
    case 'state-log':
      return `[state-log] ${artifact.raw}`.slice(0, 400);
    default:
      // handoff / note — first meaningful line
      return `[${artifact.sourceId}] ${artifact.raw.split('\n').find(l => l.trim().length > 20) || artifact.raw}`.slice(0, 500);
  }
}

/**
 * Build a grounded LLM prompt from a question + retrieved artifacts.
 * The prompt instructs the LLM to answer ONLY from the provided context
 * and to CITE the source ids.
 *
 * @param {string} question
 * @param {Array<object>} artifacts   — from retrieve()
 * @returns {string} prompt
 */
function buildGroundedPrompt(question, artifacts) {
  const contextBlock = artifacts
    .map((a, i) => `--- Source ${i + 1}: ${a.sourceId} (${a.type}) ---\n${a.snippet}`)
    .join('\n\n');

  return [
    'You are a planning-grounded assistant for the GAD framework.',
    'Answer the question below using ONLY the provided planning context.',
    'Cite sources by their id (e.g. GLOBAL-D-438, 280-01, NOTE:notes/...) after each claim.',
    'If the context does not contain a clear answer, say "I cannot determine this from the provided planning context."',
    'Do NOT invent facts or speculate beyond the context.',
    '',
    '=== PLANNING CONTEXT ===',
    contextBlock,
    '',
    '=== QUESTION ===',
    question,
  ].join('\n');
}

module.exports = { retrieve, buildGroundedPrompt, loadCorpus, termScore, tokenise };
