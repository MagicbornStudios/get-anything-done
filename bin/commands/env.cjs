'use strict';
/**
 * gad env — per-project BYOK secrets (task 60-03, decision gad-266)
 *
 * Wraps lib/env-cli.cjs which wraps lib/secrets-store.cjs. Routing-only here.
 *
 * Plus `gad env web` (2026-05-09): localhost paste form for KEY=VALUE blocks
 * → writes to apps/desktop/.env.local. Operator UX: "why cant i just had a
 * cli command like gad env web and i get a simple web server mcp app like
 * modal that pops up that i can just paste in shit with?"
 */

const { defineCommand } = require('citty');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

function createEnvCommand() {
  let _envCliSingleton = null;
  function getEnvCli() {
    if (!_envCliSingleton) {
      const { createEnvCli } = require('../../lib/env-cli.cjs');
      _envCliSingleton = createEnvCli();
    }
    return _envCliSingleton;
  }

  const get = defineCommand({
    meta: {
      name: 'get',
      description: "Decrypt and print a key's value to stdout. Nothing else is printed so it composes with $(...). Exit 1 if the key is missing or the passphrase is invalid.",
    },
    args: {
      key: { type: 'positional', description: 'Key name (e.g. OPENAI_API_KEY)', required: true },
      projectid: { type: 'string', description: 'Project id whose bag to read', required: true },
      version: { type: 'string', description: 'Specific version (default: current)', default: '' },
      passphrase: { type: 'boolean', description: 'Force passphrase prompt — skip keychain', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      const version = args.version ? Number(args.version) : undefined;
      await cli.getCmd({
        keyName: String(args.key),
        projectid: String(args.projectid),
        version: Number.isFinite(version) ? version : undefined,
        passphrase: !!args.passphrase,
      });
    },
  });

  const set = defineCommand({
    meta: {
      name: 'set',
      description: 'Store a key. The value is read from an echoless TTY prompt (not argv — shell history would leak it). Piped stdin is also accepted for scripting: `echo val | gad env set KEY --projectid P`. Creates the project bag + .gitignore entry on first use.',
    },
    args: {
      key: { type: 'positional', description: 'Key name (uppercase-underscore convention)', required: true },
      projectid: { type: 'string', description: 'Project id whose bag to write into', required: true },
      provider: { type: 'string', description: 'Optional provider label (e.g. openai, anthropic)', default: '' },
      scope: { type: 'string', description: 'Optional scope label (e.g. model-api, image-gen)', default: '' },
      passphrase: { type: 'boolean', description: 'Force passphrase prompt — skip keychain', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      await cli.setCmd({
        keyName: String(args.key),
        projectid: String(args.projectid),
        provider: String(args.provider || ''),
        scope: String(args.scope || ''),
        passphrase: !!args.passphrase,
      });
    },
  });

  const list = defineCommand({
    meta: {
      name: 'list',
      description: 'List keys + metadata (name, provider, scope, version, last-rotated). Never prints values. --json emits a JSON array for tooling.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id whose bag to inspect', required: true },
      json: { type: 'boolean', description: 'Emit JSON array instead of a table', default: false },
      passphrase: { type: 'boolean', description: 'Force passphrase prompt — skip keychain', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      await cli.listCmd({
        projectid: String(args.projectid),
        json: !!args.json,
        passphrase: !!args.passphrase,
      });
    },
  });

  const rotate = defineCommand({
    meta: {
      name: 'rotate',
      description: 'Additive rotation. Prompts for the NEW value (echoless TTY or piped stdin), appends a new version, and retires the old with a grace window (default 7 days, range 0-30).',
    },
    args: {
      key: { type: 'positional', description: 'Key name to rotate (must already exist)', required: true },
      projectid: { type: 'string', description: 'Project id whose bag to rotate in', required: true },
      'grace-days': { type: 'string', description: 'Grace period for old version (0-30, default 7)', default: '7' },
      passphrase: { type: 'boolean', description: 'Force passphrase prompt — skip keychain', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      await cli.rotateCmd({
        keyName: String(args.key),
        projectid: String(args.projectid),
        graceDays: args['grace-days'],
        passphrase: !!args.passphrase,
      });
    },
  });

  const revoke = defineCommand({
    meta: {
      name: 'revoke',
      description: 'Remove a key (or a specific version) immediately — no grace. Without --force, prompts for confirmation.',
    },
    args: {
      key: { type: 'positional', description: 'Key name to revoke', required: true },
      projectid: { type: 'string', description: 'Project id whose bag to revoke from', required: true },
      version: { type: 'string', description: 'Revoke a specific version (default: all versions)', default: '' },
      force: { type: 'boolean', description: 'Skip confirmation prompt', default: false },
      passphrase: { type: 'boolean', description: 'Force passphrase prompt — skip keychain', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      const version = args.version ? Number(args.version) : undefined;
      await cli.revokeCmd({
        keyName: String(args.key),
        projectid: String(args.projectid),
        version: Number.isFinite(version) ? version : undefined,
        force: !!args.force,
        passphrase: !!args.passphrase,
      });
    },
  });

  const audit = defineCommand({
    meta: {
      name: 'audit',
      description: 'Show the append-only audit log for a project bag (rotate/revoke/purge events, newest-first). Never prints values — metadata only.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id whose audit log to read', required: true },
      since: { type: 'string', description: 'Filter to events with ts >= this ISO timestamp', default: '' },
      limit: { type: 'string', description: 'Max events to return (default: all)', default: '' },
      json: { type: 'boolean', description: 'Emit JSON {events, nextCursor} instead of a table', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      const parsedLimit = args.limit ? Number(args.limit) : undefined;
      await cli.auditCmd({
        projectid: String(args.projectid),
        since: args.since || null,
        limit: Number.isFinite(parsedLimit) ? parsedLimit : null,
        json: !!args.json,
      });
    },
  });

  const purge = defineCommand({
    meta: {
      name: 'purge',
      description: 'Remove non-current versions whose grace window has elapsed. --dry-run previews without mutating. Current version is always preserved.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id whose bag to purge', required: true },
      'as-of': { type: 'string', description: 'Cutoff timestamp (ISO8601, default: now)', default: '' },
      'dry-run': { type: 'boolean', description: 'Preview what would be purged without writing', default: false },
      json: { type: 'boolean', description: 'Emit JSON result instead of text', default: false },
    },
    async run({ args }) {
      const cli = getEnvCli();
      await cli.purgeCmd({
        projectid: String(args.projectid),
        asOf: args['as-of'] || null,
        dryRun: !!args['dry-run'],
        json: !!args.json,
      });
    },
  });

  // ── web — localhost paste-form for KEY=VALUE blocks ──────────────────────
  // No coupling to lib/env-cli.cjs (deny-listed for claude-code lane). Pure
  // node:http server; writes parsed entries to apps/desktop/.env.local for
  // Vite renderer pickup, optionally also stages the same KEY into the gad
  // secret store via a follow-up `gad env set` invocation per key.
  const webCmd = defineCommand({
    meta: {
      name: 'web',
      description: 'Spawn a localhost paste-form server (default port 3030) for KEY=VALUE env blocks. Writes to apps/desktop/.env.local for Vite renderer pickup. Auto-opens browser. Ctrl+C to stop.',
    },
    args: {
      port: { type: 'string', description: 'TCP port to bind (default 3030)', default: '3030' },
      target: { type: 'string', description: 'Target .env file path (default apps/desktop/.env.local)', default: '' },
      'no-open': { type: 'boolean', description: 'Skip auto-opening the browser', default: false },
    },
    async run({ args }) {
      const port = Number(args.port) || 3030;
      const repoRoot = findRepoRoot();
      const envFilePath = args.target
        ? path.resolve(args.target)
        : path.join(repoRoot, 'apps', 'desktop', '.env.local');

      console.log(`[gad env web] target file : ${envFilePath}`);
      console.log(`[gad env web] starting on http://localhost:${port}`);

      const server = http.createServer((req, res) => {
        if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(renderForm(envFilePath, ''));
          return;
        }
        if (req.method === 'POST' && req.url === '/save') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const params = new URLSearchParams(body);
              const block = params.get('block') ?? '';
              const result = saveEnvBlock(envFilePath, block);
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(renderForm(envFilePath, '', result));
              console.log(`[gad env web] saved ${result.savedCount} entries to ${envFilePath}`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(renderForm(envFilePath, msg));
              console.error(`[gad env web] save failed: ${msg}`);
            }
          });
          return;
        }
        res.writeHead(404);
        res.end('not found');
      });

      server.on('error', (err) => {
        console.error(`[gad env web] server error: ${err.message}`);
        process.exit(1);
      });

      server.listen(port, '127.0.0.1', () => {
        console.log(`[gad env web] http://localhost:${port} ready. Ctrl+C to stop.`);
        if (!args['no-open']) {
          openBrowser(`http://localhost:${port}`);
        }
      });
    },
  });

  return defineCommand({
    meta: {
      name: 'env',
      description: 'Per-project BYOK secrets — get / set / list / rotate / revoke / audit / purge / web. Values are encrypted with AES-256-GCM under a PBKDF2-derived master key and stored at .gad/secrets/<projectid>.enc. See references/byok-design.md.',
    },
    subCommands: { get, set, list, rotate, revoke, audit, purge, web: webCmd },
  });
}

