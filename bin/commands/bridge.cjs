'use strict';
/**
 * gad bridge — cross-instance / cross-project handoff coordination
 *              + chat-channel integrations (Discord / WhatsApp / SMS).
 *
 * Original subcommands (2026-05-07):
 *   inbox              — one-shot list of open handoffs across all
 *                        registered planning roots (gad-config.toml)
 *   watch              — long-running poll (30s default), prints diffs
 *                        as new handoffs appear in any project's
 *                        .planning/handoffs/open/
 *   send <to-project>  — quick handoff create against another project's
 *                        queue with sensible defaults
 *
 * Chat-channel subcommands (2026-05-09 — operator: "we do need whatsapp,
 * phone, discord integrations. whatever is easiest. kael should help me
 * set up everything by next session."):
 *   discord send <channel> "<message>" [--webhook-url <url>] [--dry-run]
 *   discord channels list [--json]
 *   discord channels add <name> --webhook-url <url>
 *   discord receive [--port N] [--detach] [--dry-run]
 *   whatsapp send <to> "<message>" [--from <number>] [--provider twilio] [--dry-run]
 *   sms send <to> "<message>" [--from <number>] [--provider twilio] [--dry-run]
 *   status [--json]
 *
 * Design rule: bridges that EMIT (outbound to Discord/WhatsApp/SMS) are
 * opt-in — never fire real messages without explicit operator configuration.
 * --dry-run always prints the would-be payload without firing.
 *
 * No new npm dependencies. Discord webhook = native fetch (Node ≥18).
 * Twilio = REST API with HTTP basic auth via native fetch.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { defineCommand } = require('citty');

const gadConfig = require('../gad-config.cjs');

// ---------------------------------------------------------------------------
// Bridge state dir helpers
// ---------------------------------------------------------------------------

/** Returns .planning/bridges/<provider>/ — creates it on first use. */
function bridgesDir(baseDir, provider) {
  const dir = path.join(baseDir, '.planning', 'bridges', provider);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Append a JSONL record to the bridge audit log for a provider. */
function appendBridgeLog(baseDir, provider, record) {
  const dir = bridgesDir(baseDir, provider);
  const date = new Date().toISOString().slice(0, 10);
  const logFile = path.join(dir, `${date}.jsonl`);
  fs.appendFileSync(logFile, JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n');
}

/** Read last-success timestamp from bridge log. Returns ISO string or null. */
function lastSuccess(baseDir, provider) {
  try {
    const dir = path.join(baseDir, '.planning', 'bridges', provider);
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort().reverse();
    for (const f of files) {
      const lines = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).reverse();
      for (const l of lines) {
        try {
          const obj = JSON.parse(l);
          if (obj.type === 'send_success' || obj.type === 'receive_message') return obj.ts;
        } catch (_) {}
      }
    }
    return null;
  } catch (_) { return null; }
}

// ---------------------------------------------------------------------------
// Discord helpers
// ---------------------------------------------------------------------------

/**
 * Returns { channels: Map<name, webhookUrl>, defaultWebhook: string|null }
 * from gad-config.toml [bridge.discord.*].
 *
 * TOML shape expected:
 *   [bridge.discord]
 *   default_webhook_url = "https://discord.com/api/webhooks/..."
 *   [bridge.discord.channels]
 *   kael-inbox = "https://discord.com/api/webhooks/..."
 */
function loadDiscordConfig(baseDir) {
  const cfg = gadConfig.load(baseDir);
  const bridge = cfg.bridge || {};
  const disc = bridge.discord || {};
  const channels = {};
  if (disc.channels && typeof disc.channels === 'object') {
    Object.assign(channels, disc.channels);
  }
  const defaultWebhook = process.env.DISCORD_WEBHOOK_URL
    || disc.default_webhook_url
    || null;
  return { channels, defaultWebhook };
}

/** Write a channel → webhook mapping into gad-config.toml. */
function addDiscordChannel(baseDir, name, webhookUrl) {
  const tomlPath = path.join(baseDir, '.planning', 'gad-config.toml');
  // Use a minimal, targeted append — read, find section, insert or add section.
  let text = '';
  try { text = fs.readFileSync(tomlPath, 'utf8'); } catch (_) {}
  const sectionHeader = '[bridge.discord.channels]';
  if (text.includes(sectionHeader)) {
    // Append the key inside the existing section
    const idx = text.indexOf(sectionHeader);
    const after = idx + sectionHeader.length;
    const insert = `\n${name} = "${webhookUrl}"`;
    text = text.slice(0, after) + insert + text.slice(after);
  } else {
    // Append new section at end
    text = text.trimEnd() + `\n\n${sectionHeader}\n${name} = "${webhookUrl}"\n`;
  }
  fs.writeFileSync(tomlPath, text);
}

/** Build a Discord webhook payload from a plain message string. */
function discordPayload(message, opts = {}) {
  return {
    content: String(message),
    username: opts.username || 'Kael',
    avatar_url: opts.avatarUrl || undefined,
  };
}

/** POST payload to a Discord webhook URL. Returns { ok, status, body }. */
async function discordWebhookPost(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

// ---------------------------------------------------------------------------
// Twilio helpers (WhatsApp + SMS)
// ---------------------------------------------------------------------------

function twilioCredsFromEnv() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || null,
    authToken: process.env.TWILIO_AUTH_TOKEN || null,
  };
}

