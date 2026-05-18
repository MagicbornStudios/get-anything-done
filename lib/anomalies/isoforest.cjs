'use strict';
/**
 * lib/anomalies/isoforest.cjs — Isolation Forest for multi-feature anomaly detection (task 246-08)
 *
 * Pure JS, zero deps. Implements Liu et al. 2008 Isolation Forest:
 *   - Build n_trees random isolation trees on a sample of the data
 *   - Score each point by average path length (shorter = more anomalous)
 *   - Normalize to [0, 1]; score > threshold → anomaly
 *
 * Exports:
 *   IsolationForest  — class with fit(data) / score(point) / predict(data)
 *   buildForest(data, opts)  — convenience constructor
 */

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/** Expected average path length for a BST of n nodes (Liu 2008 eq. 1) */
function avgPathLength(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// ---------------------------------------------------------------------------
// Isolation Tree
// ---------------------------------------------------------------------------

/**
 * Build one isolation tree recursively.
 * @param {number[][]} data  — rows of numeric features
 * @param {number} currentDepth
 * @param {number} maxDepth
 * @returns {object} tree node
 */
function buildTree(data, currentDepth, maxDepth) {
  if (data.length <= 1 || currentDepth >= maxDepth) {
    return { leaf: true, size: data.length };
  }

  const dim = data[0].length;
  // pick random feature
  const featureIdx = randInt(0, dim);
  const values = data.map((r) => r[featureIdx]);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return { leaf: true, size: data.length };
  }

  const splitVal = min + Math.random() * (max - min);
  const left  = data.filter((r) => r[featureIdx] < splitVal);
  const right = data.filter((r) => r[featureIdx] >= splitVal);

  return {
    leaf: false,
    featureIdx,
    splitVal,
    left:  buildTree(left,  currentDepth + 1, maxDepth),
    right: buildTree(right, currentDepth + 1, maxDepth),
  };
}

/**
 * Compute path length for one point through a tree.
 */
function pathLength(node, point, depth) {
  if (node.leaf) return depth + avgPathLength(node.size);
  if (point[node.featureIdx] < node.splitVal) {
    return pathLength(node.left, point, depth + 1);
  }
  return pathLength(node.right, point, depth + 1);
}

// ---------------------------------------------------------------------------
// IsolationForest class
// ---------------------------------------------------------------------------

class IsolationForest {
  /**
   * @param {object} opts
   * @param {number} [opts.n_trees=100]
   * @param {number} [opts.sample_size=256]   — subsample per tree
   * @param {number} [opts.threshold=0.6]     — anomaly score threshold
   */
  constructor({ n_trees = 100, sample_size = 256, threshold = 0.6 } = {}) {
    this.n_trees     = n_trees;
    this.sample_size = sample_size;
    this.threshold   = threshold;
    this.trees       = [];
    this._n          = 0; // training set size (for normalization)
  }

  /**
   * Fit the forest on numeric data.
   * @param {number[][]} data  — each row is a feature vector
   */
  fit(data) {
    if (!data || data.length === 0) return this;
    this._n = data.length;
    const maxDepth = Math.ceil(Math.log2(Math.max(this.sample_size, 2)));
    this.trees = [];

    for (let t = 0; t < this.n_trees; t++) {
      // random subsample without replacement (or with if sample_size >= n)
      let sample;
      if (this.sample_size >= data.length) {
        sample = data.slice();
      } else {
        const indices = new Set();
        while (indices.size < this.sample_size) indices.add(randInt(0, data.length));
        sample = [...indices].map((i) => data[i]);
      }
      this.trees.push(buildTree(sample, 0, maxDepth));
    }

    return this;
  }

  /**
   * Compute anomaly score for one point.
   * Score ∈ (0, 1]; closer to 1 = more anomalous.
   */
  score(point) {
    if (!this.trees.length) return 0;
    const h = this.trees.reduce((sum, tree) => sum + pathLength(tree, point, 0), 0) / this.trees.length;
    const c = avgPathLength(this._n);
    if (c === 0) return 0;
    return Math.pow(2, -h / c);
  }

  /**
   * Score all points; return array of { score, anomaly } per row.
   */
  predict(data) {
    return data.map((row) => {
      const s = this.score(row);
      return { score: s, anomaly: s > this.threshold };
    });
  }

  /** Serialize to a plain object for caching. */
  toJSON() {
    return { n_trees: this.n_trees, sample_size: this.sample_size, threshold: this.threshold, _n: this._n, trees: this.trees };
  }

  /** Restore from toJSON output. */
  static fromJSON(obj) {
    const f = new IsolationForest({ n_trees: obj.n_trees, sample_size: obj.sample_size, threshold: obj.threshold });
    f._n   = obj._n;
    f.trees = obj.trees;
    return f;
  }
}

// ---------------------------------------------------------------------------
// Convenience builder
// ---------------------------------------------------------------------------

/**
 * Build and fit a forest in one call.
 * @param {number[][]} data
 * @param {object} [opts]
 * @returns {IsolationForest}
 */
function buildForest(data, opts) {
  return new IsolationForest(opts).fit(data);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { IsolationForest, buildForest, avgPathLength };
