'use strict';
/**
 * gad teams web — live team state surface (phase 182, tasks 182-01 + 182-02).
 *
 * Single-page localhost web UI on port 3033 (default). Shows six sections:
 *   Workers / Dispatcher / Accounts / Cooldowns / Presence / Recent Activity
 *
 * No npm deps. Pure node:http + node:fs + node:path.
 * No AI, no ai-sdk, no new dependencies (GLOBAL-D-336).
 *
 * Mirror of bin/commands/env-web.cjs structure.
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const { defineCommand } = require('citty');
const { aggregate, findRepoRoot } = require('../../lib/teams-aggregator.cjs');

// ─── HTTP plumbing ────────────────────────────────────────────────────────────

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function makeServer(repoRoot) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/') {
        return sendHtml(res, 200, renderShell());
      }
      if (req.method === 'GET' && url.pathname === '/api/teams') {
        return sendJson(res, 200, aggregate(repoRoot));
      }
      res.writeHead(404); res.end('not found');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[gad teams web] handler error: ${msg}`);
      sendJson(res, 500, { error: msg });
    }
  });
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"` :
    process.platform === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd, (err) => { if (err) console.warn(`[gad teams web] failed to auto-open browser: ${err.message}`); });
}

// ─── HTML shell ───────────────────────────────────────────────────────────────

function renderShell() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>gad teams web</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  :root {
    --fg: #d4a017;
    --bg: #0a0a0a;
    --bg2: #050505;
    --card: #141414;
    --accent: #ffd700;
    --error: #c92a2a;
    --dim: #8c6e10;
    --text: #e8e8e8;
    --text-mid: #888;
    --border: #1f1f1f;
    --mono: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: var(--mono); font-size: 14px; }
  .container { max-width: 960px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }

  /* Header */
  .topbar { padding-bottom: 1rem; border-bottom: 1px solid var(--dim); margin-bottom: 1.5rem; display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; }
  .topbar h1 { color: var(--accent); font-size: 0.85rem; letter-spacing: 0.22em; text-transform: uppercase; margin: 0; }
  .topbar .meta { color: var(--text-mid); font-size: 0.66rem; }
  .topbar .refresh-btn { background: transparent; border: 1px solid var(--dim); color: var(--fg); padding: 0.3rem 0.7rem; cursor: pointer; font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; }
  .topbar .refresh-btn:hover { border-color: var(--accent); color: var(--accent); }

  /* Section */
  .section { margin: 1.6rem 0 0; }
  .section-header { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.22em; color: var(--fg); padding-bottom: 0.35rem; border-bottom: 1px dashed var(--dim); margin-bottom: 0.75rem; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 0.72rem; }
  th { color: var(--dim); font-weight: 400; letter-spacing: 0.14em; text-transform: uppercase; font-size: 0.58rem; padding: 0.25rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border); }
  td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--border); vertical-align: top; word-break: break-word; }
  tr:last-child td { border-bottom: 0; }
  tr:hover td { background: rgba(212,160,23,0.03); }

  /* Status badges */
  .badge { display: inline-block; padding: 0.05rem 0.35rem; font-size: 0.55rem; letter-spacing: 0.18em; text-transform: uppercase; border: 1px solid; }
  .badge-ok  { color: var(--accent); border-color: var(--dim); }
  .badge-err { color: var(--error); border-color: var(--error); background: rgba(201,42,42,0.08); }
  .badge-dim { color: var(--text-mid); border-color: #2a2a2a; }
  .badge-warn { color: #d4a017; border-color: #8c6e10; background: rgba(212,160,23,0.06); }

  /* Coming-soon card (182-01 placeholder, replaced by live data in 182-02) */
  .coming-soon { border: 1px solid var(--dim); padding: 1.5rem; text-align: center; color: var(--text-mid); font-size: 0.75rem; margin-top: 1.5rem; }

  /* Log entries */
  .log-entry { font-size: 0.65rem; padding: 0.25rem 0; border-bottom: 1px dashed var(--border); }
  .log-entry:last-child { border-bottom: 0; }
  .log-ts { color: var(--dim); margin-right: 0.5rem; }
  .log-type { color: var(--fg); margin-right: 0.4rem; }
  .log-body { color: var(--text-mid); }

  /* Reason wrap */
  .reason-cell { max-width: 380px; color: var(--text-mid); font-size: 0.64rem; line-height: 1.45; }

  /* Error / empty states */
  .err-box { color: var(--error); border: 1px solid var(--error); padding: 0.8rem 1rem; font-size: 0.72rem; margin-top: 1rem; }
  .empty { color: var(--text-mid); font-size: 0.7rem; padding: 0.5rem 0; }

  /* VCS dev mode (Alt+I) — hover-only */
  body.devid [data-cid] { position: relative; }
  body.devid [data-cid]:hover { outline: 2px solid var(--accent); outline-offset: 1px; cursor: crosshair; }
  body.devid [data-cid]:hover::after {
    content: attr(data-cid);
    position: absolute; top: -10px; right: -2px;
    font: 0.55rem var(--mono); padding: 0.05rem 0.3rem;
    background: var(--accent); color: var(--bg); border: 1px solid var(--dim);
    pointer-events: none; z-index: 50; white-space: nowrap;
  }
  body.devid::before {
    content: 'DEV MODE · alt+i';
    position: fixed; top: 0.5rem; right: 0.5rem; z-index: 100;
    font: 0.5rem var(--mono); letter-spacing: 0.18em; text-transform: uppercase;
    padding: 0.15rem 0.5rem; background: var(--accent); color: var(--bg); border: 1px solid var(--dim);
    pointer-events: none;
  }

  .devhint { position: fixed; left: 1rem; bottom: 1rem; font-size: 0.55rem; color: var(--text-mid); letter-spacing: 0.14em; text-transform: uppercase; pointer-events: none; }
  .devhint kbd { background: var(--card); border: 1px solid var(--dim); padding: 0.05rem 0.3rem; color: var(--fg); margin: 0 0.1rem; font-family: var(--mono); font-size: 0.55rem; }
</style>
</head>
<body>
<div class="container" data-cid="teams-web-container">

  <header class="topbar" data-cid="teams-web-topbar">
    <div>
      <h1 data-cid="teams-web-title">gad teams web — phase 182</h1>
      <div class="meta" id="snapshotMeta">loading…</div>
    </div>
    <button class="refresh-btn" onclick="reload()" data-cid="teams-web-refresh-btn">refresh</button>
  </header>

  <!-- Workers -->
  <section class="section" data-cid="teams.workers.section">
    <div class="section-header" data-cid="teams.workers.header">Workers</div>
    <div id="workersRoot" data-cid="teams-web-workers-root">
      <div class="coming-soon">loading workers…</div>
    </div>
  </section>

  <!-- Dispatcher -->
  <section class="section" data-cid="teams.dispatcher.section">
    <div class="section-header" data-cid="teams.dispatcher.header">Dispatcher</div>
    <div id="dispatcherRoot" data-cid="teams-web-dispatcher-root">
      <div class="coming-soon">loading dispatcher…</div>
    </div>
  </section>

  <!-- Accounts -->
  <section class="section" data-cid="teams.accounts.section">
    <div class="section-header" data-cid="teams.accounts.header">Accounts</div>
    <div id="accountsRoot" data-cid="teams-web-accounts-root">
      <div class="coming-soon">loading accounts…</div>
    </div>
  </section>

  <!-- Cooldowns -->
  <section class="section" data-cid="teams.cooldowns.section">
    <div class="section-header" data-cid="teams.cooldowns.header">Cooldowns</div>
    <div id="cooldownsRoot" data-cid="teams-web-cooldowns-root">
      <div class="coming-soon">loading cooldowns…</div>
    </div>
  </section>

  <!-- Presence -->
  <section class="section" data-cid="teams.presence.section">
    <div class="section-header" data-cid="teams.presence.header">Presence</div>
    <div id="presenceRoot" data-cid="teams-web-presence-root">
      <div class="coming-soon">loading presence…</div>
    </div>
  </section>

  <!-- Recent Activity -->
  <section class="section" data-cid="teams.activity.section">
    <div class="section-header" data-cid="teams.activity.header">Recent Activity</div>
    <div id="activityRoot" data-cid="teams-web-activity-root">
      <div class="coming-soon">loading activity…</div>
    </div>
  </section>

</div><!-- /container -->
<div class="devhint"><kbd>Alt+I</kbd> toggle dev ids</div>

<script>
// ─── Helpers ─────────────────────────────────────────────────────────────────
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('data-')) e.setAttribute(k, v);
    else e[k] = v;
  }
  for (const k of kids) {
    if (k == null) continue;
    if (typeof k === 'string' || typeof k === 'number') e.appendChild(document.createTextNode(String(k)));
    else if (k instanceof Node) e.appendChild(k);
  }
  return e;
}

