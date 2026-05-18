'use strict';
/**
 * lib/handoffs/classifier.cjs — LogReg handoff classifier (task 246-07)
 *
 * Predicts outcome of a handoff (success | failure | in_progress) using
 * TF-IDF features + logistic regression. Pure JS, zero deps.
 *
 * Exports:
 *   train(samples)            — fit model; samples = [{text, label}]
 *   classify(text)            — {label, confidence, scores}
 *   trainFromFs(closedDir)    — build training set from .planning/handoffs/closed/
 *   DEFAULT_MODEL             — pre-fitted stub (sufficient for smoke tests)
 */

const fs   = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// TF-IDF helpers
// ---------------------------------------------------------------------------

const STOP = new Set(['a','an','the','and','or','but','in','on','at','to','for',
  'of','with','by','from','as','is','was','are','were','be','been','has','have',
  'had','will','would','could','should','do','did','not','no','this','that',
  'it','its','we','i','you','they','he','she','all','also','can','if','so',
  'then','than','just','up','out','into','about','after','before','which','who',
  'what','how','when','where','phase','task','handoff','global','gad','work',
  'run','make','get','set','add','via','per','more','new','now','see','use']);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function termFreq(tokens) {
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const total = tokens.length || 1;
  for (const k in tf) tf[k] /= total;
  return tf;
}

function buildVocab(samples) {
  const df = {};
  for (const { text } of samples) {
    const unique = new Set(tokenize(text));
    for (const w of unique) df[w] = (df[w] || 0) + 1;
  }
  // Keep top 300 by document frequency (skip hapax)
  const N = samples.length || 1;
  return Object.entries(df)
    .filter(([, c]) => c >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 300)
    .map(([w, c]) => ({ w, idf: Math.log((N + 1) / (c + 1)) + 1 }));
}

function vectorize(text, vocab) {
  const tf = termFreq(tokenize(text));
  const vec = vocab.map(({ w, idf }) => (tf[w] || 0) * idf);
  // L2-normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

// ---------------------------------------------------------------------------
// Logistic Regression — binary OvR (one vs rest per class)
// ---------------------------------------------------------------------------

const LABELS = ['success', 'failure', 'in_progress'];

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Train one binary logistic classifier (OvR).
 * Returns weight vector w (length = vocab + 1 bias).
 */
function trainBinary(X, y, lr = 0.1, epochs = 200) {
  const dim = X[0].length + 1; // +1 bias
  const w = new Array(dim).fill(0);
  for (let ep = 0; ep < epochs; ep++) {
    for (let i = 0; i < X.length; i++) {
      const xi = [...X[i], 1]; // append bias
      const pred = sigmoid(dot(w, xi));
      const err = pred - y[i];
      for (let j = 0; j < dim; j++) w[j] -= lr * err * xi[j];
    }
  }
  return w;
}

/**
 * Train a multi-class LogReg via OvR.
 * @param {Array<{text:string, label:string}>} samples
 * @returns {{ vocab, weights }} — serializable model
 */
function train(samples) {
  if (!samples || samples.length < 2) {
    // Return untrained stub
    return { vocab: [], weights: LABELS.map(() => []) };
  }
  const vocab = buildVocab(samples);
  const X = samples.map(({ text }) => vectorize(text, vocab));

  const weights = LABELS.map((lbl) => {
    const y = samples.map((s) => s.label === lbl ? 1 : 0);
    return trainBinary(X, y);
  });

  return { vocab, weights };
}

/**
 * Classify a single handoff body.
 * @param {string} text
 * @param {{ vocab, weights }} [model]  — defaults to DEFAULT_MODEL
 * @returns {{ label:string, confidence:number, scores:object }}
 */
function classify(text, model) {
  const m = model || DEFAULT_MODEL;
  if (!m.vocab.length) {
    return { label: 'in_progress', confidence: 0.33, scores: { success: 0.33, failure: 0.33, in_progress: 0.34 } };
  }
  const vec = vectorize(text, m.vocab);
  const xi = [...vec, 1];
  const rawScores = m.weights.map((w) => sigmoid(dot(w, xi)));
  const total = rawScores.reduce((s, v) => s + v, 0) || 1;
  const scores = {};
  LABELS.forEach((lbl, i) => { scores[lbl] = rawScores[i] / total; });
  const label = LABELS[rawScores.indexOf(Math.max(...rawScores))];
  return { label, confidence: scores[label], scores };
}

// ---------------------------------------------------------------------------
// Train from filesystem
// ---------------------------------------------------------------------------

/**
 * Build training samples from .planning/handoffs/closed/ directory.
 * Label inference:
 *   completed_at set + unclaim_history empty or low-count → success
 *   unclaim_history.length >= 2 OR body contains "fail" / "error" → failure
 *   else → in_progress
 */
function trainFromFs(closedDir) {
  if (!fs.existsSync(closedDir)) return train([]);

  const files = fs.readdirSync(closedDir).filter((f) => f.endsWith('.md'));
  const samples = [];

  for (const fname of files) {
    try {
      const raw = fs.readFileSync(path.join(closedDir, fname), 'utf8');
      // Parse YAML frontmatter between --- delimiters
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let label = 'in_progress';
      let body = raw;

      if (fmMatch) {
        const fm = fmMatch[1];
        const completedAt = /completed_at:\s*(\S+)/.test(fm);
        const unclaimCount = (fm.match(/unclaim_history:/i) ? (fm.match(/reason:/g) || []).length : 0);
        body = raw.slice(fmMatch[0].length);

        const bodyLower = body.toLowerCase();
        const hasFail = /\b(fail|error|blocked|rate.limit|abort)\b/.test(bodyLower);

        if (!completedAt) {
          label = 'in_progress';
        } else if (unclaimCount >= 2 || hasFail) {
          label = 'failure';
        } else {
          label = 'success';
        }
      }

      samples.push({ text: body, label });
    } catch { /* skip malformed */ }
  }

  return train(samples);
}

// ---------------------------------------------------------------------------
// Default model (untrained stub — replaced once trainFromFs runs)
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = { vocab: [], weights: LABELS.map(() => []) };

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { train, classify, trainFromFs, DEFAULT_MODEL, LABELS };
