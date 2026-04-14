// lib/similarity.cjs
//
// Semantic similarity analysis for GAD skill candidates and proto-skills.
// Pure-JS, zero-dependency, fully offline. No API keys, no models.
//
// Two signals, aggregated into one score per pair:
//
//   1. TF-IDF cosine over tokenized prose (strips frontmatter + code fences,
//      lowercases, drops stopwords, drops terms <3 chars, drops pure digits).
//
//   2. Jaccard over cited file references (paths the SKILL.md body mentions in
//      backticks or bare, matched against common extensions + path shapes).
//
// Aggregate = 0.70 * cosine + 0.30 * jaccard. Weights chosen empirically —
// prose similarity is the stronger signal, but two skills citing the same
// files is a strong "these overlap" flag even when the prose diverges.
//
// The analyzer also reports, for every pair above the threshold, the top
// unique TF-IDF terms that appear in A but NOT B (and vice versa). That's
// the "context being lost if you merge" diff — the human uses it to decide
// whether a merge is lossless or needs re-integration.
//
// -----------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');

const STOPWORDS = new Set([
  'the','and','for','that','this','with','from','into','are','was','were','has',
  'have','had','not','but','any','all','one','two','use','using','used','can',
  'will','would','should','could','may','must','its','their','they','them','then',
  'than','which','what','when','where','who','why','how','out','our','you','your',
  'also','only','more','most','some','such','like','just','other','over','about',
  'after','before','between','because','while','each','per','via','both','too',
  'now','yet','off','there','these','those','here','been','being','does','did',
  'doing','done','make','made','makes','making','see','seen','set','sets','setting',
  'get','got','gets','getting','put','puts','putting','run','runs','running','ran',
  'add','adds','added','adding','new','old','one','two','three','first','last',
  'next','very','much','many','few','own','let','lets','etc',
]);

const FILE_EXT_RE = /\b[\w./-]+?\.(?:tsx?|jsx?|mdx?|cjs|mjs|xml|toml|json|yaml|yml|txt|sh|py|go|rs|html|css|scss)\b/gi;
const PATHY_RE = /(?:[\w.-]+\/){1,}[\w.-]+(?:\.[a-z]+)?/gi;

// ---------- public api ----------

function analyzeCorpus(docs, options = {}) {
  // docs: [{ id, text, files }]
  // returns: { ids, matrix, pairs, summary }
  const threshold = options.threshold ?? 0.6;

  const tokenized = docs.map((d) => tokenize(d.text));
  const df = buildDocFreq(tokenized);
  const vectors = tokenized.map((tokens) => tfidfVector(tokens, df, docs.length));

  const n = docs.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  const pairs = [];

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
        continue;
      }
      const cos = cosineSim(vectors[i], vectors[j]);
      const jac = jaccard(docs[i].files, docs[j].files);
      const score = 0.7 * cos + 0.3 * jac;
      matrix[i][j] = score;
      matrix[j][i] = score;
      if (score >= threshold) {
        pairs.push({
          a: docs[i].id,
          b: docs[j].id,
          score,
          cosine: cos,
          jaccard: jac,
          uniqueInA: topUniqueTerms(vectors[i], vectors[j], 12),
          uniqueInB: topUniqueTerms(vectors[j], vectors[i], 12),
          sharedFiles: intersect(docs[i].files, docs[j].files),
        });
      }
    }
  }

  pairs.sort((x, y) => y.score - x.score);

  return {
    ids: docs.map((d) => d.id),
    matrix,
    pairs,
    threshold,
    docCount: n,
  };
}

// Shedding: for each candidate/proto, find its single best match against a
// reference corpus of already-promoted skills. Anything scoring above the
// shed threshold is a stale candidate — the pattern is already covered.
function analyzeShedding(candidates, reference, options = {}) {
  const threshold = options.threshold ?? 0.55;
  const all = [...candidates, ...reference];
  const tokenized = all.map((d) => tokenize(d.text));
  const df = buildDocFreq(tokenized);
  const vectors = tokenized.map((tokens) => tfidfVector(tokens, df, all.length));

  const results = [];
  for (let i = 0; i < candidates.length; i++) {
    let best = { id: null, score: 0, cosine: 0, jaccard: 0 };
    for (let j = 0; j < reference.length; j++) {
      const cos = cosineSim(vectors[i], vectors[candidates.length + j]);
      const jac = jaccard(candidates[i].files, reference[j].files);
      const score = 0.7 * cos + 0.3 * jac;
      if (score > best.score) {
        best = { id: reference[j].id, score, cosine: cos, jaccard: jac };
      }
    }
    results.push({
      candidate: candidates[i].id,
      bestMatch: best.id,
      score: best.score,
      cosine: best.cosine,
      jaccard: best.jaccard,
      stale: best.score >= threshold,
    });
  }
  results.sort((a, b) => b.score - a.score);
  return { results, threshold };
}