/** Build a Twilio Messages API payload. whatsapp=true → prefix to: with whatsapp: */
function twilioPayload(to, from, body, whatsapp) {
  return {
    To: whatsapp ? `whatsapp:${to}` : to,
    From: whatsapp ? `whatsapp:${from}` : from,
    Body: body,
  };
}

/** POST to Twilio Messages REST API. Returns { ok, status, body }. */
async function twilioPost(accountSid, authToken, params) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const formBody = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: formBody,
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

// ---------------------------------------------------------------------------
// Discord subcommands
// ---------------------------------------------------------------------------

function createDiscordSendCommand() {
  return defineCommand({
    meta: { name: 'send', description: 'Send a message to a Discord channel via webhook.' },
    args: {
      channel: { type: 'positional', description: 'Channel name or webhook URL', required: true },
      message: { type: 'positional', description: 'Message text', required: true },
      'webhook-url': { type: 'string', description: 'Webhook URL (overrides config/env)' },
      projectid: { type: 'string', description: 'Project id (for config lookup)' },
      'dry-run': { type: 'boolean', description: 'Print payload without sending', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run: async ({ args }) => {
      const baseDir = process.cwd();
      const disc = loadDiscordConfig(baseDir);

      // Resolve webhook URL: flag > channel map > default
      let webhookUrl = args['webhook-url']
        || disc.channels[args.channel]
        || (args.channel.startsWith('http') ? args.channel : null)
        || disc.defaultWebhook;

      if (!webhookUrl) {
        const msg = `No webhook URL for channel '${args.channel}'. Pass --webhook-url, add via 'gad bridge discord channels add', or set DISCORD_WEBHOOK_URL.`;
        if (args.json) { console.log(JSON.stringify({ ok: false, error: msg })); }
        else { console.error(msg); }
        process.exit(1);
      }

      const payload = discordPayload(args.message);

      if (args['dry-run']) {
        const out = { dry_run: true, webhook_url: webhookUrl, payload };
        if (args.json) { console.log(JSON.stringify(out, null, 2)); }
        else {
          console.log('[dry-run] Discord webhook POST would fire:');
          console.log(`  URL:     ${webhookUrl}`);
          console.log(`  Payload: ${JSON.stringify(payload)}`);
        }
        return;
      }

      try {
        const result = await discordWebhookPost(webhookUrl, payload);
        appendBridgeLog(baseDir, 'discord', { type: 'send_success', channel: args.channel, status: result.status });
        if (args.json) {
          console.log(JSON.stringify({ ok: result.ok, status: result.status, body: result.body }));
        } else if (result.ok) {
          console.log(`Discord message sent to ${args.channel} (HTTP ${result.status})`);
        } else {
          console.error(`Discord webhook returned HTTP ${result.status}: ${result.body}`);
          process.exit(1);
        }
      } catch (err) {
        if (args.json) { console.log(JSON.stringify({ ok: false, error: err.message })); }
        else { console.error(`Discord send failed: ${err.message}`); }
        process.exit(1);
      }
    },
  });
}

function createDiscordChannelsCommand() {
  return defineCommand({
    meta: { name: 'channels', description: 'Manage configured Discord channels.' },
    subCommands: {
      list: defineCommand({
        meta: { name: 'list', description: 'List configured Discord channels.' },
        args: { json: { type: 'boolean', description: 'JSON output' } },
        run: ({ args }) => {
          const disc = loadDiscordConfig(process.cwd());
          const rows = Object.entries(disc.channels).map(([name, url]) => ({ name, webhook_url: url }));
          if (args.json) {
            console.log(JSON.stringify({ channels: rows, default_webhook: disc.defaultWebhook }, null, 2));
          } else if (rows.length === 0) {
            console.log('No Discord channels configured. Use `gad bridge discord channels add <name> --webhook-url <url>`.');
          } else {
            console.log(`Configured channels (${rows.length}):`);
            for (const r of rows) console.log(`  ${r.name.padEnd(20)} ${r.webhook_url}`);
            if (disc.defaultWebhook) console.log(`\n  default: ${disc.defaultWebhook} (DISCORD_WEBHOOK_URL or gad-config.toml)`);
          }
        },
      }),
      add: defineCommand({
        meta: { name: 'add', description: 'Add a Discord channel webhook to gad-config.toml.' },
        args: {
          name: { type: 'positional', description: 'Channel name / alias', required: true },
          'webhook-url': { type: 'string', description: 'Discord webhook URL', required: true },
          projectid: { type: 'string', description: 'Project id (unused — config written to cwd)' },
        },
        run: ({ args }) => {
          const baseDir = process.cwd();
          addDiscordChannel(baseDir, args.name, args['webhook-url']);
          console.log(`Added Discord channel '${args.name}' → ${args['webhook-url']}`);
          console.log(`Set as inbox channel: gad settings set bridge.discord.kael_inbox_channel ${args.name} --scope project --projectid global`);
        },
      }),
    },
  });
}

function createDiscordReceiveCommand() {
  return defineCommand({
    meta: { name: 'receive', description: 'Start inbound webhook server for Discord events (POST /discord).' },
    args: {
      port: { type: 'string', description: 'Port to listen on (default 3030)', default: '3030' },
      detach: { type: 'boolean', description: 'Detach as background daemon', default: false },
      'dry-run': { type: 'boolean', description: 'Print config without starting server', default: false },
    },
    run: ({ args }) => {
      const port = Number(args.port) || 3030;
      if (args['dry-run']) {
        console.log('[dry-run] discord receive would start:');
        console.log(`  Listening on POST http://localhost:${port}/discord`);
        console.log('  Incoming events written to .planning/bridges/discord/<date>.jsonl');
        console.log('  Messages from operator forwarded to Kael chat thread');
        return;
      }
      if (args.detach) {
        // Spawn self in background — detached, stdio piped to log file
        const logDir = path.join(process.cwd(), '.planning', 'bridges', 'discord');
        fs.mkdirSync(logDir, { recursive: true });
        const { spawn } = require('child_process');
        const child = spawn(process.execPath, [__filename, 'bridge', 'discord', 'receive', '--port', String(port)], {
          detached: true,
          stdio: ['ignore', fs.openSync(path.join(logDir, 'server.log'), 'a'), fs.openSync(path.join(logDir, 'server.err'), 'a')],
          env: { ...process.env },
        });
        child.unref();
        console.log(`Discord receive daemon started (pid ${child.pid}) on port ${port}`);
        console.log(`Logs: .planning/bridges/discord/server.log`);
        return;
      }
      // Inline server using Node http (no deps)
      const http = require('http');
      const baseDir = process.cwd();
      const server = http.createServer((req, res) => {
        if (req.method !== 'POST' || req.url !== '/discord') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          let event = {};
          try { event = JSON.parse(body); } catch (_) { event = { raw: body }; }
          appendBridgeLog(baseDir, 'discord', { type: 'receive_message', event });
          console.log(`[discord receive] inbound: ${JSON.stringify(event).slice(0, 200)}`);
          res.writeHead(204);
          res.end();
        });
      });
      server.listen(port, () => {
        console.log(`[discord receive] listening on http://localhost:${port}/discord`);
        console.log('[discord receive] Ctrl-C to stop. Events written to .planning/bridges/discord/<date>.jsonl');
      });
    },
  });
}

