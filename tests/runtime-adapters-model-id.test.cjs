'use strict';
/**
 * tests/runtime-adapters-model-id.test.cjs
 *
 * Unit tests for scripts/runtime-adapters/*.mjs — model_id + token extraction.
 *
 * All tests use captured/hand-crafted fixtures. No live CLI calls.
 * No daemon, no gad system start.
 *
 * Run: node --test tests/runtime-adapters-model-id.test.cjs
 */

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const ADAPTERS_DIR = path.resolve(__dirname, '..', 'scripts', 'runtime-adapters');
const SUBSTRATE_PATH = path.resolve(__dirname, '..', 'scripts', 'runtime-substrate-core.mjs');

// Dynamic import helpers (CJS test importing ESM adapters)
async function loadAdapter(name) {
  const p = path.join(ADAPTERS_DIR, `${name}.mjs`);
  assert.ok(fs.existsSync(p), `adapter file missing: ${p}`);
  return import(pathToFileURL(p).href);
}

async function loadSubstrate() {
  assert.ok(fs.existsSync(SUBSTRATE_PATH), `substrate file missing: ${SUBSTRATE_PATH}`);
  return import(pathToFileURL(SUBSTRATE_PATH).href);
}

// ---------------------------------------------------------------------------
// claude-code adapter
// ---------------------------------------------------------------------------

describe('claude-code adapter — parseResponse', () => {
  // Captured fixture: claude --output-format json JSONL stream
  // type=result message with usage from claude-sonnet-4-6
  const FIXTURE_RESULT_TYPE = [
    JSON.stringify({ type: 'system', subtype: 'init', session_id: 'abc123' }),
    JSON.stringify({
      type: 'result',
      subtype: 'success',
      message: {
        id: 'msg_01XyZ',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        content: [{ type: 'text', text: 'Hello, world!' }],
        usage: { input_tokens: 1024, output_tokens: 128, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      },
      cost_usd: 0.001,
    }),
  ].join('\n');

  // Fixture: claude-opus-4-7 response
  const FIXTURE_OPUS = JSON.stringify({
    type: 'result',
    subtype: 'success',
    message: {
      model: 'claude-opus-4-7',
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 512, output_tokens: 64 },
    },
  });

  // Fixture: haiku (flat top-level model field, no type=result)
  const FIXTURE_FLAT = JSON.stringify({
    model: 'claude-haiku-4-5',
    usage: { input_tokens: 200, output_tokens: 50 },
  });

  // Fixture: empty stdout
  const FIXTURE_EMPTY = '';

  // Fixture: non-JSON garbage
  const FIXTURE_GARBAGE = 'Unexpected error: SIGPIPE\nsome more text';

  test('extracts model_id + tokens from type=result JSONL stream', async () => {
    const { parseResponse } = await loadAdapter('claude-code');
    const r = parseResponse(FIXTURE_RESULT_TYPE);
    assert.equal(r.model_id, 'claude-sonnet-4-6');
    assert.equal(r.tokens_in, 1024);
    assert.equal(r.tokens_out, 128);
  });

  test('extracts claude-opus-4-7 from single-line result', async () => {
    const { parseResponse } = await loadAdapter('claude-code');
    const r = parseResponse(FIXTURE_OPUS);
    assert.equal(r.model_id, 'claude-opus-4-7');
    assert.equal(r.tokens_in, 512);
    assert.equal(r.tokens_out, 64);
  });

  test('extracts from flat top-level model field (haiku)', async () => {
    const { parseResponse } = await loadAdapter('claude-code');
    const r = parseResponse(FIXTURE_FLAT);
    assert.equal(r.model_id, 'claude-haiku-4-5');
    assert.equal(r.tokens_in, 200);
    assert.equal(r.tokens_out, 50);
  });

  test('returns nulls for empty stdout', async () => {
    const { parseResponse } = await loadAdapter('claude-code');
    const r = parseResponse(FIXTURE_EMPTY);
    assert.equal(r.model_id, null);
    assert.equal(r.tokens_in, null);
    assert.equal(r.tokens_out, null);
  });

  test('returns nulls for non-JSON garbage', async () => {
    const { parseResponse } = await loadAdapter('claude-code');
    const r = parseResponse(FIXTURE_GARBAGE);
    assert.equal(r.model_id, null);
    assert.equal(r.tokens_in, null);
    assert.equal(r.tokens_out, null);
  });
});

// ---------------------------------------------------------------------------
// codex-cli adapter
// ---------------------------------------------------------------------------

