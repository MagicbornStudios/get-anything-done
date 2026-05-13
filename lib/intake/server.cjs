'use strict';
/**
 * lib/intake/server.cjs — tiny human-in-the-loop HTTP server (Phase 158).
 *
 * Spawns a localhost-only HTTP server, opens the operator's browser to a
 * single-page form, blocks until the operator submits (or the timeout
 * fires), then shuts down. Used by `gad ask <kind>` and by MCP's
 * gad_ask_operator tool.
 *
 * Headless-first: every form has a CLI fallback (--value or stdin pipe).
 * The browser is convenience, not the primary surface.
 *
 * No external deps — Node's built-in http + child_process for browser open.
 * The form HTML is inlined here (one form = one tiny page) per the
 * "single-purpose, no build step" design principle.
 */

const http = require('node:http');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

const DEFAULT_PORT_RANGE = { start: 17777, end: 17799 };  // private tray-app range
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;  // 10 min — operator might be afk

function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderForm({ kind, title, details, key, projectid, csrfToken }) {
  const isSecret = (kind === 'env' || kind === 'byok');
  const isDecision = (kind === 'decision');
  const isText = (kind === 'text' || kind === 'todo');
  const titleEsc = htmlEscape(title || 'GAD needs your input');
  const detailsEsc = htmlEscape(details || '');
  const keyEsc = htmlEscape(key || '');
  const projectIdEsc = htmlEscape(projectid || '');

  const inputBlock = isSecret
    ? `
        <label for="value">${keyEsc || 'value'}${projectIdEsc ? ` <span class="muted">(project: ${projectIdEsc})</span>` : ''}</label>
        <input id="value" name="value" type="password" autofocus autocomplete="off" spellcheck="false" />
        <label class="checkbox-row"><input id="reveal" type="checkbox" /> show value</label>`
    : isDecision
    ? `
        <fieldset class="decision">
          <button type="submit" name="value" value="approve" class="btn-approve" autofocus>Approve</button>
          <button type="submit" name="value" value="reject"  class="btn-reject">Reject</button>
        </fieldset>
        <label for="note">note (optional)</label>
        <input id="note" name="note" type="text" placeholder="reason..." />`
    : `
        <label for="value">your answer</label>
        <textarea id="value" name="value" rows="6" autofocus></textarea>`;

  const submitBlock = isDecision ? '' : `<button type="submit" class="primary">submit</button>`;

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><title>${titleEsc} — GAD intake</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
         background: #0a0a0a; color: #f4f4f5; min-height: 100vh; display: flex; align-items: center;
         justify-content: center; padding: 24px; }
  .card { width: 100%; max-width: 520px; background: #18181b; border: 1px solid #27272a;
          border-radius: 12px; padding: 28px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); }
  h1 { margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #D4A017; letter-spacing: 0.2px; }
  .kind { display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px;
          color: #71717a; margin-bottom: 12px; }
  p.details { color: #a1a1aa; margin: 0 0 18px 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
  label { display: block; font-size: 12px; color: #a1a1aa; margin: 12px 0 6px 0; text-transform: lowercase; }
  .muted { color: #52525b; }
  input[type=password], input[type=text], textarea {
    width: 100%; padding: 10px 12px; background: #0a0a0a; color: #f4f4f5; border: 1px solid #3f3f46;
    border-radius: 6px; font: 14px ui-monospace, "Cascadia Mono", Consolas, monospace; outline: none; }
  input:focus, textarea:focus { border-color: #D4A017; }
  textarea { resize: vertical; min-height: 100px; font-family: ui-sans-serif, system-ui, sans-serif; }
  .checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #a1a1aa;
                  text-transform: none; }
  .checkbox-row input { width: auto; margin: 0; }
  button { background: #27272a; color: #f4f4f5; border: 1px solid #3f3f46; padding: 10px 16px;
           border-radius: 6px; font-size: 14px; cursor: pointer; transition: 80ms; }
  button:hover { border-color: #D4A017; }
  button.primary { background: #D4A017; color: #0a0a0a; border-color: #D4A017; font-weight: 600; margin-top: 16px; }
  button.primary:hover { background: #FFD700; border-color: #FFD700; }
  fieldset.decision { border: none; padding: 0; margin: 16px 0 0 0; display: flex; gap: 12px; }
  .btn-approve { background: #166534; border-color: #166534; color: #f4f4f5; flex: 1; padding: 14px; font-weight: 600; }
  .btn-reject  { background: #7f1d1d; border-color: #7f1d1d; color: #f4f4f5; flex: 1; padding: 14px; font-weight: 600; }
  .submitted { color: #166534; padding: 32px 0; text-align: center; font-size: 14px; }
  .footer { margin-top: 18px; font-size: 11px; color: #52525b; text-align: center; }
</style></head><body>
  <form class="card" method="post" action="/submit" id="frm">
    <div class="kind">${htmlEscape(kind)}</div>
    <h1>${titleEsc}</h1>
    ${detailsEsc ? `<p class="details">${detailsEsc}</p>` : ''}
    <input type="hidden" name="csrf" value="${csrfToken}">
    ${inputBlock}
    ${submitBlock}
    <div class="footer">gad intake · localhost only · closes after submit</div>
  </form>
  <script>
    const reveal = document.getElementById('reveal');
    const val = document.getElementById('value');
    if (reveal && val) reveal.addEventListener('change', () => { val.type = reveal.checked ? 'text' : 'password'; });
    document.getElementById('frm').addEventListener('submit', (e) => {
      setTimeout(() => { document.querySelector('.card').innerHTML = '<div class="submitted">submitted. you can close this tab.</div>'; }, 50);
    });
  </script>
</body></html>`;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; if (data.length > 1024 * 1024) reject(new Error('body too large')); });
    req.on('end', () => {
      const params = new URLSearchParams(data);
      resolve(Object.fromEntries(params));
    });
    req.on('error', reject);
  });
}

function findOpenPort(start, end) {
  return new Promise((resolve, reject) => {
    let port = start;
    const tryPort = () => {
      const s = http.createServer();
      s.once('error', () => {
        s.close();
        port++;
        if (port > end) { reject(new Error(`No port available in ${start}-${end}`)); return; }
        tryPort();
      });
      s.once('listening', () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
      s.listen(port, '127.0.0.1');
    };
    tryPort();
  });
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true, windowsHide: true }).unref();
  } else if (platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore', detached: true, windowsHide: true }).unref();
  } else {
    spawn('xdg-open', [url], { stdio: 'ignore', detached: true, windowsHide: true }).unref();
  }
}

/**
 * Spawn the intake UI. Returns a promise that resolves with the operator's
 * response { value, note? } or rejects on timeout/cancel.
 */
async function ask({ kind, title, details, key, projectid, timeoutMs = DEFAULT_TIMEOUT_MS, autoOpen = true, log = () => {} }) {
  const port = await findOpenPort(DEFAULT_PORT_RANGE.start, DEFAULT_PORT_RANGE.end);
  const csrfToken = crypto.randomBytes(16).toString('hex');
  const url = `http://127.0.0.1:${port}/`;

  return new Promise((resolve, reject) => {
    let resolved = false;
    const server = http.createServer(async (req, res) => {
      // Local-only — refuse non-loopback (defense in depth; we listened on 127.0.0.1)
      const remote = req.socket.remoteAddress;
      if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
        res.writeHead(403); res.end('forbidden'); return;
      }
      if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderForm({ kind, title, details, key, projectid, csrfToken }));
        return;
      }
      if (req.method === 'POST' && req.url === '/submit') {
        try {
          const body = await parseBody(req);
          if (body.csrf !== csrfToken) { res.writeHead(403); res.end('csrf'); return; }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<!doctype html><meta charset=utf-8><title>submitted</title><body style="background:#0a0a0a;color:#f4f4f5;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><div style="font-size:14px;color:#166534">submitted. you can close this tab.</div></div></body>');
          if (!resolved) {
            resolved = true;
            setTimeout(() => server.close(), 100);
            resolve({
              value: body.value || '',
              note: body.note || '',
              kind,
              key: key || null,
              projectid: projectid || null,
            });
          }
          return;
        } catch (e) {
          res.writeHead(400); res.end(String(e.message || e));
          return;
        }
      }
      res.writeHead(404); res.end('not found');
    });

    server.listen(port, '127.0.0.1', () => {
      log(`[intake] listening at ${url} for kind=${kind}`);
      if (autoOpen) {
        log('[intake] opening browser...');
        try { openBrowser(url); } catch (e) { log(`[intake] auto-open failed: ${e.message}`); }
      }
    });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        server.close();
        reject(new Error(`intake timed out after ${timeoutMs / 1000}s`));
      }
    }, timeoutMs);

    server.on('close', () => clearTimeout(timer));
  });
}

module.exports = { ask, renderForm, findOpenPort };