// ─── env web helpers ──────────────────────────────────────────────────────────

function findRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function parseEnvBlock(text) {
  const entries = [];
  const errors = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) {
      errors.push({ line: i + 1, raw, reason: 'expected KEY=VALUE' });
      return;
    }
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries.push({ key: m[1], value });
  });
  return { entries, errors };
}

function mergeEnvFile(existing, updates) {
  const updatesByKey = new Map(updates.map((e) => [e.key, e.value]));
  const lines = existing.split(/\r?\n/);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m && updatesByKey.has(m[1])) {
      out.push(`${m[1]}=${updatesByKey.get(m[1])}`);
      seen.add(m[1]);
    } else {
      out.push(line);
    }
  }
  for (const { key, value } of updates) {
    if (!seen.has(key)) out.push(`${key}=${value}`);
  }
  while (out.length > 1 && out[out.length - 1] === '' && out[out.length - 2] === '') out.pop();
  if (out.length === 0 || out[out.length - 1] !== '') out.push('');
  return out.join('\n');
}

function saveEnvBlock(envFilePath, block) {
  const { entries, errors } = parseEnvBlock(block);
  let existing = '';
  try {
    if (fs.existsSync(envFilePath)) existing = fs.readFileSync(envFilePath, 'utf8');
  } catch {}
  const merged = mergeEnvFile(existing, entries);
  fs.mkdirSync(path.dirname(envFilePath), { recursive: true });
  fs.writeFileSync(envFilePath, merged, 'utf8');
  return {
    savedCount: entries.length,
    errors,
    viteCount: entries.filter((e) => e.key.startsWith('VITE_')).length,
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

function renderForm(envFilePath, errorMsg, saveResult) {
  const targetEsc = escapeHtml(envFilePath);
  const errBlock = errorMsg
    ? `<div class="err">${escapeHtml(errorMsg)}</div>`
    : '';
  let savedBlock = '';
  if (saveResult) {
    const errs = (saveResult.errors || []).map((e) =>
      `<li>line ${e.line}: ${escapeHtml(e.reason)} — <code>${escapeHtml(e.raw)}</code></li>`).join('');
    savedBlock = `
      <div class="ok">
        Saved ${saveResult.savedCount} entries (${saveResult.viteCount} VITE_*).
        Vite picks them up on next page reload of the desktop app.
        ${errs ? `<ul>${errs}</ul>` : ''}
      </div>
    `;
  }
  return `<!doctype html>
<html><head>
<meta charset="utf-8"/>
<title>gad env web</title>
<style>
  body { background: #0d0d0d; color: #e8e8e8; font-family: ui-monospace, Menlo, Consolas, monospace; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  h1 { color: #FFD700; font-size: 1rem; letter-spacing: 0.18em; text-transform: uppercase; margin: 0 0 0.5rem; }
  p.muted { color: #888; font-size: 0.78rem; margin-top: 0; }
  textarea { width: 100%; min-height: 240px; background: #050505; color: #FFD700; border: 1px solid #8C6E10; padding: 0.6rem; font: 0.78rem ui-monospace, Consolas, monospace; resize: vertical; }
  button { background: rgba(212,160,23,0.10); color: #FFD700; border: 1px solid #D4A017; padding: 0.5rem 1rem; font: 0.65rem ui-monospace, Consolas, monospace; text-transform: uppercase; letter-spacing: 0.18em; cursor: pointer; margin-top: 0.5rem; }
  button:hover { background: rgba(212,160,23,0.18); }
  .err { background: rgba(201,42,42,0.10); color: #C92A2A; border: 1px solid #C92A2A; padding: 0.5rem; margin-top: 0.5rem; font-size: 0.7rem; }
  .ok  { background: rgba(212,160,23,0.10); color: #FFD700; border: 1px solid #D4A017; padding: 0.5rem; margin-top: 0.5rem; font-size: 0.7rem; }
  code { background: #1a1a1a; padding: 0.05rem 0.25rem; }
</style>
</head><body>
  <h1>gad env web</h1>
  <p class="muted">target: <code>${targetEsc}</code></p>
  <p class="muted">paste KEY=VALUE per line. comments (<code>#</code>) and blanks ignored. quoted values unquoted. <code>VITE_*</code>-prefixed keys land where Vite renderer reads them.</p>
  <form method="POST" action="/save">
    <textarea name="block" placeholder="VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_OPENAI_API_KEY=sk-...
IONOS_API_KEY=prefix.secret
MODAL_VLLM_URL=https://..." autofocus></textarea>
    <br/>
    <button type="submit">save</button>
  </form>
  ${errBlock}
  ${savedBlock}
</body></html>`;
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"` :
    process.platform === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.warn(`[gad env web] failed to auto-open browser: ${err.message}`);
  });
}

module.exports = { createEnvCommand };
module.exports.register = () => ({ env: createEnvCommand() });
