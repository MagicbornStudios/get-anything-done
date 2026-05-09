'use strict';
/**
 * gad hf — HuggingFace Hub integration.
 *
 * Subcommands:
 *   models search <query>       — search HF Hub models endpoint
 *   models show <model-id>      — fetch single model card metadata
 *   datasets search <query>     — search HF Hub datasets endpoint
 *   datasets show <dataset-id>  — fetch single dataset metadata
 *   download <id>               — wrap huggingface-cli download
 *   push-dataset <local-path>   — wrap huggingface-cli upload for owned datasets
 *   whoami                      — show authenticated HF user
 *
 * Auth:
 *   HF_TOKEN (or the env var named in hf.token_env_var setting) enables
 *   authenticated endpoints. Public search and show require no auth.
 *
 * Settings keys:
 *   hf.api_endpoint                         (default "https://huggingface.co")
 *   hf.token_env_var                        (default "HF_TOKEN")
 *   hf.default_download_dir                 (default "~/.gad/hf-cache")
 *   hf.dataset_publish_default_visibility   (enum: private|public, default "private")
 *
 * No huggingface-hub Python library bundled here — download/push delegate
 * to the system-installed `huggingface-cli`.
 */

const { execFileSync } = require('node:child_process');
const { defineCommand } = require('citty');

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_API = 'https://huggingface.co';
const DEFAULT_TOKEN_ENV = 'HF_TOKEN';
const DEFAULT_DOWNLOAD_DIR = '~/.gad/hf-cache';
const USER_AGENT = 'gad-cli/1.35 (hf-integration)';

// ─── Settings helpers ─────────────────────────────────────────────────────────

