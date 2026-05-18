/**
 * bench-harness/index.cjs — Problem-set runner + tournament matrix for own-ELO benchmarks.
 *
 * Used by: .planning/commands/bench.cjs, tests/bench-harness.test.cjs
 *
 * Zero external deps: built-in fs, path, child_process, and globalThis.fetch (Node 18+).
 *
 * Contestant shape:
 *   {
 *     id: string,
 *     kind: 'local-ollama' | 'modal' | 'runtime-cli' | 'http',
 *     model?: string,
 *     runtime?: string,
 *     baseURL?: string,
 *     apiKey?: string,
 *     solve(problem) -> Promise<{ output: string, durationMs: number }>
 *   }
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// ── Problem-set schema ────────────────────────────────────────────────────────

const VALID_SCORERS = new Set(["exact-match", "pytest", "humaneval-pass-at-1", "judge-llm"]);
const VALID_KINDS = new Set(["local-ollama", "modal", "runtime-cli", "http"]);

/**
 * validateProblemSet — throw on schema violations, return validated object.
 * @param {object} json
 * @returns {object}
 */
function validateProblemSet(json) {
  if (!json || typeof json !== "object") throw new TypeError("validateProblemSet: input must be an object");
  const required = ["id", "version", "scorer", "problems"];
  for (const k of required) {
    if (!(k in json)) throw new Error(`validateProblemSet: missing field "${k}"`);
  }
  if (typeof json.id !== "string" || !json.id.trim()) throw new Error("validateProblemSet: id must be a non-empty string");
  if (!VALID_SCORERS.has(json.scorer)) {
    throw new Error(`validateProblemSet: scorer must be one of ${[...VALID_SCORERS].join(", ")}`);
  }
  if (!Array.isArray(json.problems) || json.problems.length === 0) {
    throw new Error("validateProblemSet: problems must be a non-empty array");
  }
  for (let i = 0; i < json.problems.length; i++) {
    const p = json.problems[i];
    if (!p.id || typeof p.id !== "string") throw new Error(`validateProblemSet: problems[${i}].id missing or invalid`);
    if (!p.prompt || typeof p.prompt !== "string") throw new Error(`validateProblemSet: problems[${i}].prompt missing or invalid`);
  }
  return json;
}

/**
 * loadProblemSet — read + validate a named problem set from .planning/bench-sets/.
 *
 * Searches for <name>.json relative to projectRoot (cwd by default).
 *
 * @param {string} name  file stem, e.g. "seed-coding-mini"
 * @param {string} [projectRoot]
 * @returns {object}
 */
