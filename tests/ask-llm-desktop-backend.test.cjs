'use strict';
/**
 * tests/ask-llm-desktop-backend.test.cjs
 *
 * Unit tests for the desktop-first routing in _ask-llm.cjs (GLOBAL-D-452 / 287-02).
 *
 * Coverage:
 *   1. checkDeskHealth() returns ok body when server is up
 *   2. checkDeskHealth() throws (fast) when server is unreachable
 *   3. checkDeskHealth() throws when server returns ok:false
 *   4. resolveBackend('auto') returns 'desktop' (desktop is always first candidate)
 *   5. resolveBackend('desktop') returns 'desktop'
 *   6. fallbackBackend() with MODAL_VLLM_URL set returns 'modal'
 *   7. fallbackBackend() with only ANTHROPIC_API_KEY returns 'direct'
 *   8. fallbackBackend() with nothing set returns null
 *   9. runAskLlm auto → routes to desktop when desk is alive, emits JSON with backend='desktop'
 *  10. runAskLlm auto → falls through to modal when desk is unreachable
 *  11. deskAssistantBaseUrl() respects GAD_DESK_ASSISTANT_URL env override
 *
 * Tests 1-8 and 11 run in-process.
 * Tests 9-10 (runAskLlm end-to-end) run in isolated child processes so the
 * node test-runner's binary stdout protocol never contaminates captured output.
 *
 * All HTTP is served by real in-process servers (no monkey-patching).
 * No live network / external process required.
 */

const { describe, test, before, after } = require('node:test');
const assert  = require('node:assert/strict');
const http    = require('node:http');
const path    = require('node:path');
const { execFile } = require('node:child_process');

const modulePath = path.resolve(__dirname, '..', 'bin', 'commands', '_ask-llm.cjs');
const gadRoot    = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Start an HTTP server on a random port, return the server instance. */
function startServer(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

function serverUrl(srv) {
  const { address, port } = srv.address();
  return `http://${address}:${port}`;
}

/** Fresh require (bust module cache between tests that mutate env vars). */
function freshModule() {
  delete require.cache[modulePath];
  return require(modulePath);
}

/**
 * Run an inline node script as a child process in gadRoot; return { stdout, stderr, code }.
 * Env vars in opts.env are MERGED on top of the current process.env.
 * Pass empty string '' to unset a key in the child.
 */
function runScript(script, { env = {}, timeoutMs = 10000 } = {}) {
  // Build a clean env: start from current env, then apply overrides.
  // Empty-string values are deleted so the key is absent in the child.
  const childEnv = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === '') delete childEnv[k];
    else childEnv[k] = v;
  }

  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['-e', script],
      { env: childEnv, timeout: timeoutMs, cwd: gadRoot },
      (err, stdout, stderr) => {
        resolve({ stdout, stderr, code: err ? (err.code ?? 1) : 0 });
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Save / restore env (in-process tests only)
// ---------------------------------------------------------------------------

let savedEnv = {};
const ENV_KEYS = [
  'GAD_DESK_ASSISTANT_URL',
  'GAD_DESK_ASSISTANT_REQUIRE',
  'MODAL_VLLM_URL',
  'AI_GATEWAY_API_KEY',
  'ANTHROPIC_API_KEY',
  'MODAL_VLLM_MODEL',
  'MODAL_VLLM_TOKEN',
];

before(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
});

after(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  delete require.cache[modulePath];
});

// ---------------------------------------------------------------------------
// 1–3: checkDeskHealth
// ---------------------------------------------------------------------------