function badge(text, cls) {
  return el('span', { class: 'badge ' + cls }, text);
}

function fmtTs(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function fmtTsShort(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleTimeString(); } catch { return ts; }
}

function stateBadge(state) {
  if (!state) return badge('UNKNOWN', 'badge-dim');
  const s = String(state).toUpperCase();
  if (s === 'RUNNING' || s === 'ACTIVE') return badge(s, 'badge-ok');
  if (s === 'STOPPED' || s === 'IDLE') return badge(s, 'badge-dim');
  if (s === 'ERROR' || s === 'FAILED') return badge(s, 'badge-err');
  return badge(s, 'badge-warn');
}

// ─── Renderers ───────────────────────────────────────────────────────────────

function renderWorkers(workers) {
  const root = document.getElementById('workersRoot');
  root.innerHTML = '';
  if (!workers || workers.length === 0) {
    root.appendChild(el('div', { class: 'empty' }, 'No workers found.'));
    return;
  }
  const t = el('table', {}, el('thead', {},
    el('tr', {},
      el('th', {}, 'ID'),
      el('th', {}, 'State'),
      el('th', {}, 'Runtime'),
      el('th', {}, 'Lane'),
      el('th', {}, 'PID'),
      el('th', {}, 'Last Heartbeat'),
      el('th', {}, 'Current Ref'),
      el('th', {}, 'Stop Flag'),
    )
  ));
  const tbody = el('tbody', {});
  for (const w of workers) {
    tbody.appendChild(el('tr', {},
      el('td', {}, w.id),
      el('td', {}, stateBadge(w.state)),
      el('td', {}, w.runtime || '—'),
      el('td', {}, w.lane || '—'),
      el('td', {}, w.pid != null ? String(w.pid) : '—'),
      el('td', {}, fmtTs(w.last_heartbeat)),
      el('td', {}, w.current_ref || '—'),
      el('td', {}, w.stop_flag_present ? badge('SET', 'badge-warn') : badge('clear', 'badge-dim')),
    ));
  }
  t.appendChild(tbody);
  root.appendChild(t);
}