function loadProblemSet(name, projectRoot) {
  const root = projectRoot || process.cwd();
  const filePath = path.join(root, ".planning", "bench-sets", `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`loadProblemSet: file not found: ${filePath}`);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    throw new Error(`loadProblemSet: JSON parse error in ${filePath}: ${e.message}`);
  }
  return validateProblemSet(raw);
}

// ── Scorers ───────────────────────────────────────────────────────────────────

/**
 * Built-in scorers. Each receives (problem, output) → number 0..1.
 */
const SCORERS = {
  "exact-match": (problem, output) => {
    if (!problem.expected) return 0;
    const clean = (s) => String(s).trim().toLowerCase();
    return clean(output) === clean(problem.expected) ? 1 : 0;
  },
  "pytest": (problem, output) => {
    // Writes output to a temp file, runs pytest, returns 1 if exit 0.
    // Requires pytest on PATH; gracefully returns 0 if not available.
    const tmpFile = path.join(require("os").tmpdir(), `bench-pytest-${Date.now()}.py`);
    try {
      fs.writeFileSync(tmpFile, output, "utf8");
      const result = spawnSync("pytest", [tmpFile, "-q", "--tb=no"], { encoding: "utf8", timeout: 30000 });
      return result.status === 0 ? 1 : 0;
    } catch {
      return 0;
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  },
  "humaneval-pass-at-1": (problem, output) => {
    // Naive: exec the code + test stub. Gracefully returns 0 on error.
    const testCode = problem.metadata && problem.metadata.testCode ? problem.metadata.testCode : "";
    const combined = `${output}\n${testCode}`;
    try {
      const fn = new Function(combined);
      fn();
      return 1;
    } catch {
      return 0;
    }
  },
  "judge-llm": () => {
    // Placeholder — LLM judge is a follow-up (247-16+).
    return 0;
  },
};

function getScorer(scorerName) {
  if (!(scorerName in SCORERS)) {
    throw new Error(`getScorer: unknown scorer "${scorerName}"`);
  }
  return SCORERS[scorerName];
}

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * runContestant — run a contestant against all problems in a set.
 *
 * @param {object} contestant
 * @param {object} problemSet  validated problem-set object
 * @param {Function} [scorer]  optional override; defaults to scorer named in problemSet
 * @returns {Promise<Array<{problemId, score, rawOutput, durationMs}>>}
 */
async function runContestant(contestant, problemSet, scorer) {
  if (typeof contestant.solve !== "function") {
    throw new TypeError("runContestant: contestant.solve must be a function");
  }
  const scoreFn = scorer || getScorer(problemSet.scorer);
  const results = [];
  for (const problem of problemSet.problems) {
    let rawOutput = "";
    let durationMs = 0;
    let score = 0;
    try {
      const res = await contestant.solve(problem);
      rawOutput = res.output || "";
      durationMs = res.durationMs || 0;
      score = scoreFn(problem, rawOutput);
    } catch (err) {
      rawOutput = `ERROR: ${err.message}`;
      score = 0;
    }
    results.push({ problemId: problem.id, score, rawOutput, durationMs });
  }
  return results;
}

// ── Tournament matrix ─────────────────────────────────────────────────────────

/**
 * tournamentMatrix — run all contestants against the same problem set, optionally
 * update ELO ratings via lib/bench-elo.
 *
 * @param {object[]} contestants
 * @param {object} problemSet
 * @param {object} [opts]
 * @param {Map<string,number>} [opts.ratingsMap]  mutable ELO map (pass in to get updates)
 * @param {number} [opts.kFactor]
 * @returns {Promise<{
 *   rows: Array<{contestant: object, results: object[], totalScore: number, passCount: number}>,
 *   ratingsMap?: Map<string,number>
 * }>}
 */
async function tournamentMatrix(contestants, problemSet, opts = {}) {
  const { ratingsMap, kFactor } = opts;

  // Run all contestants in parallel
  const runs = await Promise.all(
    contestants.map(async (c) => {
      const results = await runContestant(c, problemSet);
      const totalScore = results.reduce((s, r) => s + r.score, 0);
      const passCount = results.filter((r) => r.score >= 1).length;
      return { contestant: c, results, totalScore, passCount };
    })
  );

  // Update ELO if ratingsMap provided — pair each contestant against every other
  if (ratingsMap) {
    const { applyResult } = require("../bench-elo/index.cjs");
    // Sort by totalScore descending for pairwise comparisons
    const sorted = [...runs].sort((a, b) => b.totalScore - a.totalScore);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (a.totalScore === b.totalScore) {
          // Draw
          applyResult(ratingsMap, a.contestant.id, b.contestant.id, kFactor || 32, 0.5);
        } else {
          // a beat b (a is higher-scoring)
          applyResult(ratingsMap, a.contestant.id, b.contestant.id, kFactor || 32, 1);
        }
      }
    }
  }

  return { rows: runs, ratingsMap };
}

// ── Result persistence ────────────────────────────────────────────────────────

/**
 * writeResult — persist a bench result JSON to .planning/bench-results/.
 *
 * @param {object} result
 * @param {string} [projectRoot]
 * @returns {string}  absolute path written
 */
function writeResult(result, projectRoot) {
  const root = projectRoot || process.cwd();
  const dir = path.join(root, ".planning", "bench-results");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Generate id if missing
  if (!result.id) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const cid = result.contestant && result.contestant.id ? result.contestant.id : "unknown";
    const sid = result.set || "unknown";
    result.id = `result-${sid}-${cid}-${ts}`;
  }
  if (!result.ts) result.ts = new Date().toISOString();

  const fileName = `${result.id}.json`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), "utf8");
  return filePath;
}

/**
 * buildResult — construct a result object from tournamentMatrix row.
 *
 * @param {object} row  one entry from tournamentMatrix rows array
 * @param {string} setId
 * @returns {object}
 */
function buildResult(row, setId) {
  const details = row.results;
  const passed = details.filter((d) => d.score >= 1).length;
  const failedIds = details.filter((d) => d.score < 1).map((d) => d.problemId);
  const avgDurationMs = details.length
    ? Math.round(details.reduce((s, d) => s + d.durationMs, 0) / details.length)
    : 0;
  const ts = new Date().toISOString();
  const cid = row.contestant.id;
  const tsSlug = ts.replace(/[:.]/g, "-");
  return {
    id: `result-${setId}-${cid}-${tsSlug}`,
    ts,
    set: setId,
    contestant: {
      id: row.contestant.id,
      kind: row.contestant.kind,
      model: row.contestant.model || null,
      runtime: row.contestant.runtime || null,
    },
    summary: {
      problems: details.length,
      passed,
      failedIds,
      avgDurationMs,
    },
    details,
  };
}

// ── Contestant factories ──────────────────────────────────────────────────────

/**
 * makeOllamaContestant — wraps a local Ollama instance.
 *
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} opts.model
 * @param {string} [opts.baseURL]  default http://localhost:11434
 * @returns {object}
 */
function makeOllamaContestant({ id, model, baseURL = "http://localhost:11434" }) {
  return {
    id,
    kind: "local-ollama",
    model,
    baseURL,
    async solve(problem) {
      const t0 = Date.now();
      const url = `${baseURL}/api/generate`;
      const body = JSON.stringify({ model, prompt: problem.prompt, stream: false });
      let output = "";
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(60000),
        });
        if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
        const data = await resp.json();
        output = data.response || "";
      } catch (err) {
        output = `ERROR: ${err.message}`;
      }
      return { output, durationMs: Date.now() - t0 };
    },
  };
}

/**
 * makeRuntimeCliContestant — wraps a gad runtime (codex/gemini/opencode).
 *
 * Calls: gad runtime launch --projectid global --force-runtime <runtime> --same-shell
 *        --launch-args "exec --full-auto '<prompt>'"
 *
 * stdout is captured as output.
 *
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} opts.runtime  e.g. "codex-cli", "gemini-cli"
 * @param {number} [opts.timeoutMs]
 * @returns {object}
 */
function makeRuntimeCliContestant({ id, runtime, timeoutMs = 120000 }) {
  return {
    id,
    kind: "runtime-cli",
    runtime,
    async solve(problem) {
      const t0 = Date.now();
      const prompt = problem.prompt.replace(/'/g, "\\'");
      const args = [
        "vendor/get-anything-done/bin/gad.cjs",
        "runtime", "launch",
        "--projectid", "global",
        "--force-runtime", runtime,
        "--same-shell",
        "--launch-args", `exec --full-auto '${prompt}'`,
      ];
      const result = spawnSync(process.execPath, args, {
        encoding: "utf8",
        timeout: timeoutMs,
        cwd: process.cwd(),
      });
      const output = (result.stdout || "") + (result.stderr ? `\nSTDERR: ${result.stderr}` : "");
      return { output: output.trim(), durationMs: Date.now() - t0 };
    },
  };
}

/**
 * makeHttpContestant — wraps any OpenAI-compatible HTTP endpoint.
 *
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} opts.baseURL  e.g. "https://api.openai.com/v1"
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {number} [opts.timeoutMs]
 * @returns {object}
 */
function makeHttpContestant({ id, baseURL, apiKey, model, timeoutMs = 60000 }) {
  return {
    id,
    kind: "http",
    model,
    baseURL,
    async solve(problem) {
      const t0 = Date.now();
      const url = `${baseURL}/chat/completions`;
      const body = JSON.stringify({
        model,
        messages: [{ role: "user", content: problem.prompt }],
        max_tokens: 512,
      });
      let output = "";
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
        }
        const data = await resp.json();
        output = data.choices?.[0]?.message?.content || "";
      } catch (err) {
        output = `ERROR: ${err.message}`;
      }
      return { output, durationMs: Date.now() - t0 };
    },
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  // Schema
  validateProblemSet,
  loadProblemSet,
  // Runner
  runContestant,
  tournamentMatrix,
  // Results
  writeResult,
  buildResult,
  // Factories
  makeOllamaContestant,
  makeRuntimeCliContestant,
  makeHttpContestant,
  // Scorers (exported for testing / custom use)
  SCORERS,
};