// ---------- corpus loading ----------

function loadDocFromDir(dir, id) {
  // Concatenate SKILL.md + CANDIDATE.md + references/*.md for scoring.
  const parts = [];
  const filesCited = new Set();
  // Track the primary file path (SKILL.md preferred, CANDIDATE.md fallback)
  // so reports can print clickable paths the Cursor terminal can open.
  let primaryPath = null;
  const readIfExists = (p, isPrimary) => {
    if (!fs.existsSync(p)) return;
    const body = fs.readFileSync(p, 'utf8');
    parts.push(stripFrontmatter(body));
    for (const f of extractFileRefs(body)) filesCited.add(f);
    if (isPrimary && !primaryPath) primaryPath = p;
  };
  readIfExists(path.join(dir, 'SKILL.md'), true);
  readIfExists(path.join(dir, 'CANDIDATE.md'), true);
  const refsDir = path.join(dir, 'references');
  if (fs.existsSync(refsDir) && fs.statSync(refsDir).isDirectory()) {
    for (const name of fs.readdirSync(refsDir)) {
      if (name.endsWith('.md') || name.endsWith('.mdx')) {
        readIfExists(path.join(refsDir, name), false);
      }
    }
  }
  return {
    id,
    dir,
    primaryPath: primaryPath || dir,
    text: parts.join('\n\n'),
    files: Array.from(filesCited),
  };
}

// Build a single virtual "sprint" doc that represents the active project
// trajectory: open/recent tasks, recent decisions, current-sprint phase
// headers, and file refs cited inside all of the above. Used as a reference
// corpus so we can ask "has this candidate already been bypassed by the
// direction the project has actually gone?"
//
// Signal convention on the output: a candidate scoring LOW against the
// sprint corpus is a candidate the project has moved past. A candidate
// scoring HIGH is still inside the live trajectory.
function loadSprintCorpus(repoRoot, projectRoot) {
  const parts = [];
  const filesCited = new Set();
  const dir = projectRoot || repoRoot;
  const planning = path.join(dir, '.planning');

  // STATE.xml next-action and milestone
  const stateFile = path.join(planning, 'STATE.xml');
  if (fs.existsSync(stateFile)) {
    const body = fs.readFileSync(stateFile, 'utf8');
    const na = body.match(/<next-action>([\s\S]*?)<\/next-action>/);
    if (na) parts.push(na[1]);
    const ms = body.match(/<milestone>([\s\S]*?)<\/milestone>/);
    if (ms) parts.push(`milestone: ${ms[1]}`);
    for (const f of extractFileRefs(body)) filesCited.add(f);
  }

  // TASK-REGISTRY.xml — pull goal + progress text from in-progress + planned tasks
  const taskFile = path.join(planning, 'TASK-REGISTRY.xml');
  if (fs.existsSync(taskFile)) {
    const body = fs.readFileSync(taskFile, 'utf8');
    const taskRe = /<task[^>]*status="(in_progress|planned)"[^>]*>([\s\S]*?)<\/task>/gi;
    let m;
    while ((m = taskRe.exec(body)) !== null) {
      const block = m[2];
      const goal = block.match(/<goal>([\s\S]*?)<\/goal>/);
      const progress = block.match(/<progress>([\s\S]*?)<\/progress>/);
      const resolution = block.match(/<resolution>([\s\S]*?)<\/resolution>/);
      if (goal) parts.push(goal[1]);
      if (progress) parts.push(progress[1]);
      if (resolution) parts.push(resolution[1]);
      for (const f of extractFileRefs(block)) filesCited.add(f);
    }
    // Also pull the most recent N done tasks — recency signal
    const doneRe = /<task[^>]*status="done"[^>]*>([\s\S]*?)<\/task>/gi;
    const doneTasks = [];
    while ((m = doneRe.exec(body)) !== null) doneTasks.push(m[1]);
    // Last 50 done tasks — proxy for "recent"
    for (const t of doneTasks.slice(-50)) {
      const goal = t.match(/<goal>([\s\S]*?)<\/goal>/);
      const resolution = t.match(/<resolution>([\s\S]*?)<\/resolution>/);
      if (goal) parts.push(goal[1]);
      if (resolution) parts.push(resolution[1]);
      for (const f of extractFileRefs(t)) filesCited.add(f);
    }
  }

  // DECISIONS.xml — pull the most recent 30 decisions
  const decFile = path.join(planning, 'DECISIONS.xml');
  if (fs.existsSync(decFile)) {
    const body = fs.readFileSync(decFile, 'utf8');
    const decRe = /<decision[^>]*>([\s\S]*?)<\/decision>/gi;
    const all = [];
    let m;
    while ((m = decRe.exec(body)) !== null) all.push(m[1]);
    for (const d of all.slice(-30)) {
      parts.push(d);
      for (const f of extractFileRefs(d)) filesCited.add(f);
    }
  }

  // Current ROADMAP.xml phase goals (active + planned)
  const roadmapFile = path.join(planning, 'ROADMAP.xml');
  if (fs.existsSync(roadmapFile)) {
    const body = fs.readFileSync(roadmapFile, 'utf8');
    const phaseRe = /<phase[^>]*status="(planned|in_progress|active)"[^>]*>([\s\S]*?)<\/phase>/gi;
    let m;
    while ((m = phaseRe.exec(body)) !== null) {
      const goal = m[2].match(/<goal>([\s\S]*?)<\/goal>/);
      const title = m[2].match(/<title>([\s\S]*?)<\/title>/);
      if (title) parts.push(title[1]);
      if (goal) parts.push(goal[1]);
      for (const f of extractFileRefs(m[2])) filesCited.add(f);
    }
  }

  return {
    id: 'sprint:current',
    dir,
    primaryPath: stateFile,
    text: parts.join('\n\n'),
    files: Array.from(filesCited),
  };
}