describe('codex-cli adapter — parseResponse', () => {
  // Fixture: gpt-5 JSON response (OpenAI chat completion shape)
  const FIXTURE_GPT5 = JSON.stringify({
    id: 'chatcmpl-abc',
    object: 'chat.completion',
    model: 'gpt-5',
    choices: [{ message: { role: 'assistant', content: 'done' } }],
    usage: { prompt_tokens: 800, completion_tokens: 150, total_tokens: 950 },
  });

  // Fixture: gpt-5.5 with newer token field names
  const FIXTURE_GPT55 = JSON.stringify({
    model: 'gpt-5.5',
    usage: { input_tokens: 600, output_tokens: 80 },
  });

  // Fixture: JSONL stream with model on second line
  const FIXTURE_JSONL = [
    JSON.stringify({ type: 'start', session: 'sess-1' }),
    JSON.stringify({ model: 'o4-mini', usage: { prompt_tokens: 300, completion_tokens: 45 } }),
  ].join('\n');

  // Fixture: no model field at all
  const FIXTURE_NO_MODEL = JSON.stringify({
    usage: { prompt_tokens: 100, completion_tokens: 20 },
  });

  test('extracts gpt-5 model + legacy token names', async () => {
    const { parseResponse } = await loadAdapter('codex-cli');
    const r = parseResponse(FIXTURE_GPT5);
    assert.equal(r.model_id, 'gpt-5');
    assert.equal(r.tokens_in, 800);
    assert.equal(r.tokens_out, 150);
  });

  test('extracts gpt-5.5 with newer input_tokens/output_tokens', async () => {
    const { parseResponse } = await loadAdapter('codex-cli');
    const r = parseResponse(FIXTURE_GPT55);
    assert.equal(r.model_id, 'gpt-5.5');
    assert.equal(r.tokens_in, 600);
    assert.equal(r.tokens_out, 80);
  });

  test('scans JSONL to find model on second line', async () => {
    const { parseResponse } = await loadAdapter('codex-cli');
    const r = parseResponse(FIXTURE_JSONL);
    assert.equal(r.model_id, 'o4-mini');
    assert.equal(r.tokens_in, 300);
    assert.equal(r.tokens_out, 45);
  });

  test('returns null model_id when no model field present', async () => {
    const { parseResponse } = await loadAdapter('codex-cli');
    const r = parseResponse(FIXTURE_NO_MODEL);
    assert.equal(r.model_id, null);
    assert.equal(r.tokens_in, 100);
    assert.equal(r.tokens_out, 20);
  });

  test('returns all nulls for empty stdout', async () => {
    const { parseResponse } = await loadAdapter('codex-cli');
    const r = parseResponse('');
    assert.equal(r.model_id, null);
    assert.equal(r.tokens_in, null);
    assert.equal(r.tokens_out, null);
  });
});

// ---------------------------------------------------------------------------
// gemini-cli adapter
// ---------------------------------------------------------------------------

describe('gemini-cli adapter — parseResponse', () => {
  // Fixture: gemini-3-flash-preview output (Gemini API --output-format json)
  const FIXTURE_FLASH = JSON.stringify({
    candidates: [
      {
        content: { parts: [{ text: 'Hello' }], role: 'model' },
        finishReason: 'STOP',
      },
    ],
    modelVersion: 'gemini-3-flash-preview',
    usageMetadata: {
      promptTokenCount: 512,
      candidatesTokenCount: 64,
      totalTokenCount: 576,
    },
  });

  // Fixture: gemini-2.5-pro with thoughts tokens
  const FIXTURE_PRO_THOUGHTS = JSON.stringify({
    modelVersion: 'gemini-2.5-pro',
    usageMetadata: {
      promptTokenCount: 1024,
      candidatesTokenCount: 200,
      thoughtsTokenCount: 100,
      totalTokenCount: 1324,
    },
  });

  // Fixture: fallback flat model field
  const FIXTURE_FLAT_MODEL = JSON.stringify({
    model: 'gemini-2.0-flash',
    usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 40 },
  });

  // Fixture: JSONL stream (gemini can emit streaming JSON)
  const FIXTURE_JSONL = [
    JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello' }] } }] }),
    JSON.stringify({
      modelVersion: 'gemini-2.5-pro',
      usageMetadata: { promptTokenCount: 800, candidatesTokenCount: 90 },
    }),
  ].join('\n');

  test('extracts gemini-3-flash-preview + token counts', async () => {
    const { parseResponse } = await loadAdapter('gemini-cli');
    const r = parseResponse(FIXTURE_FLASH);
    assert.equal(r.model_id, 'gemini-3-flash-preview');
    assert.equal(r.tokens_in, 512);
    assert.equal(r.tokens_out, 64);
  });

  test('sums candidatesTokenCount + thoughtsTokenCount for pro models', async () => {
    const { parseResponse } = await loadAdapter('gemini-cli');
    const r = parseResponse(FIXTURE_PRO_THOUGHTS);
    assert.equal(r.model_id, 'gemini-2.5-pro');
    assert.equal(r.tokens_in, 1024);
    assert.equal(r.tokens_out, 300); // 200 + 100
  });

  test('falls back to flat model field', async () => {
    const { parseResponse } = await loadAdapter('gemini-cli');
    const r = parseResponse(FIXTURE_FLAT_MODEL);
    assert.equal(r.model_id, 'gemini-2.0-flash');
    assert.equal(r.tokens_in, 300);
    assert.equal(r.tokens_out, 40);
  });

  test('scans JSONL for modelVersion', async () => {
    const { parseResponse } = await loadAdapter('gemini-cli');
    const r = parseResponse(FIXTURE_JSONL);
    assert.equal(r.model_id, 'gemini-2.5-pro');
    assert.equal(r.tokens_in, 800);
    assert.equal(r.tokens_out, 90);
  });

  test('returns nulls for empty stdout', async () => {
    const { parseResponse } = await loadAdapter('gemini-cli');
    const r = parseResponse('');
    assert.equal(r.model_id, null);
    assert.equal(r.tokens_in, null);
    assert.equal(r.tokens_out, null);
  });
});