function createDiscordCommand() {
  return defineCommand({
    meta: { name: 'discord', description: 'Discord integration — send, receive, channels.' },
    subCommands: {
      send: createDiscordSendCommand(),
      channels: createDiscordChannelsCommand(),
      receive: createDiscordReceiveCommand(),
    },
  });
}

// ---------------------------------------------------------------------------
// WhatsApp subcommand
// ---------------------------------------------------------------------------

function createWhatsappCommand() {
  return defineCommand({
    meta: { name: 'whatsapp', description: 'WhatsApp integration via Twilio WhatsApp Business API.' },
    subCommands: {
      send: defineCommand({
        meta: { name: 'send', description: 'Send a WhatsApp message via Twilio.' },
        args: {
          to: { type: 'positional', description: 'Recipient phone number (+E.164)', required: true },
          message: { type: 'positional', description: 'Message text', required: true },
          from: { type: 'string', description: 'Sender number (defaults to TWILIO_WHATSAPP_FROM env var)', envVar: 'TWILIO_WHATSAPP_FROM' },
          provider: { type: 'string', description: 'Provider: twilio (only supported currently)', default: 'twilio' },
          'dry-run': { type: 'boolean', description: 'Print payload without sending', default: false },
          json: { type: 'boolean', description: 'JSON output', default: false },
        },
        run: async ({ args }) => {
          const baseDir = process.cwd();
          const from = args.from || process.env.TWILIO_WHATSAPP_FROM || null;
          const payload = twilioPayload(args.to, from || '<TWILIO_WHATSAPP_FROM>', args.message, true);

          if (args['dry-run']) {
            const out = { dry_run: true, provider: args.provider || 'twilio', payload };
            if (args.json) { console.log(JSON.stringify(out, null, 2)); }
            else {
              console.log('[dry-run] Twilio WhatsApp POST would fire:');
              console.log(`  To:      ${payload.To}`);
              console.log(`  From:    ${payload.From}`);
              console.log(`  Body:    ${payload.Body}`);
            }
            return;
          }

          const { accountSid, authToken } = twilioCredsFromEnv();
          if (!accountSid || !authToken) {
            const msg = 'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set. Run `gad bridge status` to check configuration.';
            if (args.json) { console.log(JSON.stringify({ ok: false, error: msg })); }
            else { console.error(msg); }
            process.exit(1);
          }
          if (!from) {
            const msg = 'TWILIO_WHATSAPP_FROM env var must be set (Twilio WhatsApp-enabled number, e.g. +14155238886).';
            if (args.json) { console.log(JSON.stringify({ ok: false, error: msg })); }
            else { console.error(msg); }
            process.exit(1);
          }

          try {
            const result = await twilioPost(accountSid, authToken, payload);
            appendBridgeLog(baseDir, 'whatsapp', { type: 'send_success', to: args.to, status: result.status });
            if (args.json) { console.log(JSON.stringify({ ok: result.ok, status: result.status, body: result.body })); }
            else if (result.ok) { console.log(`WhatsApp message sent to ${args.to} (HTTP ${result.status})`); }
            else { console.error(`Twilio returned HTTP ${result.status}: ${result.body}`); process.exit(1); }
          } catch (err) {
            if (args.json) { console.log(JSON.stringify({ ok: false, error: err.message })); }
            else { console.error(`WhatsApp send failed: ${err.message}`); }
            process.exit(1);
          }
        },
      }),
    },
  });
}

