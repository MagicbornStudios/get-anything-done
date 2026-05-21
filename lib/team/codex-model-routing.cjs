'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CACHE_TTL_MS = 5 * 60 * 1000;

let modelCatalogCache = null;

const TIER_MATRIX = Object.freeze({
  'quick:prescribed': 'fast',
  'quick:bounded': 'fast',
  'quick:design': 'strong',
  'standard:prescribed': 'fast',
  'standard:bounded': 'fast',
  'standard:design': 'strong',
  'deep:prescribed': 'strong',
  'deep:bounded': 'strong',
  'deep:design': 'strong',
});

function buildCodexCatalogCommand() {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'codex debug models'],
    };
  }
  return {
    command: 'codex',
    args: ['debug', 'models'],
  };
}

function normalizeTime(value) {
  const raw = String(value || 'standard').trim().toLowerCase();
  return raw || 'standard';
}

function normalizeContext(value) {
  const raw = String(value || 'prescribed').trim().toLowerCase();
  return raw || 'prescribed';
}

function parseModelCatalog(stdout) {
  const parsed = JSON.parse(String(stdout || '').trim() || '{}');
  const models = Array.isArray(parsed.models) ? parsed.models : [];
  return { models };
}

function decodeTextFile(buffer) {
  if (!Buffer.isBuffer(buffer)) return String(buffer || '');
  if (buffer.length >= 2) {
    const b0 = buffer[0];
    const b1 = buffer[1];
    if (b0 === 0xff && b1 === 0xfe) {
      return buffer.slice(2).toString('utf16le');
    }
    if (b0 === 0xfe && b1 === 0xff) {
      const swapped = Buffer.allocUnsafe(buffer.length - 2);
      for (let i = 2; i + 1 < buffer.length; i += 2) {
        swapped[i - 2] = buffer[i + 1];
        swapped[i - 1] = buffer[i];
      }
      return swapped.toString('utf16le');
    }
  }
  return buffer.toString('utf8');
}

function readCatalogFromFile(baseDir) {
  if (!baseDir) return null;
  const filePath = path.join(baseDir, '.planning', 'team', 'codex-model-catalog.json');
  try {
    if (!fs.existsSync(filePath)) return null;
    return parseModelCatalog(decodeTextFile(fs.readFileSync(filePath)));
  } catch {
    return null;
  }
}

function readCodexModelCatalog(opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  if (
    !opts.bypassCache
    && modelCatalogCache
    && (now - modelCatalogCache.readAt) < CACHE_TTL_MS
  ) {
    return modelCatalogCache.value;
  }

  const fileValue = readCatalogFromFile(opts.baseDir);
  if (fileValue) {
    modelCatalogCache = { readAt: now, value: fileValue };
    return fileValue;
  }

  const spawnSyncImpl = opts.spawnSyncImpl || spawnSync;
  const { command, args } = buildCodexCatalogCommand();
  const result = spawnSyncImpl(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: opts.env || process.env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim();
    throw new Error(stderr || `codex debug models exited ${result.status}`);
  }

  const value = parseModelCatalog(result.stdout);
  modelCatalogCache = { readAt: now, value };
  return value;
}

function listVisibleModelSlugs(catalog) {
  return (catalog.models || [])
    .filter((model) => !model.visibility || model.visibility === 'list')
    .map((model) => model.slug)
    .filter((slug) => typeof slug === 'string' && slug.trim())
    .map((slug) => slug.trim());
}

function pickFirstAvailable(candidates, available) {
  for (const candidate of candidates) {
    if (available.includes(candidate)) return candidate;
  }
  return available[0] || null;
}

function selectTierModels(availableModels) {
  const strongModel = pickFirstAvailable(
    ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini'],
    availableModels,
  );
  const fastModel = pickFirstAvailable(
    ['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.5'],
    availableModels,
  );
  return { fastModel, strongModel };
}

function selectTier(frontmatter = {}) {
  const time = normalizeTime(frontmatter.time);
  const context = normalizeContext(frontmatter.estimated_context);
  const routeKey = `${time}:${context}`;

  if (TIER_MATRIX[routeKey]) {
    return { tier: TIER_MATRIX[routeKey], routeKey };
  }

  if (time === 'deep') return { tier: 'strong', routeKey };
  if (context === 'design' || context === 'exploratory' || context === 'audit' || context === 'decision') {
    return { tier: 'strong', routeKey };
  }
  return { tier: 'fast', routeKey };
}

function runtimeCmdHasModel(runtimeCmd) {
  return /(^|\s)--model(\s|=)/.test(String(runtimeCmd || ''));
}

function injectModelIntoRuntimeCmd(runtimeCmd, model) {
  if (!model || runtimeCmdHasModel(runtimeCmd)) return runtimeCmd;
  return `${runtimeCmd} --model ${model}`;
}

function resolveCodexModelRouting(frontmatter = {}, opts = {}) {
  const catalog = readCodexModelCatalog(opts);
  const availableModels = listVisibleModelSlugs(catalog);
  const { fastModel, strongModel } = selectTierModels(availableModels);
  const { tier, routeKey } = selectTier(frontmatter);
  const selectedModel = tier === 'strong' ? strongModel : fastModel;

  return {
    source: 'codex-debug-models',
    routeKey,
    tier,
    availableModels,
    fastModel,
    strongModel,
    selectedModel,
  };
}

function applyCodexModelRouting(runtimeCmd, frontmatter = {}, opts = {}) {
  if (runtimeCmdHasModel(runtimeCmd)) {
    return {
      runtimeCmd,
      routing: {
        source: 'runtime-cmd-explicit-model',
        routeKey: `${normalizeTime(frontmatter.time)}:${normalizeContext(frontmatter.estimated_context)}`,
        tier: null,
        availableModels: [],
        fastModel: null,
        strongModel: null,
        selectedModel: null,
      },
    };
  }

  const routing = resolveCodexModelRouting(frontmatter, opts);
  return {
    runtimeCmd: injectModelIntoRuntimeCmd(runtimeCmd, routing.selectedModel),
    routing,
  };
}

function __resetCodexModelCatalogCacheForTests() {
  modelCatalogCache = null;
}

module.exports = {
  TIER_MATRIX,
  buildCodexCatalogCommand,
  parseModelCatalog,
  decodeTextFile,
  readCodexModelCatalog,
  listVisibleModelSlugs,
  selectTierModels,
  selectTier,
  runtimeCmdHasModel,
  injectModelIntoRuntimeCmd,
  resolveCodexModelRouting,
  applyCodexModelRouting,
  __resetCodexModelCatalogCacheForTests,
};