// ---------------------------------------------------------------------------
// opencode adapter
// ---------------------------------------------------------------------------

describe('opencode adapter — parseResponse', () => {
  const os = require('node:os');
  const path = require('node:path');
  const fs = require('node:fs');

  // Fixture: opencode structured stdout JSON with model + usage
  const FIXTURE_STDOUT_JSON = JSON.stringify({
    model: 'anthropic/claude-sonnet-4-6',
    usage: { input_tokens: 400, output_tokens: 60 },
  });

  // Fixture: config file with top-level model field
  function writeConfig(dir, obj) {
    const confDir = path.join(dir, '.config', 'opencode');
    fs.mkdirSync(confDir, { recursive: true });
    const confPath = path.join(confDir, 'config.json');
    fs.writeFileSync(confPath, JSON.stringify(obj), 'utf8');
    return confPath;
  }

  test('extracts model + tokens from stdout JSON', async () => {
    const { parseResponse } = await loadAdapter('opencode');
    const r = parseResponse(FIXTURE_STDOUT_JSON, { configPath: '/nonexistent/config.json' });
    assert.equal(r.model_id, 'anthropic/claude-sonnet-4-6');
    assert.equal(r.tokens_in, 400);
    assert.equal(r.tokens_out, 60);
  });

  test('reads model from config file when stdout has no model', async () => {
    const { parseResponse } = await loadAdapter('opencode');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-test-'));
    const confPath = writeConfig(tmpDir, { model: 'openai/gpt-5' });
    try {
      const r = parseResponse('', { configPath: confPath });
      assert.equal(r.model_id, 'openai/gpt-5');
      assert.equal(r.tokens_in, null);
      assert.equal(r.tokens_out, null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('reads model from config provider.model nested field', async () => {
    const { parseResponse } = await loadAdapter('opencode');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-test-'));
    const confPath = writeConfig(tmpDir, { provider: { model: 'google/gemini-3-flash' } });
    try {
      const r = parseResponse('', { configPath: confPath });
      assert.equal(r.model_id, 'google/gemini-3-flash');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('OPENCODE_MODEL env var overrides everything', async () => {
    const { parseResponse } = await loadAdapter('opencode');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-test-'));
    const confPath = writeConfig(tmpDir, { model: 'openai/gpt-5' });
    try {
      const r = parseResponse(
        JSON.stringify({ model: 'anthropic/claude-opus-4-7' }),
        { configPath: confPath, env: { OPENCODE_MODEL: 'custom/my-model' } },
      );
      assert.equal(r.model_id, 'custom/my-model');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns null model_id when config absent and no stdout model', async () => {
    const { parseResponse } = await loadAdapter('opencode');
    const r = parseResponse('', { configPath: '/nonexistent/config.json', env: {} });
    assert.equal(r.model_id, null);
    assert.equal(r.tokens_in, null);
    assert.equal(r.tokens_out, null);
  });

  test('readModelFromConfig reads top-level model', async () => {
    const { readModelFromConfig } = await loadAdapter('opencode');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-cfg-test-'));
    const confPath = writeConfig(tmpDir, { model: 'openai/gpt-5.5' });
    try {
      const m = readModelFromConfig(confPath);
      assert.equal(m, 'openai/gpt-5.5');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('readModelFromConfig returns null for nonexistent path', async () => {
    const { readModelFromConfig } = await loadAdapter('opencode');
    const m = readModelFromConfig('/nonexistent/path/config.json');
    assert.equal(m, null);
  });
});

// ---------------------------------------------------------------------------
// runtime-substrate-core.mjs — buildTelemetryPayload
// ---------------------------------------------------------------------------

describe('runtime-substrate-core — buildTelemetryPayload', () => {
  // Fixture: claude-sonnet-4-6 JSONL response
  const CLAUDE_STDOUT = JSON.stringify({
    type: 'result',
    subtype: 'success',
    message: {
      model: 'claude-sonnet-4-6',
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 2048, output_tokens: 256 },
    },
  });

  // Fixture: gpt-5 response
  const CODEX_STDOUT = JSON.stringify({
    model: 'gpt-5',
    usage: { prompt_tokens: 500, completion_tokens: 100 },
  });

  // Fixture: gemini-3-flash-preview response
  const GEMINI_STDOUT = JSON.stringify({
    modelVersion: 'gemini-3-flash-preview',
    usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 90 },
  });

  test('dispatches to claude-code adapter and returns correct envelope fields', async () => {
    const substrate = await loadSubstrate();
    const payload = await substrate.buildTelemetryPayload('claude-code', CLAUDE_STDOUT);
    assert.equal(payload.model_id, 'claude-sonnet-4-6');
    assert.equal(payload.tokens_in, 2048);
    assert.equal(payload.tokens_out, 256);
  });

  test('dispatches to codex-cli adapter', async () => {
    const substrate = await loadSubstrate();
    const payload = await substrate.buildTelemetryPayload('codex-cli', CODEX_STDOUT);
    assert.equal(payload.model_id, 'gpt-5');
    assert.equal(payload.tokens_in, 500);
    assert.equal(payload.tokens_out, 100);
  });

  test('dispatches to gemini-cli adapter', async () => {
    const substrate = await loadSubstrate();
    const payload = await substrate.buildTelemetryPayload('gemini-cli', GEMINI_STDOUT);
    assert.equal(payload.model_id, 'gemini-3-flash-preview');
    assert.equal(payload.tokens_in, 700);
    assert.equal(payload.tokens_out, 90);
  });

  test('dispatches to opencode adapter (stdout empty, config absent)', async () => {
    const substrate = await loadSubstrate();
    const payload = await substrate.buildTelemetryPayload('opencode', '', {
      configPath: '/nonexistent/config.json',
      env: {},
    });
    // genuinely unknown — must be null, not a guess
    assert.equal(payload.model_id, null);
  });

  test('returns null model_id for unknown runtimeId', async () => {
    const substrate = await loadSubstrate();
    const payload = await substrate.buildTelemetryPayload('unknown-runtime-xyz', '{}');
    assert.equal(payload.model_id, null);
    assert.equal(payload.tokens_in, null);
    assert.equal(payload.tokens_out, null);
  });

  test('returns null fields for empty stdout on any runtime', async () => {
    const substrate = await loadSubstrate();
    for (const rt of ['claude-code', 'codex-cli', 'gemini-cli']) {
      const payload = await substrate.buildTelemetryPayload(rt, '');
      assert.equal(payload.model_id, null, `${rt}: model_id should be null`);
      assert.equal(payload.tokens_in, null, `${rt}: tokens_in should be null`);
      assert.equal(payload.tokens_out, null, `${rt}: tokens_out should be null`);
    }
  });

  test('existing normalizeErrorCode still works (no regression)', async () => {
    const substrate = await loadSubstrate();
    const result = substrate.normalizeErrorCode('AttachConsole failed at conpty.js:1', 1, 'gemini-cli');
    assert.equal(result.code, 'runtime_crash');
  });

  test('sample envelope shape has all required fields', async () => {
    const substrate = await loadSubstrate();
    const payload = await substrate.buildTelemetryPayload('claude-code', CLAUDE_STDOUT);
    // Verify the shape matches what telemetry sink expects
    assert.ok(Object.hasOwn(payload, 'model_id'), 'has model_id');
    assert.ok(Object.hasOwn(payload, 'tokens_in'), 'has tokens_in');
    assert.ok(Object.hasOwn(payload, 'tokens_out'), 'has tokens_out');
    assert.equal(typeof payload.model_id, 'string');
    assert.equal(typeof payload.tokens_in, 'number');
    assert.equal(typeof payload.tokens_out, 'number');
  });
});