describe('checkDeskHealth', () => {
  test('returns ok body when server responds with ok:true', async () => {
    const srv = await startServer((req, res) => {
      if (req.url === '/assistant/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, backend: 'ollama', model: 'llama3.2' }));
      } else {
        res.writeHead(404); res.end();
      }
    });
    try {
      process.env.GAD_DESK_ASSISTANT_URL = serverUrl(srv);
      const { checkDeskHealth } = freshModule();
      const result = await checkDeskHealth(2000);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.backend, 'ollama');
      assert.strictEqual(result.model, 'llama3.2');
    } finally {
      delete process.env.GAD_DESK_ASSISTANT_URL;
      srv.close();
    }
  });

  test('throws on ECONNREFUSED (unreachable port)', async () => {
    const tmp = await startServer((_, res) => res.end());
    const unusedPort = tmp.address().port;
    await new Promise((r) => tmp.close(r));

    process.env.GAD_DESK_ASSISTANT_URL = `http://127.0.0.1:${unusedPort}`;
    const { checkDeskHealth } = freshModule();
    await assert.rejects(() => checkDeskHealth(1500), /ECONNREFUSED|fetch|abort|network/i);
    delete process.env.GAD_DESK_ASSISTANT_URL;
  });

  test('throws when server returns ok:false', async () => {
    const srv = await startServer((req, res) => {
      if (req.url === '/assistant/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, reason: 'backend not ready' }));
      } else {
        res.writeHead(404); res.end();
      }
    });
    try {
      process.env.GAD_DESK_ASSISTANT_URL = serverUrl(srv);
      const { checkDeskHealth } = freshModule();
      await assert.rejects(() => checkDeskHealth(2000), /ok:false/);
    } finally {
      delete process.env.GAD_DESK_ASSISTANT_URL;
      srv.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 4–5: resolveBackend
// ---------------------------------------------------------------------------

describe('resolveBackend', () => {
  test("auto resolves to 'desktop'", () => {
    const { resolveBackend } = freshModule();
    assert.strictEqual(resolveBackend('auto'), 'desktop');
  });

  test("'desktop' resolves to 'desktop'", () => {
    const { resolveBackend } = freshModule();
    assert.strictEqual(resolveBackend('desktop'), 'desktop');
  });
});

// ---------------------------------------------------------------------------
// 6–8: fallbackBackend
// ---------------------------------------------------------------------------

describe('fallbackBackend', () => {
  test("returns 'modal' when MODAL_VLLM_URL is set", () => {
    process.env.MODAL_VLLM_URL = 'http://modal.example.com/v1/chat';
    const { fallbackBackend } = freshModule();
    assert.strictEqual(fallbackBackend(), 'modal');
    delete process.env.MODAL_VLLM_URL;
  });

  test("returns 'direct' when only ANTHROPIC_API_KEY is set", () => {
    delete process.env.MODAL_VLLM_URL;
    delete process.env.AI_GATEWAY_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const { fallbackBackend } = freshModule();
    assert.strictEqual(fallbackBackend(), 'direct');
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('returns null when no fallback env is set', () => {
    delete process.env.MODAL_VLLM_URL;
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const { fallbackBackend } = freshModule();
    assert.strictEqual(fallbackBackend(), null);
  });
});

// ---------------------------------------------------------------------------
// 11: deskAssistantBaseUrl
// ---------------------------------------------------------------------------

describe('deskAssistantBaseUrl', () => {
  test('defaults to http://127.0.0.1:5400', () => {
    delete process.env.GAD_DESK_ASSISTANT_URL;
    const { deskAssistantBaseUrl } = freshModule();
    assert.strictEqual(deskAssistantBaseUrl(), 'http://127.0.0.1:5400');
  });

  test('reads GAD_DESK_ASSISTANT_URL and strips trailing slash', () => {
    process.env.GAD_DESK_ASSISTANT_URL = 'http://localhost:9999/';
    const { deskAssistantBaseUrl } = freshModule();
    assert.strictEqual(deskAssistantBaseUrl(), 'http://localhost:9999');
    delete process.env.GAD_DESK_ASSISTANT_URL;
  });
});

// ---------------------------------------------------------------------------
// 9–10: runAskLlm end-to-end routing (child-process isolated)
//
// Tests run in child processes so the test runner's binary stdout messages
// never appear in the captured output we parse as JSON.
// ---------------------------------------------------------------------------

describe('runAskLlm — desktop routing (child-process isolated)', () => {
  test('routes to desktop and returns backend=desktop in JSON output when desk is alive', async () => {
    // Spin up a fake desk server (health + chat)
    const srv = await startServer((req, res) => {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => {
        if (req.url === '/assistant/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, backend: 'ollama', model: 'llama3.2' }));
        } else if (req.url === '/assistant/chat' && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reply: 'Hello from desk!', model: 'llama3.2', backend: 'ollama' }));
        } else {
          res.writeHead(404); res.end();
        }
      });
    });

    const deskUrl = serverUrl(srv);

    try {
      const script = `
        const { runAskLlm } = require('./bin/commands/_ask-llm.cjs');
        runAskLlm({
          question: 'test question',
          backend: 'auto',
          soul: 'kael',
          json: true,
          maxTokens: 512,
          noContext: true,
          projectRoot: process.cwd(),
        }).catch(e => { process.stderr.write(e.message + '\\n'); process.exit(1); });
      `;

      const { stdout, stderr, code } = await runScript(script, {
        env: {
          GAD_DESK_ASSISTANT_URL: deskUrl,
          MODAL_VLLM_URL: '',
          AI_GATEWAY_API_KEY: '',
          ANTHROPIC_API_KEY: '',
        },
        timeoutMs: 8000,
      });

      assert.strictEqual(code, 0, `expected exit 0, got ${code}. stderr: ${stderr}`);
      const lines = stdout.trim().split('\n').filter(l => l.trim().startsWith('{'));
      assert.ok(lines.length > 0, `no JSON line found in stdout: ${JSON.stringify(stdout)}`);
      const parsed = JSON.parse(lines[lines.length - 1]);
      assert.strictEqual(parsed.backend, 'desktop', `expected backend=desktop, got ${parsed.backend}`);
      assert.strictEqual(parsed.text, 'Hello from desk!', `expected reply text, got: ${parsed.text}`);
      assert.ok(!parsed.error, `unexpected error: ${parsed.error}`);
    } finally {
      srv.close();
    }
  });

  test('falls through to modal when desk is unreachable', async () => {
    // Fake modal SSE server
    const modalSrv = await startServer((req, res) => {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => {
        if (req.url === '/chat' && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          res.write('data: {"choices":[{"delta":{"content":"modal reply"}}]}\n\n');
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          res.writeHead(404); res.end();
        }
      });
    });

    // Dead desk: grab a port then close it immediately
    const tmpSrv = await startServer((_, res) => res.end());
    const deadPort = tmpSrv.address().port;
    await new Promise((r) => tmpSrv.close(r));

    const modalUrl = `${serverUrl(modalSrv)}/chat`;

    try {
      const script = `
        const { runAskLlm } = require('./bin/commands/_ask-llm.cjs');
        runAskLlm({
          question: 'test fallback',
          backend: 'auto',
          soul: 'kael',
          json: true,
          maxTokens: 512,
          noContext: true,
          projectRoot: process.cwd(),
        }).catch(e => { process.stderr.write(e.message + '\\n'); process.exit(1); });
      `;

      const { stdout, stderr, code } = await runScript(script, {
        env: {
          GAD_DESK_ASSISTANT_URL: `http://127.0.0.1:${deadPort}`,
          MODAL_VLLM_URL: modalUrl,
          MODAL_VLLM_MODEL: 'test-model',
          AI_GATEWAY_API_KEY: '',
          ANTHROPIC_API_KEY: '',
        },
        timeoutMs: 8000,
      });

      assert.strictEqual(code, 0, `expected exit 0, got ${code}. stderr: ${stderr}`);
      const lines = stdout.trim().split('\n').filter(l => l.trim().startsWith('{'));
      assert.ok(lines.length > 0, `no JSON line found in stdout: ${JSON.stringify(stdout)}`);
      const parsed = JSON.parse(lines[lines.length - 1]);
      assert.strictEqual(parsed.backend, 'modal', `expected backend=modal (fallback), got ${parsed.backend}`);
      assert.ok(parsed.text.includes('modal reply'), `expected modal reply in text, got: ${parsed.text}`);
      assert.ok(!parsed.error, `unexpected error: ${parsed.error}`);
    } finally {
      modalSrv.close();
    }
  });
});