// ---------------------------------------------------------------------------
// SMS subcommand
// ---------------------------------------------------------------------------

function createSmsCommand() {
  return defineCommand({
    meta: { name: 'sms', description: 'SMS integration via Twilio.' },
    subCommands: {
      send: defineCommand({
        meta: { name: 'send', description: 'Send an SMS via Twilio.' },
        args: {
          to: { type: 'positional', description: 'Recipient phone number (+E.164)', required: true },
          message: { type: 'positional', description: 'Message text', required: true },
          from: { type: 'string', description: 'Sender number (defaults to TWILIO_SMS_FROM env var)' },
          provider: { type: 'string', description: 'Provider: twilio', default: 'twilio' },
          'dry-run': { type: 'boolean', description: 'Print payload without sending', default: false },
          json: { type: 'boolean', description: 'JSON output', default: false },
        },
        run: async ({ args }) => {
          const baseDir = process.cwd();
          const from = args.from || process.env.TWILIO_SMS_FROM || null;
          const payload = twilioPayload(args.to, from || '<TWILIO_SMS_FROM>', args.message, false);

          if (args['dry-run']) {
            const out = { dry_run: true, provider: args.provider || 'twilio', payload };
            if (args.json) { console.log(JSON.stringify(out, null, 2)); }
            else {
              console.log('[dry-run] Twilio SMS POST would fire:');
              console.log(`  To:   ${payload.To}`);
              console.log(`  From: ${payload.From}`);
              console.log(`  Body: ${payload.Body}`);
            }
            return;
          }

          const { accountSid, authToken } = twilioCredsFromEnv();
          if (!accountSid || !authToken) {
            const msg = 'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set. Run `gad bridge status` to check configuration.';
            if (args.json) { console.log(JSON.stringify({ ok: false, error: msg })); }
            else { console.error(msg); }
            process.exit(1);
          }
          if (!from) {
            const msg = 'TWILIO_SMS_FROM env var must be set (your Twilio phone number, e.g. +15017122661).';
            if (args.json) { console.log(JSON.stringify({ ok: false, error: msg })); }
            else { console.error(msg); }
            process.exit(1);
          }

          try {
            const result = await twilioPost(accountSid, authToken, payload);
            appendBridgeLog(baseDir, 'sms', { type: 'send_success', to: args.to, status: result.status });
            if (args.json) { console.log(JSON.stringify({ ok: result.ok, status: result.status, body: result.body })); }
            else if (result.ok) { console.log(`SMS sent to ${args.to} (HTTP ${result.status})`); }
            else { console.error(`Twilio returned HTTP ${result.status}: ${result.body}`); process.exit(1); }
          } catch (err) {
            if (args.json) { console.log(JSON.stringify({ ok: false, error: err.message })); }
            else { console.error(`SMS send failed: ${err.message}`); }
            process.exit(1);
          }
        },
      }),
    },
  });
}

