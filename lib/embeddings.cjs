// lib/embeddings.cjs
//
// Optional embedding backend for `gad evolution similarity` and any future
// feature that wants semantic vectors. Pure lazy-require wrapper around
// transformers.js (`@huggingface/transformers`) so the zero-dep code paths
// stay fast and this module only pulls the heavy runtime in when actually
// used.
//
// Convention (see feedback_zero_deps_first.md): zero-dep first. This module
// is the optional second layer — it fails gracefully with an actionable
// "run X to install" message whenever the optional dep isn't present.
//
// Model cache: .gad/models/ under the project root by default. Never commit.
// Per-project, per-repo, always deletable. transformers.js has its own
// default cache (~/.cache/huggingface) — we override it via env.cacheDir.
//
// -----------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');

// Curated short list — keep it tight. First column is the HF repo id used
// with pipelines; second is a short tag the user can type; third is rough
// disk footprint; fourth is embed dimension.
const CURATED_MODELS = [
  { id: 'Xenova/all-MiniLM-L6-v2',          tag: 'minilm',    sizeMB:  90, dim: 384, task: 'feature-extraction', note: 'Default — fastest, good quality/size ratio' },
  { id: 'Xenova/bge-small-en-v1.5',         tag: 'bge-small', sizeMB: 133, dim: 384, task: 'feature-extraction', note: 'Slightly higher quality than MiniLM' },
  { id: 'Xenova/gte-small',                 tag: 'gte-small', sizeMB: 120, dim: 384, task: 'feature-extraction', note: 'Another strong 384-dim option' },
  { id: 'Xenova/paraphrase-MiniLM-L3-v2',   tag: 'minilm-l3', sizeMB:  60, dim: 384, task: 'feature-extraction', note: 'Smallest — when disk is tight' },
];

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';

function projectModelsDir(repoRoot) {
  // Models live under `.gad/models/` at the root of whatever repo this CLI
  // is running from. `repoRoot` defaults to process.cwd() in the CLI wiring.
  return path.join(repoRoot, '.gad', 'models');
}

function ensureModelsDir(repoRoot) {
  const dir = projectModelsDir(repoRoot);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Self-heal .gitignore so models never get committed
  const gi = path.join(dir, '.gitignore');
  if (!fs.existsSync(gi)) {
    fs.writeFileSync(gi, '# models are never committed — remove with `gad models remove <id>`\n*\n!.gitignore\n');
  }
  return dir;
}

function listInstalledModels(repoRoot) {
  const dir = projectModelsDir(repoRoot);
  if (!fs.existsSync(dir)) return [];
  const installed = [];
  // transformers.js stores models at <cacheDir>/<org>/<model>/...
  for (const org of fs.readdirSync(dir)) {
    if (org.startsWith('.')) continue;
    const orgDir = path.join(dir, org);
    if (!fs.statSync(orgDir).isDirectory()) continue;
    for (const model of fs.readdirSync(orgDir)) {
      const modelDir = path.join(orgDir, model);
      if (!fs.statSync(modelDir).isDirectory()) continue;
      // Only count as "installed" if there's a config.json (transformers.js signal)
      const hasConfig = fs.existsSync(path.join(modelDir, 'config.json'));
      if (hasConfig) {
        installed.push({
          id: `${org}/${model}`,
          path: modelDir,
          sizeBytes: dirSize(modelDir),
        });
      }
    }
  }
  return installed;
}

function dirSize(dir) {
  let total = 0;
  const walk = (p) => {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(p)) walk(path.join(p, name));
    } else {
      total += stat.size;
    }
  };
  walk(dir);
  return total;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function resolveModelId(nameOrTag) {
  if (!nameOrTag) return DEFAULT_MODEL;
  // Tag shortcut
  const curated = CURATED_MODELS.find((m) => m.tag === nameOrTag);
  if (curated) return curated.id;
  // Already a full id
  if (nameOrTag.includes('/')) return nameOrTag;
  // Unqualified — assume Xenova/ prefix
  return `Xenova/${nameOrTag}`;
}

// Lazy-require transformers.js. Returns the module or throws a friendly error
// the CLI can print directly.
async function loadTransformers(repoRoot) {
  let mod;
  try {
    mod = await import('@huggingface/transformers');
  } catch (err) {
    const msg = [
      '',
      '@huggingface/transformers is not installed.',
      '',
      'Install it once per gad checkout:',
      '  cd vendor/get-anything-done && npm install',
      '',
      'It is declared as an optionalDependencies so a failed install does not',
      'break the rest of the CLI. Rerun `npm install --include=optional` if it',
      'was skipped, or install directly:',
      '  cd vendor/get-anything-done && npm install @huggingface/transformers',
      '',
    ].join('\n');
    const e = new Error(msg);
    e.code = 'TRANSFORMERS_MISSING';
    throw e;
  }
  // Point the runtime cache at our project-local dir so downloads land there.
  if (mod.env) {
    mod.env.cacheDir = ensureModelsDir(repoRoot);
    // Disable remote loading of models already on disk — keeps it offline after install.
    // (transformers.js falls back to remote if a local file is missing, which is what we want
    //  during `gad models install` but not during routine scoring runs.)
    mod.env.allowRemoteModels = true;
    mod.env.localModelPath = mod.env.cacheDir;
  }
  return mod;
}

// ---------- embedding api ----------

async function getEmbedder(modelId, repoRoot) {
  const tf = await loadTransformers(repoRoot);
  // feature-extraction pipeline → per-token vectors; we mean-pool to one vector.
  const pipe = await tf.pipeline('feature-extraction', modelId);
  return async function embed(text) {
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    // Output is a Tensor with `.data` (Float32Array). Convert to plain array.
    return Array.from(output.data);
  };
}

function cosineSimDense(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embedCorpus(docs, modelId, repoRoot, onProgress) {
  const embed = await getEmbedder(modelId, repoRoot);
  const vectors = [];
  for (let i = 0; i < docs.length; i++) {
    // transformers.js MiniLM has a hard 256-ish token limit; truncate prose.
    // Use ~1500 chars (roughly 300 tokens) to stay well under the cap and
    // keep throughput sane. The embedding still captures topical signal.
    const text = (docs[i].text || '').slice(0, 1500);
    vectors.push(await embed(text));
    if (onProgress) onProgress(i + 1, docs.length);
  }
  return vectors;
}

function analyzeEmbeddingCorpus(docs, vectors, options = {}) {
  const threshold = options.threshold ?? 0.6;
  const n = docs.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
        continue;
      }
      const sim = cosineSimDense(vectors[i], vectors[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
      if (sim >= threshold) {
        pairs.push({ a: docs[i].id, b: docs[j].id, score: sim });
      }
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  return { ids: docs.map((d) => d.id), matrix, pairs, threshold, docCount: n };
}

module.exports = {
  CURATED_MODELS,
  DEFAULT_MODEL,
  projectModelsDir,
  ensureModelsDir,
  listInstalledModels,
  resolveModelId,
  loadTransformers,
  getEmbedder,
  embedCorpus,
  analyzeEmbeddingCorpus,
  cosineSimDense,
  formatBytes,
};