function renderDispatcher(d) {
  const root = document.getElementById('dispatcherRoot');
  root.innerHTML = '';
  if (!d) { root.appendChild(el('div', { class: 'empty' }, 'No dispatcher data.')); return; }

  const table = el('table', {}, el('thead', {},
    el('tr', {}, el('th', {}, 'Key'), el('th', {}, 'Value'))
  ));
  const tbody = el('tbody', {});
  tbody.appendChild(el('tr', {}, el('td', {}, 'Alive'), el('td', {}, d.alive ? badge('YES', 'badge-ok') : badge('NO', 'badge-err'))));
  tbody.appendChild(el('tr', {}, el('td', {}, 'PID'), el('td', {}, d.pid || '—')));
  if (d.heartbeat) {
    tbody.appendChild(el('tr', {}, el('td', {}, 'Last Heartbeat'), el('td', {}, fmtTs(d.heartbeat.ts || d.heartbeat.last_heartbeat))));
    tbody.appendChild(el('tr', {}, el('td', {}, 'Status'), el('td', {}, d.heartbeat.status || d.heartbeat.state || '—')));
  }
  table.appendChild(tbody);
  root.appendChild(table);

  if (d.recentLog && d.recentLog.length > 0) {
    root.appendChild(el('div', { class: 'section-header', style: 'margin-top:1rem;font-size:0.58rem;' }, 'Recent Log'));
    const logDiv = el('div', {});
    for (const entry of d.recentLog) {
      const ts = entry.ts ? new Date(entry.ts).toLocaleTimeString() : '';
      const type = entry.type || entry.level || '';
      const msg = entry.msg || entry.message || entry.event || JSON.stringify(entry);
      const row = el('div', { class: 'log-entry' },
        el('span', { class: 'log-ts' }, ts),
        el('span', { class: 'log-type' }, type),
        el('span', { class: 'log-body' }, msg),
      );
      logDiv.appendChild(row);
    }
    root.appendChild(logDiv);
  }
}