// ---------------------------------------------------------------------------
// Status subcommand
// ---------------------------------------------------------------------------

function createBridgeStatusCommand() {
  return defineCommand({
    meta: { name: 'status', description: 'Report per-bridge connectivity: configured channels, env vars, last-success timestamps.' },
    args: {
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run: ({ args }) => {
      const baseDir = process.cwd();
      const disc = loadDiscordConfig(baseDir);
      const twilioCreds = twilioCredsFromEnv();

      const status = {
        discord: {
          configured: !!(Object.keys(disc.channels).length || disc.defaultWebhook),
          webhook_url_env_set: !!process.env.DISCORD_WEBHOOK_URL,
          default_webhook_url: disc.defaultWebhook ? '<redacted>' : null,
          channels: Object.keys(disc.channels),
          kael_inbox_channel: process.env.GAD_BRIDGE_DISCORD_KAEL_INBOX || null,
          echo_responses_opt_in: process.env.GAD_BRIDGE_ECHO_KAEL === 'true',
          last_success: lastSuccess(baseDir, 'discord'),
        },
        whatsapp: {
          configured: !!(twilioCreds.accountSid && twilioCreds.authToken && process.env.TWILIO_WHATSAPP_FROM),
          account_sid_set: !!twilioCreds.accountSid,
          auth_token_set: !!twilioCreds.authToken,
          from_number_set: !!process.env.TWILIO_WHATSAPP_FROM,
          provider: 'twilio',
          last_success: lastSuccess(baseDir, 'whatsapp'),
        },
        sms: {
          configured: !!(twilioCreds.accountSid && twilioCreds.authToken && process.env.TWILIO_SMS_FROM),
          account_sid_set: !!twilioCreds.accountSid,
          auth_token_set: !!twilioCreds.authToken,
          from_number_set: !!process.env.TWILIO_SMS_FROM,
          provider: 'twilio',
          last_success: lastSuccess(baseDir, 'sms'),
        },
        phone: {
          configured: false,
          note: 'Voice/phone bridge is planned (future phase) — requires Twilio Voice + Whisper transcription.',
        },
      };

      if (args.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }

      const tick = (v) => v ? '[OK]' : '[ ]';
      console.log('Bridge status');
      console.log('=============');
      console.log(`Discord   ${tick(status.discord.configured)}  channels: ${status.discord.channels.length || 0}  last-success: ${status.discord.last_success || 'never'}`);
      console.log(`WhatsApp  ${tick(status.whatsapp.configured)}  provider: twilio  creds: SID=${tick(status.whatsapp.account_sid_set)} token=${tick(status.whatsapp.auth_token_set)} from=${tick(status.whatsapp.from_number_set)}  last-success: ${status.whatsapp.last_success || 'never'}`);
      console.log(`SMS       ${tick(status.sms.configured)}  provider: twilio  creds: SID=${tick(status.sms.account_sid_set)} token=${tick(status.sms.auth_token_set)} from=${tick(status.sms.from_number_set)}  last-success: ${status.sms.last_success || 'never'}`);
      console.log(`Phone     [ ]  future phase (voice + Whisper transcription)`);
      console.log('\nSetup guide: slm_learning/reports/research/operator_chat_bridges.md');
    },
  });
}

function listAllRoots(baseDir) {
  // gad-config.toml [[planning.roots]] are exposed as cfg.roots (not
  // cfg.planning.roots — the loader flattens). Each root has
  // {id, path, planningDir?} where planningDir defaults to ".planning".
  const cfg = gadConfig.load(baseDir);
  const roots = Array.isArray(cfg.roots) ? cfg.roots : [];
  return roots.map((r) => ({
    id: r.id || path.basename(r.path),
    absPath: path.resolve(baseDir, r.path),
    relPath: r.path,
    planningDir: r.planningDir || '.planning',
  })).filter((r) => fs.existsSync(path.join(r.absPath, r.planningDir, 'handoffs')));
}

function listOpenHandoffs(rootInfo) {
  const dir = path.join(rootInfo.absPath, rootInfo.planningDir || '.planning', 'handoffs', 'open');
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const fp = path.join(dir, f);
        const stat = fs.statSync(fp);
        const head = fs.readFileSync(fp, 'utf8').slice(0, 4096);
        const taskMatch = head.match(/^task_id:\s*(.+)$/m);
        const runtimeMatch = head.match(/^runtime_preference:\s*(.+)$/m);
        const priorityMatch = head.match(/^priority:\s*(.+)$/m);
        const titleMatch = head.match(/\n# (.+)/);
        return {
          project: rootInfo.id,
          id: f.replace(/\.md$/, ''),
          mtime: stat.mtime.toISOString(),
          mtimeMs: stat.mtimeMs,
          taskId: taskMatch ? taskMatch[1].trim() : null,
          runtime: runtimeMatch ? runtimeMatch[1].trim() : null,
          priority: priorityMatch ? priorityMatch[1].trim() : null,
          title: titleMatch ? titleMatch[1].trim() : '(no title)',
        };
      });
  } catch (e) { return []; }
}