function loadCorpusFromDirs(rootDirs) {
  // rootDirs: [{ kind, root }]
  // walks each root for subdirs containing a SKILL.md or CANDIDATE.md
  const docs = [];
  for (const { kind, root } of rootDirs) {
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root)) {
      const dir = path.join(root, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      const hasSkill = fs.existsSync(path.join(dir, 'SKILL.md'));
      const hasCand = fs.existsSync(path.join(dir, 'CANDIDATE.md'));
      if (!hasSkill && !hasCand) continue;
      const doc = loadDocFromDir(dir, `${kind}:${name}`);
      if (doc.text.trim()) docs.push(doc);
    }
  }
  return docs;
}

// ---------- tokenization + tfidf ----------

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n/, '');
}

function tokenize(text) {
  // Keep fenced content — CANDIDATE.md dumps the real payload inside ``` blocks
  // (raw task list, decisions, git log). Stripping fences collapses every
  // candidate to its identical section headers. Only strip the fence markers
  // themselves.
  const noFenceMarkers = text.replace(/```[a-z]*\n?/g, ' ').replace(/```/g, ' ');
  const words = noFenceMarkers.toLowerCase().split(/[^a-z0-9]+/);
  const out = [];
  for (const w of words) {
    if (!w) continue;
    if (w.length < 3) continue;
    if (/^\d+$/.test(w)) continue;
    if (STOPWORDS.has(w)) continue;
    out.push(w);
  }
  return out;
}

function buildDocFreq(tokenized) {
  const df = new Map();
  for (const tokens of tokenized) {
    const seen = new Set(tokens);
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  return df;
}

function tfidfVector(tokens, df, numDocs) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const vec = new Map();
  for (const [term, count] of tf) {
    const idf = Math.log((numDocs + 1) / ((df.get(term) || 0) + 1)) + 1;
    vec.set(term, (count / tokens.length) * idf);
  }
  return vec;
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [term, va] of a) {
    na += va * va;
    const vb = b.get(term);
    if (vb) dot += va * vb;
  }
  for (const [, vb] of b) nb += vb * vb;
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function topUniqueTerms(vecA, vecB, k) {
  const scored = [];
  for (const [term, weight] of vecA) {
    if (!vecB.has(term)) scored.push({ term, weight });
  }
  scored.sort((x, y) => y.weight - x.weight);
  return scored.slice(0, k).map((s) => s.term);
}

// ---------- file-ref extraction ----------

