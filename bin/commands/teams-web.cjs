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

  /* ─── @gad/visual-context-web overlay styles (inlined, phase 185-04) ─── */
  :root {
    --vcs-bg: var(--bg, #0a0a0a);
    --vcs-bg2: var(--bg2, #050505);
    --vcs-card: var(--card, #141414);
    --vcs-accent: #D4A017;
    --vcs-accent-bright: #FFD700;
    --vcs-accent-dark: #8C6E10;
    --vcs-red: #C92A2A;
    --vcs-red-soft: rgba(201, 42, 42, 0.10);
    --vcs-fg: var(--text, #e8e8e8);
    --vcs-fg-dim: var(--text-mid, #888);
    --vcs-border: var(--border, #1f1f1f);
    --vcs-mono: var(--mono, ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace);
    --vcs-panel-w: 360px;
  }
  body.vcs-devid [data-cid] { position: relative; }
  body.vcs-devid [data-cid]:hover { outline: 2px solid var(--vcs-accent-bright); outline-offset: 1px; cursor: crosshair; }
  body.vcs-devid [data-cid]:hover::after {
    content: attr(data-cid);
    position: absolute; top: -10px; right: -2px;
    font: 0.55rem var(--vcs-mono); padding: 0.05rem 0.3rem;
    background: var(--vcs-accent-bright); color: var(--vcs-bg); border: 1px solid var(--vcs-accent-dark);
    pointer-events: none; z-index: 9999; white-space: nowrap;
  }
  body.vcs-devid::before {
    content: 'DEV \\00b7 alt+click to record';
    position: fixed; top: 0.5rem; right: 0.5rem; z-index: 9995;
    font: 0.5rem var(--vcs-mono); letter-spacing: 0.18em; text-transform: uppercase;
    padding: 0.15rem 0.5rem; background: var(--vcs-accent-bright); color: var(--vcs-bg);
    border: 1px solid var(--vcs-accent-dark); pointer-events: none;
  }
  .vcs-listening-dot {
    position: fixed; top: 0.6rem; left: 0.6rem;
    width: 8px; height: 8px; border-radius: 50%;
    z-index: 9999; pointer-events: none;
    transition: background 0.2s ease, opacity 0.2s ease;
    background: var(--vcs-accent-dark); opacity: 0.45;
  }
  .vcs-listening-dot.passive { background: var(--vcs-accent-dark); opacity: 0.45; }
  .vcs-listening-dot.active { background: var(--vcs-red); opacity: 1; animation: vcs-dot-pulse 1.4s infinite; }
  @keyframes vcs-dot-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  .vcs-side-panel {
    position: fixed; top: 0; right: 0;
    width: var(--vcs-panel-w); height: 100vh;
    border-left: 1px solid var(--vcs-accent-dark);
    background: var(--vcs-bg2);
    display: flex; flex-direction: column;
    font-family: var(--vcs-mono); font-size: 14px; color: var(--vcs-fg);
    z-index: 9990; transform: translateX(100%); transition: transform 0.2s ease;
  }
  .vcs-side-panel.vcs-open { transform: translateX(0); }
  .vcs-side-panel header {
    padding: 0.7rem 0.8rem; border-bottom: 1px solid var(--vcs-border);
    display: flex; justify-content: space-between; align-items: baseline;
  }
  .vcs-side-panel header h2 {
    margin: 0; font-size: 0.62rem; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--vcs-accent-bright);
  }
  .vcs-side-panel .vcs-clear-btn {
    background: transparent; border: 1px solid var(--vcs-accent-dark);
    color: var(--vcs-fg-dim); padding: 0.2rem 0.5rem; font-size: 0.52rem;
    font-family: var(--vcs-mono); cursor: pointer;
  }
  .vcs-side-panel .vcs-clear-btn:hover:not(:disabled) { color: var(--vcs-red); border-color: var(--vcs-red); }
  .vcs-tag-list {
    flex: 1; overflow-y: auto; padding: 0.6rem 0.8rem;
    display: flex; flex-direction: column; gap: 0.5rem;
  }
  .vcs-tag-list .vcs-empty-hint {
    color: var(--vcs-fg-dim); font-size: 0.65rem; text-align: center; padding: 1.5rem 0.5rem; line-height: 1.6;
  }
  .vcs-tag-list .vcs-empty-hint kbd {
    background: var(--vcs-card); border: 1px solid var(--vcs-accent-dark);
    padding: 0.05rem 0.3rem; color: var(--vcs-accent); margin: 0 0.1rem;
    font-family: var(--vcs-mono); font-size: 0.55rem;
  }
  .vcs-recording-bucket {
    background: var(--vcs-card); border: 1px solid var(--vcs-accent-dark);
    padding: 0.45rem 0.55rem; font-size: 0.66rem;
    display: flex; flex-direction: column; gap: 0.25rem; font-family: var(--vcs-mono);
  }
  .vcs-recording-bucket.vcs-recording { border-color: var(--vcs-red); background: rgba(201, 42, 42, 0.10); }
  .vcs-recording-bucket.vcs-merging { border-color: var(--vcs-accent-bright); background: rgba(212, 160, 23, 0.08); }
  .vcs-recording-bucket.vcs-listening { border-color: var(--vcs-accent-dark); background: rgba(212, 160, 23, 0.04); opacity: 0.75; }
  .vcs-recording-bucket .vcs-tag-head { display: flex; justify-content: space-between; align-items: center; gap: 0.3rem; }
  .vcs-recording-bucket .vcs-cidlabel {
    font-size: 0.52rem; color: var(--vcs-accent-dark); letter-spacing: 0.18em;
    text-transform: uppercase; word-break: break-all; flex: 1;
  }
  .vcs-recording-bucket .vcs-ctext { color: var(--vcs-accent-bright); word-break: break-word; line-height: 1.4; }
  .vcs-recording-bucket .vcs-pending-rec { color: var(--vcs-red); font-style: italic; }
  .vcs-recording-bucket.vcs-listening .vcs-pending-rec { color: var(--vcs-fg-dim); }
  .vcs-recording-bucket .vcs-tag-actions { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-top: 0.2rem; }
  .vcs-recording-bucket .vcs-tag-actions button {
    padding: 0.1rem 0.4rem; font-size: 0.52rem; background: transparent;
    border: 1px solid var(--vcs-accent-dark); color: var(--vcs-fg-dim);
    font-family: var(--vcs-mono); cursor: pointer;
  }
  .vcs-recording-bucket .vcs-tag-actions button:hover:not(:disabled) { color: var(--vcs-accent); border-color: var(--vcs-accent); }
  .vcs-recording-bucket .vcs-tag-actions button.vcs-danger:hover { color: var(--vcs-red); border-color: var(--vcs-red); }
  .vcs-typewriter-cursor {
    display: inline-block; width: 0.4em; background: var(--vcs-accent-bright);
    animation: vcs-cursor-blink 0.85s steps(1) infinite; margin-left: 0.05em;
  }
  .vcs-typewriter-new { color: var(--vcs-accent-bright); background: rgba(212, 160, 23, 0.18); padding: 0 0.1em; transition: background 0.6s ease; }
  .vcs-typewriter-new.vcs-settled { background: transparent; }
  @keyframes vcs-cursor-blink { 50% { opacity: 0; } }
  .vcs-devhint {
    position: fixed; left: 1rem; bottom: 1rem; font-size: 0.55rem;
    color: var(--vcs-fg-dim); letter-spacing: 0.14em; text-transform: uppercase;
    z-index: 9988; pointer-events: none; font-family: var(--vcs-mono);
  }
  .vcs-devhint kbd {
    background: var(--vcs-card); border: 1px solid var(--vcs-accent-dark);
    padding: 0.05rem 0.3rem; color: var(--vcs-accent); margin: 0 0.1rem;
    font-family: var(--vcs-mono); font-size: 0.55rem;
  }
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
<!-- VCS side panel is mounted by createVisualContextOverlay (packages/visual-context-web, phase 185-04) -->

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

load();
</script>

<script type="module">
// ─── @gad/visual-context-web — inlined (packages/visual-context-web/index.js, phase 185-04) ──
// Source: vendor/get-anything-done/packages/visual-context-web/index.js

const ACTIVE_GRACE_MS = 1500;
const TYPE_MS_PER_CHAR = 18;

function createVisualContextOverlay(options = {}) {
  const {
    cidPrefix = 'app',
    onVoiceTag = null,
    onUpdate = null,
    container = document.body,
    showDevHint = true,
  } = options;

  const voice = {
    rec: null,
    mode: null,
    recCid: null,
    transcript: '',
    lastSpeechTs: 0,
    tags: [],
    supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
  const animatingTags = new Set();
  let devOn = false;
  let disposed = false;

  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
      const { attrs, ...rest } = props;
      Object.assign(e, rest);
      if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    }
    for (const k of kids) {
      if (k == null) continue;
      if (typeof k === 'string') e.appendChild(document.createTextNode(k));
      else e.appendChild(k);
    }
    return e;
  }

  const dot = el('div', { className: 'vcs-listening-dot passive', attrs: { 'data-cid': cidPrefix + '-vcs-dot', title: 'VCS: passive listening' } });
  document.body.appendChild(dot);

  function setDotState(state) { dot.className = 'vcs-listening-dot ' + state; }

  function toggleDev() {
    devOn = !devOn;
    document.body.classList.toggle('vcs-devid', devOn);
  }

  function onKeydown(e) {
    if (disposed) return;
    if (e.altKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); toggleDev(); return; }
    if (e.ctrlKey && e.key === ';') {
      e.preventDefault();
      const str = buildUpdateString(voice.tags, cidPrefix);
      navigator.clipboard.writeText(str).then(() => { if (onUpdate) onUpdate(str); }).catch(() => {});
    }
  }

  function onAltClick(e) {
    if (disposed) return;
    if (!e.altKey) return;
    const target = e.target.closest('[data-cid]');
    if (!target) return;
    const cid = target.getAttribute('data-cid');
    if (cid.startsWith(cidPrefix + '-vcs-') || cid === cidPrefix + '-vcs-dot') return;
    e.preventDefault(); e.stopPropagation();
    if (voice.mode === 'target' && voice.recCid === cid) stopRecord();
    else if (voice.mode === 'target') stopRecord();
    else startTargetRecord(cid);
  }

  function makeRecognizer(onFinal, onError, onSpeechActivity) {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    const r = new Ctor();
    r.lang = 'en-US'; r.continuous = true; r.interimResults = true;
    r.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (onSpeechActivity) onSpeechActivity();
        if (res.isFinal) { const t = res[0].transcript.trim(); if (t) onFinal(t); }
      }
    };
    r.onerror = (ev) => onError(ev.error || 'unknown');
    return r;
  }

  function startTargetRecord(cid) {
    if (!voice.supported) return;
    if (voice.rec) stopRecord();
    const r = makeRecognizer(
      (t) => { voice.transcript = (voice.transcript ? voice.transcript + ' ' : '') + t; renderTagList(); },
      (_err) => {},
      () => { voice.lastSpeechTs = Date.now(); setDotState('active'); renderTagList(); },
    );
    if (!r) return;
    r.onend = () => finaliseTagRec();
    try {
      r.start();
      voice.rec = r; voice.mode = 'target'; voice.recCid = cid;
      voice.transcript = ''; voice.lastSpeechTs = 0;
      setDotState('passive'); renderTagList();
    } catch (_e) {}
  }

  function stopRecord() { if (voice.rec) { try { voice.rec.stop(); } catch {} } }

  function finaliseTagRec() {
    const cid = voice.recCid; const transcript = voice.transcript;
    if (cid && transcript) {
      const existing = voice.tags.find((t) => t.cid === cid);
      if (existing) {
        const sep = existing.text && !existing.text.endsWith(' ') ? ' ' : '';
        existing.pendingAppend = sep + transcript; existing.updatedAt = Date.now();
      } else {
        const entry = { id: 't' + Date.now(), cid, text: transcript, createdAt: Date.now() };
        voice.tags.push(entry);
        if (onVoiceTag) onVoiceTag({ cid, ts: entry.createdAt, transcript });
      }
    }
    voice.rec = null; voice.mode = null; voice.recCid = null; voice.transcript = '';
    setDotState('passive'); renderTagList();
  }

  const dotInterval = setInterval(() => {
    if (disposed) { clearInterval(dotInterval); return; }
    if (voice.mode === 'target' && voice.recCid) {
      const isActive = voice.lastSpeechTs && (Date.now() - voice.lastSpeechTs) < ACTIVE_GRACE_MS;
      setDotState(isActive ? 'active' : 'passive'); renderTagList();
    }
  }, 400);

  function startTypewriter(tagId, contentEl) {
    if (animatingTags.has(tagId)) return;
    const tag = voice.tags.find((t) => t.id === tagId);
    if (!tag || !tag.pendingAppend) return;
    animatingTags.add(tagId);
    contentEl.textContent = tag.text;
    const newSpan = document.createElement('span'); newSpan.className = 'vcs-typewriter-new'; contentEl.appendChild(newSpan);
    const cursor = document.createElement('span'); cursor.className = 'vcs-typewriter-cursor'; contentEl.appendChild(cursor);
    const chars = tag.pendingAppend; let i = 0;
    function step() {
      if (i >= chars.length) {
        tag.text = (tag.text + tag.pendingAppend).trim(); delete tag.pendingAppend;
        cursor.remove(); newSpan.classList.add('vcs-settled');
        setTimeout(() => {
          animatingTags.delete(tagId);
          const row = document.querySelector('[data-cid="vcs-tag-' + tagId + '"]');
          if (row) row.classList.remove('vcs-merging');
        }, 700); return;
      }
      newSpan.textContent += chars[i]; i++; setTimeout(step, TYPE_MS_PER_CHAR);
    }
    step();
  }

  function onVoiceTagEvent(e) {
    if (disposed) return;
    const { cid, transcript } = e.detail || {};
    if (!cid || !transcript) return;
    const existing = voice.tags.find((t) => t.cid === cid);
    if (existing) {
      const sep = existing.text && !existing.text.endsWith(' ') ? ' ' : '';
      existing.pendingAppend = sep + transcript; existing.updatedAt = Date.now();
    } else { voice.tags.push({ id: 't' + Date.now(), cid, text: transcript, createdAt: Date.now() }); }
    renderTagList();
  }

  const panel = el('aside', { className: 'vcs-side-panel', attrs: { 'data-cid': cidPrefix + '-vcs-panel' } });
  const panelHeader = el('header', { attrs: { 'data-cid': cidPrefix + '-vcs-panel-header' } });
  const panelTitle = el('h2', null, 'context');
  const clearBtn = el('button', {
    className: 'vcs-clear-btn',
    attrs: { 'data-cid': cidPrefix + '-vcs-panel-clear' },
    onclick: () => { voice.tags = []; renderTagList(); },
  }, 'clear all');
  panelHeader.appendChild(panelTitle); panelHeader.appendChild(clearBtn); panel.appendChild(panelHeader);
  const tagList = el('div', { className: 'vcs-tag-list', attrs: { 'data-cid': cidPrefix + '-vcs-tag-list' } });
  panel.appendChild(tagList);
  container.appendChild(panel);

  function renderTagList() {
    tagList.innerHTML = '';
    clearBtn.disabled = voice.tags.length === 0;
    const hasContent = voice.recCid !== null || voice.tags.length > 0;
    if (!hasContent) {
      tagList.appendChild(el('div', { className: 'vcs-empty-hint' },
        'No context yet.', el('br'), el('br'),
        'Hold ', el('kbd', null, 'Alt'), ' and click any element to record a voice tag. ',
        el('kbd', null, 'Alt+I'), ' toggles dev outline. ',
        el('kbd', null, 'Ctrl+;'), ' copies UPDATE prompt.',
      ));
      return;
    }
    if (voice.recCid) {
      const isActive = voice.lastSpeechTs && (Date.now() - voice.lastSpeechTs) < ACTIVE_GRACE_MS;
      const cls = 'vcs-recording-bucket ' + (isActive ? 'vcs-recording' : 'vcs-listening');
      const t = el('div', { className: cls, attrs: { 'data-cid': cidPrefix + '-vcs-recording' } });
      const head = el('div', { className: 'vcs-tag-head' });
      head.appendChild(el('span', { className: 'vcs-cidlabel' }, (isActive ? 'recording · ' : 'listening · ') + voice.recCid));
      head.appendChild(el('button', { onclick: stopRecord, title: 'stop recording' }, 'stop'));
      t.appendChild(head);
      t.appendChild(el('span', { className: 'vcs-ctext vcs-pending-rec' }, voice.transcript || (isActive ? '(speak now…)' : '(quiet — passive listening)')));
      tagList.appendChild(t);
    }
    for (const tag of voice.tags) {
      const isMerging = !!tag.pendingAppend;
      const cls = 'vcs-recording-bucket' + (isMerging ? ' vcs-merging' : '');
      const t = el('div', { className: cls, attrs: { 'data-cid': 'vcs-tag-' + tag.id } });
      const head = el('div', { className: 'vcs-tag-head' });
      head.appendChild(el('span', { className: 'vcs-cidlabel' }, tag.cid));
      t.appendChild(head);
      const contentEl = el('span', { className: 'vcs-ctext' }, tag.text);
      t.appendChild(contentEl);
      if (isMerging) { const tagId = tag.id; setTimeout(() => startTypewriter(tagId, contentEl), 0); }
      const acts = el('div', { className: 'vcs-tag-actions' });
      acts.appendChild(el('button', { title: 'copy transcript to clipboard', onclick: () => { navigator.clipboard.writeText(tag.text).catch(() => {}); } }, 'copy'));
      acts.appendChild(el('button', { className: 'vcs-danger', title: 'remove this tag', onclick: () => { voice.tags = voice.tags.filter((x) => x.id !== tag.id); renderTagList(); } }, 'remove'));
      t.appendChild(acts);
      tagList.appendChild(t);
    }
  }

  let devHintEl = null;
  if (showDevHint) {
    devHintEl = el('div', { className: 'vcs-devhint', attrs: { 'data-cid': cidPrefix + '-vcs-devhint' } },
      el('kbd', null, 'Alt+I'), ': dev ids · ',
      el('kbd', null, 'Alt+click'), ': voice tag · ',
      el('kbd', null, 'Ctrl+;'), ': copy UPDATE',
    );
    document.body.appendChild(devHintEl);
  }

  function buildUpdateString(tags, prefix) {
    const lines = ['# UPDATE — Update the targets below using the operator notes.', ''];
    if (tags.length > 0) {
      lines.push('## Targets (' + tags.length + ')');
      for (const t of tags) lines.push('- **' + t.cid + '**: ' + t.text);
      lines.push('');
    }
    lines.push('## Context prefix: ' + prefix);
    lines.push(''); lines.push('## Action'); lines.push('Proceed with updating the targets above.');
    return lines.join('\n');
  }

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('click', onAltClick, true);
  document.addEventListener('voice-tag-recorded', onVoiceTagEvent);
  renderTagList();

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearInterval(dotInterval);
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('click', onAltClick, true);
    document.removeEventListener('voice-tag-recorded', onVoiceTagEvent);
    document.body.classList.remove('vcs-devid');
    if (dot.parentNode) dot.parentNode.removeChild(dot);
    if (panel.parentNode) panel.parentNode.removeChild(panel);
    if (devHintEl && devHintEl.parentNode) devHintEl.parentNode.removeChild(devHintEl);
  }
  function recordings() { return voice.tags.slice(); }
  function refreshCids() {}

  return { dispose, dot, recordings, refreshCids };
}

// ─── Boot VCS on the teams page ──────────────────────────────────────────────
window.vcsOverlay = createVisualContextOverlay({
  cidPrefix: 'teams',
  onVoiceTag: ({ cid, ts, transcript }) => {
    console.debug('[vcs] voice tag captured', { cid, ts, transcript });
  },
  onUpdate: (str) => {
    console.debug('[vcs] UPDATE copied to clipboard', str.slice(0, 80));
  },
  showDevHint: true,
});
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