function fmtRow(h) {
  const mt = h.mtime.replace('T', ' ').replace('Z', '').slice(5, 16);
  const proj = (h.project || '?').padEnd(15);
  const pri = (h.priority || 'normal').padEnd(7);
  const rt = (h.runtime || 'any').padEnd(13);
  const task = (h.taskId || '?').padEnd(18);
  return `${mt}  ${proj}  ${pri}  ${rt}  ${task}  ${h.title.slice(0, 60)}`;
}

function createInboxCommand() {
  return defineCommand({
    meta: {
      name: 'inbox',
      description: 'One-shot list of open handoffs across all registered planning roots. Sorted newest-first.',
    },
    args: {
      'mine-runtime': { type: 'string', description: 'Filter to runtime_preference == this' },
      since: { type: 'string', description: 'Only show handoffs newer than ISO ts' },
      json: { type: 'boolean', description: 'JSON output' },
    },
    run: ({ args }) => {
      const baseDir = process.cwd();
      const roots = listAllRoots(baseDir);
      let all = [];
      for (const r of roots) all = all.concat(listOpenHandoffs(r));
      if (args['mine-runtime']) {
        all = all.filter((h) => h.runtime === args['mine-runtime']);
      }
      if (args.since) {
        const sinceMs = Date.parse(args.since);
        if (!Number.isNaN(sinceMs)) all = all.filter((h) => h.mtimeMs >= sinceMs);
      }
      all.sort((a, b) => b.mtimeMs - a.mtimeMs);
      if (args.json) {
        console.log(JSON.stringify(all, null, 2));
        return;
      }
      if (all.length === 0) {
        console.log('Inbox empty across all projects.');
        return;
      }
      console.log(`Inbox: ${all.length} open handoffs across ${roots.length} project(s)\n`);
      console.log('mtime         project         priority runtime       task               title');
      console.log('---------------------------------------------------------------------------------------------');
      for (const h of all) console.log(fmtRow(h));
    },
  });
}