function extractFileRefs(text) {
  const found = new Set();
  // Explicit extensions (strong signal)
  let m;
  const re1 = new RegExp(FILE_EXT_RE.source, 'gi');
  while ((m = re1.exec(text)) !== null) {
    const f = m[0].replace(/^[`'"(]+/, '').replace(/[`'"),.;]+$/, '');
    if (f.length < 80) found.add(normalizeFile(f));
  }
  // Pathy tokens (weaker) — only count if they survive normalization with 2+ segments
  const re2 = new RegExp(PATHY_RE.source, 'gi');
  while ((m = re2.exec(text)) !== null) {
    const f = normalizeFile(m[0]);
    if (f && f.includes('/') && f.length < 80) found.add(f);
  }
  return found;
}

function normalizeFile(raw) {
  let f = raw.trim().toLowerCase();
  f = f.replace(/^[`'"(]+/, '').replace(/[`'"),.;]+$/, '');
  // strip line suffixes like "foo.ts:42"
  f = f.replace(/:\d+$/, '');
  // collapse leading ./
  f = f.replace(/^\.\//, '');
  return f;
}

function jaccard(a, b) {
  if (!a.length && !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function intersect(a, b) {
  const B = new Set(b);
  return a.filter((x) => B.has(x));
}

// ---------- formatting ----------

function formatMatrixMarkdown(analysis) {
  const { ids, matrix } = analysis;
  const labels = ids.map((id, i) => `${i + 1}.`);
  const header = '|     | ' + labels.join(' | ') + ' |';
  const sep = '| --- |' + labels.map(() => ' --- |').join('');
  const rows = ids.map((id, i) => {
    const cells = matrix[i].map((v, j) => (i === j ? '—' : v.toFixed(2)));
    return `| ${i + 1}. ${id.slice(0, 40)} | ` + cells.join(' | ') + ' |';
  });
  const legend = ids.map((id, i) => `  ${i + 1}. ${id}`).join('\n');
  return [header, sep, ...rows, '', 'Legend:', legend].join('\n');
}

function formatPairReport(pair, pathMap, repoRoot) {
  const lines = [];
  const shortA = pair.a.split(':').pop();
  const shortB = pair.b.split(':').pop();
  lines.push(`─── ${shortA}  ⇆  ${shortB}   score=${pair.score.toFixed(3)} (cos=${pair.cosine.toFixed(3)} jac=${pair.jaccard.toFixed(3)})`);
  if (pathMap) {
    const pa = pathMap.get(pair.a);
    const pb = pathMap.get(pair.b);
    if (pa) lines.push(`  ${relPath(pa, repoRoot)}`);
    if (pb) lines.push(`  ${relPath(pb, repoRoot)}`);
  }
  lines.push(`  unique in ${shortA}:`);
  lines.push(`    ${pair.uniqueInA.join(', ') || '(none)'}`);
  lines.push(`  unique in ${shortB}:`);
  lines.push(`    ${pair.uniqueInB.join(', ') || '(none)'}`);
  if (pair.sharedFiles.length) {
    lines.push(`  shared file refs (${pair.sharedFiles.length}):`);
    for (const f of pair.sharedFiles.slice(0, 6)) lines.push(`    ${f}`);
    if (pair.sharedFiles.length > 6) lines.push(`    ... +${pair.sharedFiles.length - 6} more`);
  }
  return lines.join('\n');
}

function formatSheddingReport(shed, pathMap, repoRoot) {
  const lines = [];
  lines.push(`Shedding analysis — threshold ${shed.threshold.toFixed(2)}`);
  lines.push('');
  const stale = shed.results.filter((r) => r.stale);
  const fresh = shed.results.filter((r) => !r.stale);
  lines.push(`Stale candidates (${stale.length}): pattern likely already covered by an existing skill`);
  for (const r of stale) {
    lines.push(`  [${r.score.toFixed(3)}] ${r.candidate}`);
    if (pathMap) {
      const pc = pathMap.get(r.candidate);
      if (pc) lines.push(`           ${relPath(pc, repoRoot)}`);
    }
    lines.push(`           → best match: ${r.bestMatch}`);
    if (pathMap && r.bestMatch) {
      const pm = pathMap.get(r.bestMatch);
      if (pm) lines.push(`                       ${relPath(pm, repoRoot)}`);
    }
  }
  lines.push('');
  lines.push(`Fresh candidates (${fresh.length}): no strong match against reference corpus`);
  for (const r of fresh) {
    lines.push(`  [${r.score.toFixed(3)}] ${r.candidate}${r.bestMatch ? ` — closest: ${r.bestMatch}` : ''}`);
    if (pathMap) {
      const pc = pathMap.get(r.candidate);
      if (pc) lines.push(`           ${relPath(pc, repoRoot)}`);
    }
  }
  return lines.join('\n');
}

function relPath(abs, repoRoot) {
  if (!abs) return '';
  if (!repoRoot) return abs;
  const rel = path.relative(repoRoot, abs);
  return rel.split(path.sep).join('/');
}

function buildPathMap(docs) {
  const map = new Map();
  for (const d of docs) map.set(d.id, d.primaryPath || d.dir);
  return map;
}

module.exports = {
  analyzeCorpus,
  analyzeShedding,
  loadDocFromDir,
  loadCorpusFromDirs,
  loadSprintCorpus,
  formatMatrixMarkdown,
  formatPairReport,
  formatSheddingReport,
  buildPathMap,
  tokenize,
  extractFileRefs,
};
