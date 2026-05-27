'use strict';
/**
 * lib/context-pack/planning-index.cjs
 *
 * Low-latency planning-corpus index for decisions, state-log, handoffs,
 * notes, tasks, and planning-related git commits.
 *
 * The index is non-LLM: MiniSearch BM25 over a compact planning corpus.
 * It is persisted under .planning/context-index/planning-index.json and
 * refreshed when the planning corpus signature changes.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

let MiniSearch = null;

function loadMiniSearch() {
  if (MiniSearch) return MiniSearch;
  try {
    MiniSearch = require('minisearch');
    if (MiniSearch && MiniSearch.default) MiniSearch = MiniSearch.default;
    return MiniSearch;
  } catch (err) {
    throw new Error(`minisearch not installed. Run: npm install minisearch (in vendor/get-anything-done). Error: ${err.message}`);
  }
}

function toPosix(filePath) {
  return String(filePath || '').split(path.sep).join('/');
}

function cleanText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMeaningfulLine(text) {
  const lines = String(text || '').split('\n');
  for (const line of lines) {
    const trimmed = line.replace(/^#+\s*/, '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function snippet(text, limit = 220) {
  const cleaned = cleanText(text);
  if (!cleaned) return '';
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}…` : cleaned;
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function listFilesRecursive(rootDir, predicate) {
  const results = [];

  function walk(currentDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && (!predicate || predicate(fullPath))) {
        results.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return results;
}

function parseAttrs(attrs) {
  const out = {};
  const attrRe = /([A-Za-z_:][A-Za-z0-9_:-]*)="([^"]*)"/g;
  let match;
  while ((match = attrRe.exec(attrs)) !== null) {
    out[match[1]] = match[2];
  }
  return out;
}

function extractTags(text) {
  const tags = new Set();
  const patterns = [
    /(?:GLOBAL-[DPT]-\d+(?:-\d+)*)/gi,
    /(?:GAD-[DPT]-\d+(?:-\d+)*)/gi,
    /(?:NOTE-[A-Za-z0-9._/-]+)/gi,
    /(?:\bphase\s+\d+(?:\.\d+)?)/gi,
    /(?:\btask\s+\d{1,4}-\d{2}(?:-\d{2})?)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      tags.add(cleanText(match[0]).toLowerCase());
    }
  }

  return [...tags];
}

function readDecisionDocs(planningDir) {
  const xmlPath = path.join(planningDir, 'DECISIONS.xml');
  if (!fs.existsSync(xmlPath)) return [];
  const xml = safeRead(xmlPath);
  if (!xml) return [];

  const docs = [];
  const blockRe = /<decision\s+([^>]*)>([\s\S]*?)<\/decision>/g;
  let match;
  while ((match = blockRe.exec(xml)) !== null) {
    const attrs = parseAttrs(match[1]);
    const body = match[2];
    const id = attrs.id || `decision-${docs.length + 1}`;
    const title = cleanText((body.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const summary = cleanText((body.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || '');
    const impact = cleanText((body.match(/<impact>([\s\S]*?)<\/impact>/) || [])[1] || '');
    const raw = [title, summary, impact].filter(Boolean).join(' ');

    docs.push({
      id: `decision:${id}`,
      sourceId: id,
      type: 'decision',
      title,
      summary,
      body: raw,
      snippet: snippet(raw, 260),
      path: toPosix(path.relative(planningDir, xmlPath)),
      tags: extractTags(raw).join(' '),
      ts: attrs.updated_at || attrs.date || null,
    });
  }
  return docs;
}

function readStateDocs(planningDir) {
  const xmlPath = path.join(planningDir, 'STATE.xml');
  if (!fs.existsSync(xmlPath)) return [];
  const xml = safeRead(xmlPath);
  if (!xml) return [];

  const docs = [];
  const entryRe = /<entry\b([^>]*)>([\s\S]*?)<\/entry>/g;
  let match;
  let index = 0;
  while ((match = entryRe.exec(xml)) !== null) {
    const attrs = parseAttrs(match[1]);
    const raw = cleanText(match[2].replace(/<[^>]+>/g, ' '));
    if (!raw) continue;

    docs.push({
      id: `state-log:entry-${index}`,
      sourceId: attrs.id || attrs.tags || `entry-${index}`,
      type: 'state-log',
      body: raw,
      snippet: snippet(raw, 260),
      path: toPosix(path.relative(planningDir, xmlPath)),
      tags: extractTags(`${attrs.tags || ''} ${raw}`).join(' '),
      ts: attrs.at || attrs.ts || null,
    });
    index++;
  }
  return docs;
}

function readMarkdownDocs(rootDir, type, prefix, planningDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = listFilesRecursive(rootDir, (filePath) => filePath.toLowerCase().endsWith('.md'));
  const docs = [];

  for (const filePath of files) {
    const raw = safeRead(filePath);
    if (!raw) continue;
    const relPath = toPosix(path.relative(planningDir, filePath));
    const id = `${prefix}:${relPath}`;

    docs.push({
      id,
      sourceId: relPath,
      type,
      title: firstMeaningfulLine(raw),
      body: raw.slice(0, 8000),
      snippet: snippet(firstMeaningfulLine(raw) || raw, 260),
      path: relPath,
      tags: extractTags(raw).join(' '),
      ts: safeStat(filePath)?.mtime?.toISOString?.() || null,
    });
  }

  return docs;
}

function readTaskDocs(planningDir) {
  const tasksDir = path.join(planningDir, 'tasks');
  if (!fs.existsSync(tasksDir)) return [];
  let files;
  try {
    files = fs.readdirSync(tasksDir).filter((file) => file.endsWith('.json'));
  } catch {
    return [];
  }

  const docs = [];
  for (const file of files) {
    const filePath = path.join(tasksDir, file);
    let obj;
    try {
      obj = JSON.parse(safeRead(filePath));
    } catch {
      continue;
    }

    const taskId = obj.id || file.replace(/\.json$/i, '');
    const goal = cleanText(obj.goal || obj.title || obj.summary || '');
    const details = [
      goal,
      cleanText(obj.summary || ''),
      cleanText(obj.type || ''),
      cleanText((obj.files || []).join(' ')),
      cleanText((obj.commands || []).join(' ')),
      cleanText((obj.depends || []).join(' ')),
      cleanText(obj.status || ''),
    ].filter(Boolean).join(' ');

    docs.push({
      id: `task:${taskId}`,
      sourceId: taskId,
      type: 'task',
      title: obj.title || goal,
      goal,
      status: obj.status || '',
      phase: obj.phase || '',
      body: details,
      snippet: snippet(`[${taskId}] ${goal || obj.summary || obj.title || ''}`, 260),
      path: toPosix(path.relative(planningDir, filePath)),
      tags: extractTags(details).join(' '),
      ts: safeStat(filePath)?.mtime?.toISOString?.() || null,
    });
  }
  return docs;
}

function readCommitDocs(repoRoot) {
  if (!repoRoot || !fs.existsSync(path.join(repoRoot, '.git'))) return [];

  let output = '';
  try {
    output = execFileSync(
      'git',
      [
        '-C',
        repoRoot,
        'log',
        '--max-count=250',
        '--date=iso-strict',
        '--pretty=format:%H%x1f%ad%x1f%s%x1f%b%x1e',
        '--',
        '.planning',
      ],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch {
    try {
      output = execFileSync(
        'git',
        [
          '-C',
          repoRoot,
          'log',
          '--max-count=120',
          '--date=iso-strict',
          '--pretty=format:%H%x1f%ad%x1f%s%x1f%b%x1e',
        ],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch {
      return [];
    }
  }

  const docs = [];
  for (const record of output.split('\x1e')) {
    if (!record.trim()) continue;
    const [sha = '', date = '', subject = '', body = ''] = record.split('\x1f');
    if (!sha) continue;
    const commitText = cleanText([subject, body].filter(Boolean).join(' '));
    if (!commitText) continue;

    docs.push({
      id: `commit:${sha.slice(0, 12)}`,
      sourceId: sha.slice(0, 12),
      type: 'commit',
      title: subject.trim(),
      body: commitText,
      snippet: snippet(`[${sha.slice(0, 12)}] ${subject.trim()}`, 260),
      path: `git:${sha.slice(0, 12)}`,
      tags: extractTags(commitText).join(' '),
      ts: date || null,
    });
  }

  return docs;
}

function planningIndexPath(planningDir) {
  return path.join(planningDir, 'context-index', 'planning-index.json');
}

function inventoryPlanningCorpus(planningDir, repoRoot) {
  const inventory = [];

  function addStat(filePath, kind) {
    const stat = safeStat(filePath);
    if (!stat) return;
    inventory.push({
      kind,
      path: toPosix(path.relative(planningDir, filePath)),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    });
  }

  addStat(path.join(planningDir, 'DECISIONS.xml'), 'decisions');
  addStat(path.join(planningDir, 'STATE.xml'), 'state');

  const taskDir = path.join(planningDir, 'tasks');
  if (fs.existsSync(taskDir)) {
    for (const filePath of listFilesRecursive(taskDir, (candidate) => candidate.toLowerCase().endsWith('.json'))) {
      addStat(filePath, 'task');
    }
  }

  for (const dirName of ['handoffs', 'notes']) {
    const dir = path.join(planningDir, dirName);
    if (!fs.existsSync(dir)) continue;
    for (const filePath of listFilesRecursive(dir, (candidate) => candidate.toLowerCase().endsWith('.md'))) {
      addStat(filePath, dirName);
    }
  }

  if (repoRoot && fs.existsSync(path.join(repoRoot, '.git'))) {
    try {
      const head = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      inventory.push({ kind: 'git-head', path: 'git:HEAD', size: 0, mtimeMs: 0, head });
    } catch {
      // ignore
    }
  }

  inventory.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.path.localeCompare(b.path);
  });

  return inventory;
}

function buildSearch() {
  const MS = loadMiniSearch();
  return new MS({
    fields: ['title', 'summary', 'goal', 'body', 'snippet', 'path', 'tags'],
    storeFields: ['id', 'sourceId', 'type', 'title', 'summary', 'goal', 'body', 'snippet', 'path', 'tags', 'status', 'phase', 'ts'],
    searchOptions: {
      boost: {
        title: 3,
        summary: 2,
        goal: 2,
        tags: 1.5,
        body: 1,
        snippet: 0.8,
        path: 0.6,
      },
      prefix: true,
      fuzzy: 0.2,
    },
  });
}

function buildDocs(planningDir, repoRoot) {
  return [
    ...readDecisionDocs(planningDir),
    ...readStateDocs(planningDir),
    ...readTaskDocs(planningDir),
    ...readMarkdownDocs(path.join(planningDir, 'handoffs'), 'handoff', 'handoff', planningDir),
    ...readMarkdownDocs(path.join(planningDir, 'notes'), 'note', 'note', planningDir),
    ...readCommitDocs(repoRoot),
  ];
}

function buildIndex(planningDir, { repoRoot = path.dirname(planningDir) } = {}) {
  if (!planningDir) throw new Error('buildIndex: planningDir is required');
  const absPlanningDir = path.resolve(planningDir);
  const absRepoRoot = path.resolve(repoRoot || path.dirname(absPlanningDir));

  const docs = buildDocs(absPlanningDir, absRepoRoot);
  const inventory = inventoryPlanningCorpus(absPlanningDir, absRepoRoot);
  const signature = crypto.createHash('sha1').update(JSON.stringify(inventory)).digest('hex');

  const search = buildSearch();
  if (docs.length > 0) {
    search.addAll(docs);
  }

  const indexPath = planningIndexPath(absPlanningDir);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify({
    signature,
    generatedAt: new Date().toISOString(),
    corpusSize: docs.length,
    index: JSON.stringify(search.toJSON()),
  }, null, 2), 'utf8');

  return { count: docs.length, signature, indexPath };
}

const indexCache = new Map();

function loadIndex(planningDir, { repoRoot = path.dirname(planningDir), forceRebuild = false } = {}) {
  if (!planningDir) throw new Error('loadIndex: planningDir is required');
  const absPlanningDir = path.resolve(planningDir);
  const absRepoRoot = path.resolve(repoRoot || path.dirname(absPlanningDir));
  const indexPath = planningIndexPath(absPlanningDir);
  const inventory = inventoryPlanningCorpus(absPlanningDir, absRepoRoot);
  const signature = crypto.createHash('sha1').update(JSON.stringify(inventory)).digest('hex');

  if (!forceRebuild && indexCache.has(indexPath)) {
    const cached = indexCache.get(indexPath);
    if (cached.signature === signature) return cached;
  }

  let payload = null;
  if (!forceRebuild && fs.existsSync(indexPath)) {
    try {
      payload = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch {
      payload = null;
    }
  }

  if (!forceRebuild && payload && payload.signature === signature && payload.index) {
    const MS = loadMiniSearch();
    const search = MS.loadJSON(payload.index, {
      fields: ['title', 'summary', 'goal', 'body', 'snippet', 'path', 'tags'],
      storeFields: ['id', 'sourceId', 'type', 'title', 'summary', 'goal', 'body', 'snippet', 'path', 'tags', 'status', 'phase', 'ts'],
    });
    const loaded = { signature, indexPath, search, corpusSize: payload.corpusSize || 0, generatedAt: payload.generatedAt || null };
    indexCache.set(indexPath, loaded);
    return loaded;
  }

  const built = buildIndex(absPlanningDir, { repoRoot: absRepoRoot });
  const MS = loadMiniSearch();
  const payloadAfterBuild = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const search = MS.loadJSON(payloadAfterBuild.index, {
    fields: ['title', 'summary', 'goal', 'body', 'snippet', 'path', 'tags'],
    storeFields: ['id', 'sourceId', 'type', 'title', 'summary', 'goal', 'body', 'snippet', 'path', 'tags', 'status', 'phase', 'ts'],
  });
  const loaded = {
    signature: built.signature,
    indexPath,
    search,
    corpusSize: built.count,
    generatedAt: payloadAfterBuild.generatedAt || new Date().toISOString(),
  };
  indexCache.set(indexPath, loaded);
  return loaded;
}

function normalizeQueryText(terms) {
  if (Array.isArray(terms)) return cleanText(terms.join(' '));
  return cleanText(terms);
}

function toResult(doc) {
  const snippetText = doc.snippet || snippet(doc.body || doc.summary || doc.goal || doc.title || '', 260);
  return {
    id: doc.id,
    sourceId: doc.sourceId || doc.id,
    type: doc.type,
    snippet: snippetText,
    score: typeof doc.score === 'number' ? doc.score : 0,
    path: doc.path || '',
  };
}

function query(terms, opts = {}) {
  const queryText = normalizeQueryText(terms);
  if (!queryText) return [];

  const planningDir = opts.planningDir || path.join(opts.repoRoot || process.cwd(), '.planning');
  const repoRoot = opts.repoRoot || path.dirname(planningDir);
  const topK = Math.max(1, parseInt(String(opts.topK || 10), 10) || 10);

  let index;
  try {
    index = loadIndex(planningDir, { repoRoot, forceRebuild: !!opts.forceRebuild });
  } catch {
    return [];
  }

  let hits = [];
  try {
    hits = index.search.search(queryText, { prefix: true, fuzzy: 0.2 });
  } catch {
    return [];
  }

  if (Array.isArray(opts.types) && opts.types.length > 0) {
    const typeSet = new Set(opts.types);
    hits = hits.filter((hit) => typeSet.has(hit.type));
  }

  return hits.slice(0, topK).map(toResult);
}

function formatResult(result, rank) {
  const rankLabel = String(rank + 1).padStart(2, '0');
  const score = Number.isFinite(result.score) ? result.score.toFixed(2) : '0.00';
  const pathLabel = result.path ? ` ${result.path}` : '';
  return `${rankLabel}. [${result.type}] ${result.sourceId} (${score})${pathLabel}\n    ${result.snippet || ''}`;
}

function runCli(argv = process.argv.slice(2)) {
  const args = { query: '', projectRoot: process.cwd(), topK: 10, json: false, forceRebuild: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--query' || arg === '-q') {
      args.query = argv[++i] || '';
    } else if (arg === '--project-root') {
      args.projectRoot = argv[++i] || process.cwd();
    } else if (arg === '--top' || arg === '--topK') {
      args.topK = parseInt(argv[++i] || '10', 10) || 10;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--force-rebuild') {
      args.forceRebuild = true;
    } else if (!arg.startsWith('-') && !args.query) {
      args.query = arg;
    }
  }

  if (!args.query) {
    process.stderr.write('Usage: node planning-index.cjs --query "<terms>" [--project-root <path>] [--topK <n>] [--json]\n');
    process.exitCode = 1;
    return [];
  }

  const results = query(args.query, {
    repoRoot: args.projectRoot,
    topK: args.topK,
    forceRebuild: args.forceRebuild,
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ query: args.query, results }, null, 2)}\n`);
  } else if (results.length === 0) {
    process.stdout.write(`No planning artifacts found for "${args.query}".\n`);
  } else {
    process.stdout.write(`Planning index results for "${args.query}":\n`);
    results.forEach((result, index) => {
      process.stdout.write(`${formatResult(result, index)}\n`);
    });
  }

  return results;
}

if (require.main === module) {
  runCli();
}

module.exports = {
  buildIndex,
  loadIndex,
  query,
  runCli,
  planningIndexPath,
};