function createWatchCommand() {
  return defineCommand({
    meta: {
      name: 'watch',
      description: 'Long-running poll loop. Prints new/closed handoff diffs every --interval seconds. Ctrl-C to stop.',
    },
    args: {
      interval: { type: 'string', description: 'Poll interval seconds (default 30)' },
      'mine-runtime': { type: 'string', description: 'Filter watch output to runtime_preference == this' },
      'notify-cmd': { type: 'string', description: 'Optional shell command piped the handoff json on stdin per new handoff.' },
    },
    run: async ({ args }) => {
      const baseDir = process.cwd();
      const intervalMs = (Number(args.interval) || 30) * 1000;
      const filterRuntime = args['mine-runtime'] || null;
      const notifyCmd = args['notify-cmd'] || null;

      const roots = listAllRoots(baseDir);
      console.log(`[bridge watch] watching ${roots.length} project(s): ${roots.map((r) => r.id).join(', ')}`);
      console.log(`[bridge watch] interval=${intervalMs}ms ${filterRuntime ? `filter=runtime:${filterRuntime}` : '(no filter)'}`);
      console.log(`[bridge watch] Ctrl-C to stop`);

      let known = new Set();
      const initial = [];
      for (const r of roots) initial.push(...listOpenHandoffs(r));
      for (const h of initial) known.add(`${h.project}:${h.id}`);
      console.log(`[bridge watch] baseline: ${known.size} open handoffs`);

      while (true) {
        await new Promise((res) => setTimeout(res, intervalMs));
        const current = [];
        for (const r of roots) current.push(...listOpenHandoffs(r));
        const currentKeys = new Set(current.map((h) => `${h.project}:${h.id}`));

        const fresh = current.filter((h) => !known.has(`${h.project}:${h.id}`));
        const toShow = filterRuntime ? fresh.filter((h) => h.runtime === filterRuntime) : fresh;
        for (const h of toShow) {
          console.log(`[NEW]    ${fmtRow(h)}`);
          if (notifyCmd) spawnNotify(notifyCmd, h);
        }

        for (const k of known) {
          if (!currentKeys.has(k)) {
            const [proj, id] = k.split(':', 2);
            console.log(`[CLOSED] ${new Date().toISOString().slice(11,16)}     ${proj.padEnd(15)}  ${id}`);
          }
        }

        known = currentKeys;
      }
    },
  });
}