function getHfSetting(gadConfig, key, defaultVal) {
  try {
    const cfg = gadConfig && gadConfig.load ? gadConfig.load() : {};
    const hf = (cfg && cfg.hf) || {};
    return hf[key] !== undefined ? hf[key] : defaultVal;
  } catch (_) {
    return defaultVal;
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getToken(gadConfig) {
  const envVar = getHfSetting(gadConfig, 'token_env_var', DEFAULT_TOKEN_ENV);
  return process.env[envVar] || '';
}

function getApiBase(gadConfig) {
  return getHfSetting(gadConfig, 'api_endpoint', DEFAULT_API);
}

function buildHeaders(token) {
  const h = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// ─── Core fetch helpers (exported for tests) ──────────────────────────────────

async function hfApiFetch(url, token) {
  const resp = await fetch(url, { headers: buildHeaders(token) });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    const err = new Error(`HF API error ${resp.status}: ${body.slice(0, 200)}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

/**
 * Search HF Hub models.
 * @param {string} query
 * @param {{ limit?: number, filter?: string, apiBase?: string, token?: string }} opts
 */
async function searchModels(query, opts = {}) {
  const { limit = 10, filter, apiBase = DEFAULT_API, token = '' } = opts;
  const params = new URLSearchParams({ search: query, limit: String(limit) });
  if (filter) params.set('filter', filter);
  const url = `${apiBase}/api/models?${params}`;
  const raw = await hfApiFetch(url, token);
  const models = Array.isArray(raw) ? raw : [];
  return {
    query,
    total: models.length,
    models: models.map((m) => ({
      id: m.modelId || m.id || m._id || '',
      downloads: m.downloads || 0,
      likes: m.likes || 0,
      lastModified: m.lastModified || m.updatedAt || '',
      pipeline_tag: m.pipeline_tag || '',
      tags: m.tags || [],
      private: !!m.private,
    })),
  };
}

/**
 * Show a single HF model card.
 * @param {string} modelId
 * @param {{ apiBase?: string, token?: string }} opts
 */
async function showModel(modelId, opts = {}) {
  const { apiBase = DEFAULT_API, token = '' } = opts;
  // HF API uses the raw repo path (owner/name) without encoding the slash.
  const safeId = modelId.split('/').map(encodeURIComponent).join('/');
  const url = `${apiBase}/api/models/${safeId}`;
  const raw = await hfApiFetch(url, token);
  return {
    id: raw.modelId || raw.id || raw._id || modelId,
    downloads: raw.downloads || 0,
    likes: raw.likes || 0,
    license: raw.cardData && raw.cardData.license ? raw.cardData.license : (raw.license || ''),
    tags: raw.tags || [],
    pipeline_tag: raw.pipeline_tag || '',
    lastModified: raw.lastModified || raw.updatedAt || '',
    private: !!raw.private,
    siblings: (raw.siblings || []).length,
  };
}

/**
 * Search HF Hub datasets.
 * @param {string} query
 * @param {{ limit?: number, apiBase?: string, token?: string }} opts
 */
async function searchDatasets(query, opts = {}) {
  const { limit = 10, apiBase = DEFAULT_API, token = '' } = opts;
  const params = new URLSearchParams({ search: query, limit: String(limit) });
  const url = `${apiBase}/api/datasets?${params}`;
  const raw = await hfApiFetch(url, token);
  const datasets = Array.isArray(raw) ? raw : [];
  return {
    query,
    total: datasets.length,
    datasets: datasets.map((d) => ({
      id: d.id || d._id || '',
      downloads: d.downloads || 0,
      likes: d.likes || 0,
      lastModified: d.lastModified || d.updatedAt || '',
      tags: d.tags || [],
      private: !!d.private,
    })),
  };
}

/**
 * Show a single HF dataset card.
 * @param {string} datasetId
 * @param {{ apiBase?: string, token?: string }} opts
 */
async function showDataset(datasetId, opts = {}) {
  const { apiBase = DEFAULT_API, token = '' } = opts;
  // HF API uses the raw repo path (owner/name) without encoding the slash.
  const safeId = datasetId.split('/').map(encodeURIComponent).join('/');
  const url = `${apiBase}/api/datasets/${safeId}`;
  const raw = await hfApiFetch(url, token);
  return {
    id: raw.id || raw._id || datasetId,
    downloads: raw.downloads || 0,
    likes: raw.likes || 0,
    license: raw.cardData && raw.cardData.license ? raw.cardData.license : (raw.license || ''),
    tags: raw.tags || [],
    lastModified: raw.lastModified || raw.updatedAt || '',
    private: !!raw.private,
  };
}

/**
 * Get authenticated user info.
 * @param {{ apiBase?: string, token?: string }} opts
 */
async function whoami(opts = {}) {
  const { apiBase = DEFAULT_API, token = '' } = opts;
  if (!token) {
    const err = new Error('HF_TOKEN not set — cannot authenticate');
    err.code = 'NO_TOKEN';
    throw err;
  }
  const url = `${apiBase}/api/whoami-v2`;
  return hfApiFetch(url, token);
}

// ─── huggingface-cli subprocess helpers ───────────────────────────────────────

/**
 * Run huggingface-cli as a subprocess.
 * @param {string[]} args
 * @param {{ token?: string, env?: Record<string,string> }} opts
 * @returns {string} stdout
 */
function runHfCli(args, opts = {}) {
  const env = { ...process.env, ...opts.env };
  if (opts.token) env['HF_TOKEN'] = opts.token;
  try {
    const out = execFileSync('huggingface-cli', args, {
      encoding: 'utf8',
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out;
  } catch (err) {
    if (err.code === 'ENOENT') {
      const e = new Error(
        'huggingface-cli not found. Install it with: pip install huggingface_hub[cli]'
      );
      e.code = 'CLI_MISSING';
      throw e;
    }
    throw err;
  }
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function outputJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

function outputModelList(result) {
  console.log(`\nHuggingFace models search: "${result.query}" (${result.total} results)\n`);
  for (const m of result.models) {
    const tag = m.pipeline_tag ? ` [${m.pipeline_tag}]` : '';
    const dl = m.downloads ? ` · ${m.downloads.toLocaleString()} dl` : '';
    console.log(`  ${m.id}${tag}${dl}`);
    if (m.tags && m.tags.length) {
      const shown = m.tags.slice(0, 5).join(', ');
      console.log(`    tags: ${shown}${m.tags.length > 5 ? ` +${m.tags.length - 5}` : ''}`);
    }
  }
}

function outputDatasetList(result) {
  console.log(`\nHuggingFace datasets search: "${result.query}" (${result.total} results)\n`);
  for (const d of result.datasets) {
    const dl = d.downloads ? ` · ${d.downloads.toLocaleString()} dl` : '';
    console.log(`  ${d.id}${dl}`);
    if (d.tags && d.tags.length) {
      const shown = d.tags.slice(0, 4).join(', ');
      console.log(`    tags: ${shown}${d.tags.length > 4 ? ` +${d.tags.length - 4}` : ''}`);
    }
  }
}

// ─── Command factory ──────────────────────────────────────────────────────────

function createHfCommand(deps = {}) {
  const { gadConfig } = deps;

  // ── models search ───────────────────────────────────────────────────────────
  const modelsSearchCmd = defineCommand({
    meta: { name: 'search', description: 'Search HuggingFace Hub models' },
    args: {
      query: { type: 'positional', description: 'Search query (e.g. "Hermes-4-14B")', required: true },
      limit: { type: 'string', description: 'Max results', default: '10' },
      filter: { type: 'string', description: 'Filter key=val (e.g. pipeline_tag=text-generation)', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const apiBase = getApiBase(gadConfig);
      const token = getToken(gadConfig);
      const result = await searchModels(args.query, {
        limit: parseInt(args.limit, 10) || 10,
        filter: args.filter || undefined,
        apiBase,
        token,
      });
      if (args.json) return outputJson(result);
      outputModelList(result);
    },
  });

  // ── models show ─────────────────────────────────────────────────────────────
  const modelsShowCmd = defineCommand({
    meta: { name: 'show', description: 'Show HuggingFace model card metadata' },
    args: {
      modelId: { type: 'positional', description: 'Model ID (e.g. NousResearch/Hermes-4-14B)', required: true },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const apiBase = getApiBase(gadConfig);
      const token = getToken(gadConfig);
      const result = await showModel(args.modelId, { apiBase, token });
      if (args.json) return outputJson(result);
      console.log(`\n${result.id}`);
      console.log(`  pipeline: ${result.pipeline_tag || '(none)'}`);
      console.log(`  downloads: ${result.downloads.toLocaleString()}`);
      console.log(`  likes: ${result.likes}`);
      console.log(`  license: ${result.license || '(unknown)'}`);
      console.log(`  files: ${result.siblings}`);
      console.log(`  tags: ${result.tags.slice(0, 6).join(', ')}`);
      console.log(`  modified: ${result.lastModified}`);
    },
  });

  // ── models namespace ────────────────────────────────────────────────────────
  const modelsCmd = defineCommand({
    meta: { name: 'models', description: 'HuggingFace model operations' },
    subCommands: {
      search: modelsSearchCmd,
      show: modelsShowCmd,
    },
  });

  // ── datasets search ─────────────────────────────────────────────────────────
  const datasetsSearchCmd = defineCommand({
    meta: { name: 'search', description: 'Search HuggingFace Hub datasets' },
    args: {
      query: { type: 'positional', description: 'Search query', required: true },
      limit: { type: 'string', description: 'Max results', default: '10' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const apiBase = getApiBase(gadConfig);
      const token = getToken(gadConfig);
      const result = await searchDatasets(args.query, {
        limit: parseInt(args.limit, 10) || 10,
        apiBase,
        token,
      });
      if (args.json) return outputJson(result);
      outputDatasetList(result);
    },
  });

  // ── datasets show ───────────────────────────────────────────────────────────
  const datasetsShowCmd = defineCommand({
    meta: { name: 'show', description: 'Show HuggingFace dataset card metadata' },
    args: {
      datasetId: { type: 'positional', description: 'Dataset ID', required: true },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const apiBase = getApiBase(gadConfig);
      const token = getToken(gadConfig);
      const result = await showDataset(args.datasetId, { apiBase, token });
      if (args.json) return outputJson(result);
      console.log(`\n${result.id}`);
      console.log(`  downloads: ${result.downloads.toLocaleString()}`);
      console.log(`  likes: ${result.likes}`);
      console.log(`  license: ${result.license || '(unknown)'}`);
      console.log(`  tags: ${result.tags.slice(0, 6).join(', ')}`);
      console.log(`  modified: ${result.lastModified}`);
    },
  });

  // ── datasets namespace ──────────────────────────────────────────────────────
  const datasetsCmd = defineCommand({
    meta: { name: 'datasets', description: 'HuggingFace dataset operations' },
    subCommands: {
      search: datasetsSearchCmd,
      show: datasetsShowCmd,
    },
  });

  // ── download ────────────────────────────────────────────────────────────────
  const downloadCmd = defineCommand({
    meta: { name: 'download', description: 'Download a model or dataset via huggingface-cli' },
    args: {
      id: { type: 'positional', description: 'Model or dataset ID', required: true },
      target: { type: 'string', description: 'Local path to download into', default: '' },
      type: { type: 'string', description: 'model or dataset', default: 'model' },
      revision: { type: 'string', description: 'Branch / tag / commit ref', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const token = getToken(gadConfig);
      const defaultDir = getHfSetting(gadConfig, 'default_download_dir', DEFAULT_DOWNLOAD_DIR);
      const localDir = args.target || defaultDir;

      const cliArgs = ['download', args.id, '--local-dir', localDir];
      if (args.type === 'dataset') cliArgs.push('--repo-type', 'dataset');
      if (args.revision) cliArgs.push('--revision', args.revision);

      let out;
      try {
        out = runHfCli(cliArgs, { token });
      } catch (err) {
        if (err.code === 'CLI_MISSING') {
          if (args.json) {
            console.log(JSON.stringify({ error: err.message, code: err.code }));
          } else {
            process.stderr.write(`ERROR: ${err.message}\n`);
          }
          process.exitCode = 1;
          return;
        }
        throw err;
      }
      const result = { id: args.id, type: args.type || 'model', localDir, output: out.trim() };
      if (args.json) return outputJson(result);
      console.log(`Downloaded ${args.id} → ${localDir}`);
      if (out.trim()) console.log(out.trim());
    },
  });

  // ── push-dataset ─────────────────────────────────────────────────────────────
  const pushDatasetCmd = defineCommand({
    meta: { name: 'push-dataset', description: 'Publish a local dataset to HuggingFace Hub' },
    args: {
      localPath: {
        type: 'positional',
        description: 'Local file or directory to upload',
        required: true,
      },
      'repo-id': { type: 'string', description: 'HF repo id (e.g. magicbornstudios/gad-tool-use-preference)', required: true },
      private: { type: 'boolean', description: 'Create private repo (default per hf.dataset_publish_default_visibility)', default: false },
      message: { type: 'string', description: 'Commit message', default: 'upload via gad hf push-dataset' },
      'i-confirm-public': { type: 'boolean', description: 'Required when uploading from .planning/datasets/ without --private', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const token = getToken(gadConfig);
      const defaultVisibility = getHfSetting(gadConfig, 'dataset_publish_default_visibility', 'private');
      const isPrivate = args.private || defaultVisibility === 'private';

      // Safety check: refuse to upload planning/datasets without explicit confirm
      if (
        args.localPath.includes('.planning/datasets') &&
        !isPrivate &&
        !args['i-confirm-public']
      ) {
        const msg =
          'REFUSED: uploading .planning/datasets/ as public requires --i-confirm-public flag. ' +
          'Operator-private content may be present.';
        if (args.json) {
          console.log(JSON.stringify({ error: msg, code: 'PRIVATE_CONTENT_GUARD' }));
        } else {
          process.stderr.write(`ERROR: ${msg}\n`);
        }
        process.exitCode = 1;
        return;
      }

      const cliArgs = [
        'upload',
        args['repo-id'],
        args.localPath,
        '--repo-type', 'dataset',
        '--commit-message', args.message,
      ];
      if (isPrivate) cliArgs.push('--private');

      let out;
      try {
        out = runHfCli(cliArgs, { token });
      } catch (err) {
        if (err.code === 'CLI_MISSING') {
          if (args.json) {
            console.log(JSON.stringify({ error: err.message, code: err.code }));
          } else {
            process.stderr.write(`ERROR: ${err.message}\n`);
          }
          process.exitCode = 1;
          return;
        }
        throw err;
      }
      const result = {
        localPath: args.localPath,
        repoId: args['repo-id'],
        private: isPrivate,
        output: out.trim(),
      };
      if (args.json) return outputJson(result);
      console.log(`Pushed ${args.localPath} → ${args['repo-id']} (${isPrivate ? 'private' : 'public'})`);
      if (out.trim()) console.log(out.trim());
    },
  });

  // ── whoami ───────────────────────────────────────────────────────────────────
  const whoamiCmd = defineCommand({
    meta: { name: 'whoami', description: 'Show authenticated HuggingFace user' },
    args: {
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      const apiBase = getApiBase(gadConfig);
      const token = getToken(gadConfig);
      let result;
      try {
        result = await whoami({ apiBase, token });
      } catch (err) {
        if (err.code === 'NO_TOKEN') {
          if (args.json) {
            console.log(JSON.stringify({ error: err.message, code: err.code }));
          } else {
            process.stderr.write(`ERROR: ${err.message}\n`);
          }
          process.exitCode = 1;
          return;
        }
        throw err;
      }
      if (args.json) return outputJson(result);
      console.log(`\nHuggingFace user: ${result.name || result.fullname || '(unknown)'}`);
      console.log(`  orgs: ${(result.orgs || []).map((o) => o.name).join(', ') || '(none)'}`);
      if (result.email) console.log(`  email: ${result.email}`);
    },
  });

  // ── top-level hf namespace ───────────────────────────────────────────────────
  return defineCommand({
    meta: { name: 'hf', description: 'HuggingFace Hub integration' },
    subCommands: {
      models: modelsCmd,
      datasets: datasetsCmd,
      download: downloadCmd,
      'push-dataset': pushDatasetCmd,
      whoami: whoamiCmd,
    },
  });
}

// ─── Loader contract ──────────────────────────────────────────────────────────

module.exports = {
  createHfCommand,
  // Exported for tests:
  searchModels,
  showModel,
  searchDatasets,
  showDataset,
  whoami,
  hfApiFetch,
  runHfCli,
};
module.exports.register = (ctx) => ({ hf: createHfCommand(ctx.common) });
