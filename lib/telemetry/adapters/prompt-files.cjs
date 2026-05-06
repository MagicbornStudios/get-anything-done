'use strict';
/**
 * Phase 145 (slm-training-data-collection-v1) — task GLOBAL-T-145-02.
 *
 * Adapter D: prompt-files
 *
 * Source: <rootDir>/.planning/team/workers/w*\/out/<numericTs>.prompt.md
 *
 * Each .prompt.md file is the full prompt text the worker piped to its
 * runtime as stdin. Map one envelope per file (role=prompt). There is
 * no direct join key to a worker-log run, so run_id is best-effort
 * (built from runtime + worker_id + file mtime).
 *
 * Streams files one at a time — does not slurp the whole tree. Reading
 * a single prompt file in full is fine; they're prompt-sized text.
 *
 * Reference: lib/telemetry/envelope.cjs (DO NOT MODIFY).
 */
const fs = require('fs');
const path = require('path');

const {
  validateEnvelope,
  deriveEnvelopeId,
  makeEnvelope,
  makeRunId,
  VALID_RUNTIMES,
} = require('../envelope.cjs');

const RUNTIME_GUESS = Object.freeze({
  w1: 'codex-cli',
  w2: 'gemini-cli',
  w3: 'opencode',
  w4: 'opencode',
  w5: 'opencode',
  w6: 'claude-code',
});

function guessRuntime(workerId) {
  return RUNTIME_GUESS[workerId] || 'gad-cli';
}

function readStatusRuntime(rootDir, workerId, cache) {
  if (cache.has(workerId)) return cache.get(workerId);
  const statusPath = path.join(rootDir, '.planning', 'team', 'workers', workerId, 'status.json');
  let runtime = guessRuntime(workerId);
  try {
    const txt = fs.readFileSync(statusPath, 'utf8');
    const j = JSON.parse(txt);
    if (j && typeof j.runtime === 'string' && VALID_RUNTIMES.has(j.runtime)) {
      runtime = j.runtime;
    }
  } catch (_) {
    // fall through
  }
  cache.set(workerId, runtime);
  return runtime;
}

function listWorkerDirs(rootDir) {
  const teamWorkers = path.join(rootDir, '.planning', 'team', 'workers');
  let entries;
  try {
    entries = fs.readdirSync(teamWorkers, { withFileTypes: true });
  } catch (_) {
    return [];
  }
  return entries
    .filter((d) => d.isDirectory() && /^w\d+$/.test(d.name))
    .map((d) => d.name)
    .sort();
}

const PROMPT_FILE_RE = /^(\d+)\.prompt\.md$/;

function listPromptFiles(workerOutDir) {
  let entries;
  try {
    entries = fs.readdirSync(workerOutDir, { withFileTypes: true });
  } catch (_) {
    return [];
  }
  const files = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const m = ent.name.match(PROMPT_FILE_RE);
    if (!m) continue;
    files.push({ name: ent.name, tsMs: Number(m[1]) });
  }
  // Deterministic order — by numeric ts then name.
  files.sort((a, b) => (a.tsMs - b.tsMs) || a.name.localeCompare(b.name));
  return files;
}

/**
 * Yield one prompt envelope per .prompt.md file, across every worker
 * dir under rootDir.
 *
 * @param {string} rootDir   monorepo root (the dir containing .planning/)
 * @param {number} sinceMs   epoch ms; files with mtime < this are skipped
 */
async function* iterEnvelopes(rootDir, sinceMs = 0) {
  const runtimeCache = new Map();

  for (const workerId of listWorkerDirs(rootDir)) {
    const outDir = path.join(rootDir, '.planning', 'team', 'workers', workerId, 'out');
    if (!fs.existsSync(outDir)) continue;
    const runtime = readStatusRuntime(rootDir, workerId, runtimeCache);

    for (const { name, tsMs } of listPromptFiles(outDir)) {
      const fullPath = path.join(outDir, name);
      let st;
      try {
        st = fs.statSync(fullPath);
      } catch (e) {
        process.stderr.write(`[prompt-files] stat failed ${fullPath}: ${e.message}\n`);
        continue;
      }
      if (sinceMs && st.mtimeMs < sinceMs) continue;

      const mtimeIso = new Date(st.mtimeMs).toISOString();

      let text;
      try {
        text = fs.readFileSync(fullPath, 'utf8');
      } catch (e) {
        process.stderr.write(`[prompt-files] read failed ${fullPath}: ${e.message}\n`);
        continue;
      }

      const runId = makeRunId(runtime, workerId, mtimeIso);
      const key = `prompt-file|${workerId}|${tsMs}`;
      const id = deriveEnvelopeId(key);

      let env;
      try {
        env = makeEnvelope({
          id,
          ts: mtimeIso,
          run_id: runId,
          project: 'global',
          runtime,
          role: 'prompt',
          content: { text, source_file: name },
          seq: tsMs,
          task_id: null,
          handoff_id: null,
          model: null,
          agent_id: workerId,
        });
      } catch (e) {
        process.stderr.write(`[prompt-files] makeEnvelope failed ${workerId}/${name}: ${e.message}\n`);
        continue;
      }

      const v = validateEnvelope(env);
      if (!v.ok) {
        process.stderr.write(`[prompt-files] invalid envelope ${workerId}/${name}: ${v.errors.join('; ')}\n`);
        continue;
      }
      yield env;
    }
  }
}

module.exports = {
  iterEnvelopes,
  _internal: {
    listWorkerDirs,
    listPromptFiles,
    readStatusRuntime,
  },
};