function spawnNotify(cmd, handoff) {
  try {
    const { spawn } = require('child_process');
    const p = spawn(cmd, [], { shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
    p.stdin.end(JSON.stringify(handoff));
  } catch (e) {
    process.stderr.write(`[bridge watch] notify cmd failed: ${e.message}\n`);
  }
}

function createSendCommand() {
  return defineCommand({
    meta: {
      name: 'send',
      description: 'Quick-create a handoff in another project queue. Wraps gad handoffs create. Use --quick to bypass quality gate.',
    },
    args: {
      to: { type: 'string', description: 'Target projectid (must be a registered planning root)', required: true },
      'task-id': { type: 'string', description: 'Task id to link (must exist in target project)', required: true },
      phase: { type: 'string', description: 'Phase number', required: true },
      'runtime-preference': { type: 'string', description: 'Target runtime: claude-code | codex-cli | gemini-cli | opencode' },
      priority: { type: 'string', description: 'low | normal | high (default normal)' },
      body: { type: 'string', description: 'Markdown body (must include ## Acceptance gate)', required: true },
    },
    run: ({ args }) => {
      const { createHandoff } = require('../../lib/handoffs.cjs');
      const baseDir = process.cwd();
      const roots = listAllRoots(baseDir);
      const target = roots.find((r) => r.id === args.to);
      if (!target) {
        console.error(`Target project '${args.to}' not registered in gad-config.toml. Known: ${roots.map((r) => r.id).join(', ')}`);
        process.exit(1);
      }
      const result = createHandoff({
        baseDir: target.absPath,
        projectid: args.to,
        phase: args.phase,
        taskId: args['task-id'],
        priority: args.priority || 'normal',
        runtimePreference: args['runtime-preference'] || 'any',
        body: args.body,
      });
      console.log(`Sent handoff to ${args.to}: ${result.id}`);
      console.log(`Path: ${result.path}`);
    },
  });
}

function createBridgeCommand() {
  return defineCommand({
    meta: { name: 'bridge', description: 'Cross-project handoff bridge + chat-channel integrations (Discord / WhatsApp / SMS).' },
    subCommands: {
      inbox: createInboxCommand(),
      watch: createWatchCommand(),
      send: createSendCommand(),
      discord: createDiscordCommand(),
      whatsapp: createWhatsappCommand(),
      sms: createSmsCommand(),
      status: createBridgeStatusCommand(),
    },
  });
}

module.exports = { createBridgeCommand };
module.exports.register = () => ({ bridge: createBridgeCommand() });