function renderAccounts(accounts) {
  const root = document.getElementById('accountsRoot');
  root.innerHTML = '';
  if (!accounts || (!accounts.accounts && !accounts.state)) {
    root.appendChild(el('div', { class: 'empty' }, 'No accounts data found.'));
    return;
  }
  if (accounts.state) {
    const stateJson = JSON.stringify(accounts.state, null, 2);
    root.appendChild(el('div', { class: 'section-header', style: 'margin-bottom:0.5rem;font-size:0.58rem;' }, 'Account State'));
    root.appendChild(el('pre', { style: 'font-size:0.65rem;color:var(--text-mid);overflow-x:auto;' }, stateJson));
  }
  if (accounts.accounts) {
    const keys = Object.keys(accounts.accounts);
    if (keys.length > 0) {
      root.appendChild(el('div', { class: 'section-header', style: 'margin-bottom:0.5rem;font-size:0.58rem;' }, 'Configured Runtimes'));
      const t = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Runtime'), el('th', {}, 'Account Count'))));
      const tb = el('tbody', {});
      for (const k of keys) {
        const val = accounts.accounts[k];
        const count = Array.isArray(val) ? val.length : (typeof val === 'object' ? Object.keys(val).length : 1);
        tb.appendChild(el('tr', {}, el('td', {}, k), el('td', {}, String(count))));
      }
      t.appendChild(tb);
      root.appendChild(t);
    }
  }
}

function renderCooldowns(cooldowns) {
  const root = document.getElementById('cooldownsRoot');
  root.innerHTML = '';
  if (!cooldowns || cooldowns.length === 0) {
    root.appendChild(el('div', { class: 'empty' }, 'No active cooldowns.'));
    return;
  }
  const t = el('table', {}, el('thead', {},
    el('tr', {},
      el('th', {}, 'Runtime'),
      el('th', {}, 'Status'),
      el('th', {}, 'Remaining'),
      el('th', {}, 'Until'),
      el('th', {}, 'Reason'),
    )
  ));
  const tb = el('tbody', {});
  for (const c of cooldowns) {
    tb.appendChild(el('tr', {},
      el('td', {}, c.runtime),
      el('td', {}, c.active ? badge('PARKED', 'badge-err') : badge('CLEAR', 'badge-dim')),
      el('td', {}, c.active ? c.remaining_min + ' min' : '—'),
      el('td', {}, fmtTs(c.until)),
      el('td', { class: 'reason-cell' }, c.reason || '—'),
    ));
  }
  t.appendChild(tb);
  root.appendChild(t);
}

function renderPresence(presence) {
  const root = document.getElementById('presenceRoot');
  root.innerHTML = '';
  if (!presence || presence.length === 0) {
    root.appendChild(el('div', { class: 'empty' }, 'No presence records.'));
    return;
  }
  const t = el('table', {}, el('thead', {},
    el('tr', {},
      el('th', {}, 'Agent'),
      el('th', {}, 'Runtime'),
      el('th', {}, 'Project'),
      el('th', {}, 'Last Heartbeat'),
      el('th', {}, 'Skill'),
      el('th', {}, 'Focus Route'),
    )
  ));
  const tb = el('tbody', {});
  for (const p of presence) {
    tb.appendChild(el('tr', {},
      el('td', {}, p.agent_slug || '—'),
      el('td', {}, p.runtime || '—'),
      el('td', {}, p.projectid || '—'),
      el('td', {}, fmtTs(p.last_heartbeat)),
      el('td', {}, p.active_skill || '—'),
      el('td', {}, p.current_focus_route || '—'),
    ));
  }
  t.appendChild(tb);
  root.appendChild(t);
}

function renderActivity(activity) {
  const root = document.getElementById('activityRoot');
  root.innerHTML = '';
  if (!activity || activity.length === 0) {
    root.appendChild(el('div', { class: 'empty' }, 'No recent activity.'));
    return;
  }
  const t = el('table', {}, el('thead', {},
    el('tr', {},
      el('th', {}, 'Time'),
      el('th', {}, 'Type'),
      el('th', {}, 'Tool'),
      el('th', {}, 'Session'),
      el('th', {}, 'Summary'),
    )
  ));
  const tb = el('tbody', {});
  for (const e of activity) {
    const summary = e.input_summary ? String(e.input_summary).slice(0, 80) : '—';
    tb.appendChild(el('tr', {},
      el('td', {}, fmtTsShort(e.ts)),
      el('td', {}, e.type || '—'),
      el('td', {}, e.tool || '—'),
      el('td', {}, e.session_id ? String(e.session_id).slice(0, 8) : '—'),
      el('td', {}, summary),
    ));
  }
  t.appendChild(tb);
  root.appendChild(t);
}

// ─── Load + render ────────────────────────────────────────────────────────────

async function load() {
  try {
    const r = await fetch('/api/teams');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    document.getElementById('snapshotMeta').textContent =
      'snapshot ' + (data.snapshot_at ? new Date(data.snapshot_at).toLocaleString() : '—') +
      ' · root: ' + (data.repo_root || '—');
    renderWorkers(data.workers);
    renderDispatcher(data.dispatcher);
    renderAccounts(data.accounts);
    renderCooldowns(data.cooldowns);
    renderPresence(data.presence);
    renderActivity(data.recentActivity);
  } catch (err) {
    document.getElementById('snapshotMeta').textContent = 'error: ' + err.message;
    const sections = ['workers', 'dispatcher', 'accounts', 'cooldowns', 'presence', 'activity'];
    for (const s of sections) {
      const el2 = document.getElementById(s + 'Root');
      if (el2) el2.innerHTML = '<div class="err-box">Load failed: ' + err.message + '</div>';
    }
  }
}

function reload() { load(); }

// ─── VCS dev mode (Alt+I) ─────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'i' || e.key === 'I')) {
    document.body.classList.toggle('devid');
    e.preventDefault();
  }
});

load();
</script>
</body></html>`;
}

// ─── Citty subcommand ────────────────────────────────────────────────────────

function createTeamsWebCommand() {
  return defineCommand({
    meta: {
      name: 'web',
      description: 'Localhost team state surface — live view of workers, dispatcher, accounts, cooldowns, presence, and recent activity. Default port 3033.',
    },
    args: {
      port: { type: 'string', description: 'TCP port to bind (default 3033)', default: '3033' },
      'no-open': { type: 'boolean', description: 'Skip auto-opening the browser', default: false },
    },
    async run({ args }) {
      const port = Number(args.port) || 3033;
      const repoRoot = findRepoRoot();
      console.log(`[gad teams web] repo root   : ${repoRoot}`);
      console.log(`[gad teams web] starting on http://localhost:${port}`);
      const server = makeServer(repoRoot);
      server.on('error', (err) => {
        console.error(`[gad teams web] server error: ${err.message}`);
        process.exit(1);
      });
      server.listen(port, '127.0.0.1', () => {
        console.log(`[gad teams web] http://localhost:${port} ready. Ctrl+C to stop.`);
        if (!args['no-open']) openBrowser(`http://localhost:${port}`);
      });
    },
  });
}

module.exports = { createTeamsWebCommand };
