'use strict';

function renderIssuesHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GAD Issue Capture</title>
<style>
:root {
  color-scheme: dark;
  --bg: #09090b;
  --panel: #111113;
  --panel-raised: #151519;
  --ink: #f4f4f5;
  --muted: #a1a1aa;
  --faint: #71717a;
  --line: #27272a;
  --line-soft: #1f1f23;
  --accent: #f97316;
  --warn: #f59e0b;
  --danger: #ef4444;
}
* { box-sizing: border-box; }
* {
  scrollbar-width: thin;
  scrollbar-color: #3f3f46 #0f0f12;
}
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-track {
  background: #0f0f12;
  border-left: 1px solid var(--line-soft);
}
*::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border: 2px solid #0f0f12;
  border-radius: 999px;
}
*::-webkit-scrollbar-thumb:hover {
  background: #52525b;
}
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
main { width: min(1120px, calc(100vw - 40px)); margin: 0 auto; padding: 24px 0 32px; }
header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--line-soft);
}
h1 {
  margin: 0;
  font-size: clamp(24px, 3.4vw, 38px);
  line-height: 1.05;
  letter-spacing: -0.045em;
  max-width: 680px;
  font-weight: 650;
}
.lede { color: var(--muted); max-width: 680px; line-height: 1.55; margin: 10px 0 0; font-size: 14px; }
.grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr); gap: 14px; align-items: start; }
.card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
}
.capture { padding: 16px; }
.toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.context-strip {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #0d0d10;
  margin-bottom: 12px;
}
.context-strip-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 650;
}
.context-strip-title::before {
  content: "IS";
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid rgba(249, 115, 22, 0.28);
  color: #fb923c;
  background: rgba(249, 115, 22, 0.08);
  font-size: 10px;
}
.context-strip p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.context-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.framework-docs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.framework-doc {
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  color: var(--muted);
  background: #101014;
  padding: 4px 8px;
  font-size: 12px;
}
/* ─── @gad/visual-context-web overlay styles (inlined from packages/visual-context-web/index.css) ─── */
:root {
  --vcs-bg: var(--bg, #0d0d0d);
  --vcs-bg2: var(--panel, #0c0c0f);
  --vcs-card: var(--panel-raised, #151519);
  --vcs-accent: #D4A017;
  --vcs-accent-bright: #FFD700;
  --vcs-accent-dark: #8C6E10;
  --vcs-red: #C92A2A;
  --vcs-red-soft: rgba(201, 42, 42, 0.10);
  --vcs-fg: var(--ink, #f4f4f5);
  --vcs-fg-dim: var(--muted, #a1a1aa);
  --vcs-border: var(--line, #27272a);
  --vcs-mono: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
  --vcs-panel-w: 360px;
}
body.vcs-devid [data-cid] { position: relative; }
body.vcs-devid [data-cid]:hover {
  outline: 2px solid var(--vcs-accent-bright);
  outline-offset: 1px;
  cursor: crosshair;
}
body.vcs-devid [data-cid]:hover::after {
  content: attr(data-cid);
  position: absolute; top: -10px; right: -2px;
  font: 0.55rem var(--vcs-mono); padding: 0.05rem 0.3rem;
  background: var(--vcs-accent-bright); color: var(--vcs-bg);
  border: 1px solid var(--vcs-accent-dark);
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
.vcs-recording-bucket.vcs-listening .vcs-cidlabel { color: var(--vcs-accent-dark); }
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
  z-index: 65; pointer-events: none; font-family: var(--vcs-mono);
}
.vcs-devhint kbd {
  background: var(--vcs-card); border: 1px solid var(--vcs-accent-dark);
  padding: 0.05rem 0.3rem; color: var(--vcs-accent); margin: 0 0.1rem;
  font-family: var(--vcs-mono); font-size: 0.55rem;
}
label { display: block; color: var(--faint); font-size: 12px; font-weight: 500; margin: 12px 0 6px; }
input, select, textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #0c0c0f;
  color: var(--ink);
  padding: 9px 10px;
  font: inherit;
  font-size: 13px;
  outline: none;
}
.native-select-enhanced {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.select-shell { position: relative; }
.select-trigger {
  --tone: var(--accent);
  --tone-soft: rgba(249, 115, 22, 0.08);
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--tone) 20%, var(--line));
  border-radius: 8px;
  background: #0c0c0f;
  color: var(--ink);
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
  text-align: left;
}
.select-trigger:hover { background: color-mix(in srgb, var(--tone-soft) 55%, #0c0c0f); }
.select-trigger:focus-visible {
  outline: none;
  border-color: var(--tone);
  box-shadow: 0 0 0 3px var(--tone-soft);
}
.select-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.select-caret { color: var(--tone); font-size: 13px; }
.select-menu {
  position: absolute;
  z-index: 30;
  inset-inline: 0;
  top: calc(100% + 6px);
  max-height: 280px;
  overflow: auto;
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #101014;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.38);
}
.select-menu[hidden] { display: none; }
.select-option {
  --tone: var(--accent);
  --tone-soft: rgba(214, 255, 102, 0.12);
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  width: 100%;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ink);
  padding: 7px;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.select-option:hover,
.select-option:focus,
.select-option[aria-selected="true"] {
  background: color-mix(in srgb, var(--tone-soft) 72%, #18181b);
  outline: none;
}
.option-icon {
  --tone: var(--accent);
  --tone-soft: rgba(214, 255, 102, 0.12);
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid color-mix(in srgb, var(--tone) 32%, var(--line));
  border-radius: 6px;
  background: color-mix(in srgb, var(--tone-soft) 72%, #111113);
  color: var(--tone);
  font-size: 10px;
  font-weight: 700;
}
.option-main { min-width: 0; }
.option-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.option-subtitle {
  display: block;
  color: var(--muted);
  font-size: 11px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hover-card {
  --tone: var(--accent);
  --tone-soft: rgba(214, 255, 102, 0.12);
  position: fixed;
  z-index: 60;
  width: min(360px, calc(100vw - 24px));
  border: 1px solid color-mix(in srgb, var(--tone) 22%, var(--line));
  border-radius: 12px;
  background: #111113;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.42);
  padding: 12px;
  pointer-events: none;
}
.hover-card[hidden] { display: none; }
.hover-card-title { display: flex; align-items: center; gap: 8px; font-weight: 650; font-size: 13px; }
.hover-card-body { color: var(--muted); line-height: 1.45; margin-top: 8px; font-size: 12px; }
.hover-card-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.hover-chip {
  border: 1px solid color-mix(in srgb, var(--tone) 18%, var(--line));
  border-radius: 999px;
  color: color-mix(in srgb, var(--tone) 55%, var(--muted));
  padding: 2px 6px;
  font-size: 11px;
}
textarea { min-height: 260px; resize: vertical; line-height: 1.45; }
input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12); }
.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
button {
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--line));
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 14%, #18181b);
  color: #fed7aa;
  font: inherit;
  font-size: 13px;
  font-weight: 550;
  padding: 8px 11px;
  cursor: pointer;
}
button:hover { background: color-mix(in srgb, var(--accent) 20%, #18181b); }
button.secondary { background: #111113; color: var(--ink); border: 1px solid var(--line); }
button.secondary:hover { background: #18181b; }
button.danger { background: transparent; color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.28); }
button.danger:hover { background: rgba(239, 68, 68, 0.08); }
.actions { display: flex; justify-content: space-between; gap: 10px; align-items: center; margin-top: 14px; }
.status { color: var(--muted); font-size: 13px; }
.list { padding: 0; overflow: hidden; }
.issue-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  background: #0f0f12;
}
.issue-list-title {
  display: grid;
  gap: 2px;
}
.issue-list-title strong {
  font-size: 13px;
  font-weight: 650;
}
.issue-list-title span {
  color: var(--muted);
  font-size: 12px;
}
.issue-list-status {
  --tone: var(--accent);
  --tone-soft: rgba(249, 115, 22, 0.08);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--tone) 26%, var(--line));
  border-radius: 999px;
  padding: 4px 8px;
  color: color-mix(in srgb, var(--tone) 58%, var(--ink));
  background: color-mix(in srgb, var(--tone-soft) 65%, #111113);
  font-size: 12px;
}
.issue-tabs {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--line);
  background: #0c0c0f;
}
.issue-tab {
  --tone: var(--accent);
  --tone-soft: rgba(249, 115, 22, 0.08);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  padding: 7px 9px;
}
.issue-tab:hover {
  border-color: color-mix(in srgb, var(--tone) 24%, var(--line));
  background: color-mix(in srgb, var(--tone-soft) 55%, #111113);
}
.issue-tab[aria-selected="true"] {
  color: color-mix(in srgb, var(--tone) 62%, var(--ink));
  border-color: color-mix(in srgb, var(--tone) 34%, var(--line));
  background: color-mix(in srgb, var(--tone-soft) 82%, #111113);
}
.issue-tab-count {
  min-width: 20px;
  border-radius: 999px;
  padding: 1px 6px;
  color: color-mix(in srgb, var(--tone) 68%, var(--ink));
  background: color-mix(in srgb, var(--tone-soft) 80%, #18181b);
  font-size: 11px;
  text-align: center;
}
.issue-list-body { padding: 6px; }
.issue {
  --tone: var(--accent);
  --tone-soft: rgba(214, 255, 102, 0.12);
  display: grid;
  gap: 7px;
  padding: 11px;
  border: 1px solid color-mix(in srgb, var(--tone) 15%, var(--line-soft));
  border-left: 3px solid color-mix(in srgb, var(--tone) 75%, var(--line));
  border-radius: 9px;
  background: color-mix(in srgb, var(--tone-soft) 35%, #101014);
  margin-bottom: 6px;
}
.issue:hover { border-color: color-mix(in srgb, var(--tone) 42%, var(--line)); }
.issue h3 { margin: 0; font-size: 13px; line-height: 1.35; font-weight: 600; }
.issue-heading {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}
.issue-status-badge {
  --tone: var(--accent);
  --tone-soft: rgba(249, 115, 22, 0.08);
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--tone) 30%, var(--line));
  border-radius: 999px;
  color: color-mix(in srgb, var(--tone) 62%, var(--ink));
  background: color-mix(in srgb, var(--tone-soft) 70%, #111113);
  padding: 3px 7px;
  font-size: 11px;
  font-weight: 600;
}
.meta { display: flex; gap: 6px; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
.pill {
  --tone: var(--accent);
  --tone-soft: rgba(214, 255, 102, 0.12);
  border: 1px solid color-mix(in srgb, var(--tone) 24%, var(--line));
  border-radius: 999px;
  padding: 2px 6px;
  background: color-mix(in srgb, var(--tone-soft) 65%, #111113);
  color: color-mix(in srgb, var(--tone) 58%, var(--muted));
  font-size: 11px;
}
.empty { color: var(--muted); padding: 18px; line-height: 1.5; }
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--muted);
  margin: 0;
  font: 12px/1.45 ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  max-height: 150px;
  overflow: auto;
}
@media (max-width: 860px) { .grid, .two, .three { grid-template-columns: 1fr; } header { display: block; } }
</style>
</head>
<body>
<main data-cid="gad-issues.web.root" data-cid-label="GAD Issues Web Root" data-cid-component-tag="SiteSection" data-cid-search="lib/issues-web-html.cjs pattern anchor: <main data-cid=&quot;gad-issues.web.root&quot;">
  <header data-cid="gad-issues.web.header" data-cid-label="Issues Header" data-cid-component-tag="SiteSection" data-cid-search="lib/issues-web-html.cjs pattern anchor: <header data-cid=&quot;gad-issues.web.header&quot;">
    <div>
      <h1>Park the finding. Keep the agents moving.</h1>
      <p class="lede">Capture operator issues, confusing prompts, missing IDs, and follow-ups into durable planning files. Triage them later into tasks, errors, decisions, or handoffs.</p>
    </div>
    <div class="context-actions">
      <button id="vcsToggle" class="secondary" type="button">VCS</button>
      <button id="shutdown" class="danger" type="button">Shutdown</button>
    </div>
  </header>
  <section class="grid" data-cid="gad-issues.web.workspace" data-cid-label="Capture Workspace" data-cid-component-tag="SiteSection" data-cid-search="lib/issues-web-html.cjs pattern anchor: <section class=&quot;grid&quot;">
    <form class="card capture" id="capture" data-cid="gad-issues.web.capture-form" data-cid-label="Issue Capture Form" data-cid-component-tag="Form" data-cid-search="lib/issues-web-html.cjs pattern anchor: <form class=&quot;card capture&quot;">
      <div class="toolbar">
        <button type="submit">Capture Issue</button>
        <button class="secondary" id="refresh" type="button">Refresh</button>
        <span class="status" id="status">Loading...</span>
      </div>
      <div class="context-strip" data-cid="gad-issues.web.framework-context" data-cid-label="Framework Context Strip" data-cid-component-tag="ContextPanel" data-cid-search="lib/issues-web-html.cjs pattern anchor: <div class=&quot;context-strip&quot;">
        <div class="context-strip-title">Planning issue inbox</div>
        <p>This is framework-local capture for human direction, GAD issues, and framework docs. It stays separate from <code>gad docs</code>, which remains project-specific documentation.</p>
        <div class="framework-docs" aria-label="Framework references">
          <span class="framework-doc">visual-context-system</span>
          <span class="framework-doc">panel identities</span>
          <span class="framework-doc">issues storage</span>
        </div>
        <div class="context-actions">
          <button class="secondary" id="launchTui" type="button">Launch GAD TUI</button>
          <span class="status" id="tuiStatus">Opens in a separate terminal window.</span>
        </div>
      </div>
      <label for="projectid">Project</label>
      <select id="projectid" name="projectid"></select>
      <label for="title">Title</label>
      <input id="title" name="title" placeholder="Agent did not know decision id format" required data-cid="issues.composer.title">
      <div class="three">
        <div>
          <label for="severity">Severity</label>
          <select id="severity" name="severity" data-cid="issues.composer.severity"></select>
        </div>
        <div>
          <label for="type">Type</label>
          <select id="type" name="type" data-cid="issues.composer.type"></select>
        </div>
        <div>
          <label for="phase">Phase</label>
          <select id="phase" name="phase" data-cid="issues.composer.phase"></select>
        </div>
      </div>
      <div class="two">
        <div>
          <label for="taskId">Task</label>
          <select id="taskId" name="taskId" data-cid="issues.composer.task"></select>
        </div>
      </div>
      <label for="body">Prompt / Context</label>
      <textarea id="body" name="body" placeholder="Paste the exact prompt, observation, terminal output, or concern to revisit later." required data-cid="issues.composer.body"></textarea>
      <div class="actions">
        <span class="status">Writes to <code>.planning/issues/open</code></span>
        <button type="submit" data-cid="issues.composer.submit">Capture</button>
      </div>
    </form>
    <aside class="card list" data-cid="gad-issues.web.issue-rail" data-cid-label="Human Direction Issue Rail" data-cid-component-tag="SidePanel" data-cid-search="lib/issues-web-html.cjs pattern anchor: <aside class=&quot;card list&quot;">
      <div class="issue-list-header">
        <div class="issue-list-title">
          <strong id="issueListTitle">Human direction inbox</strong>
          <span id="issueListSubtitle">Open items are active operator direction. Closed items are handled history.</span>
        </div>
        <span class="issue-list-status" id="issueListStatus" data-cid="issues.rail.status-badge">open</span>
      </div>
      <div class="issue-tabs" role="tablist" aria-label="Issue status" data-cid="issues.rail.filter-chips">
        <button class="issue-tab" id="openTab" type="button" role="tab" aria-selected="true" data-status="open" data-cid="issues.rail.tab.open">
          <span>Open</span>
          <span class="issue-tab-count" id="openIssueCount" data-cid="issues.rail.tab.open.count">0</span>
        </button>
        <button class="issue-tab" id="closedTab" type="button" role="tab" aria-selected="false" data-status="closed" data-cid="issues.rail.tab.closed">
          <span>Closed</span>
          <span class="issue-tab-count" id="closedIssueCount" data-cid="issues.rail.tab.closed.count">0</span>
        </button>
      </div>
      <div class="issue-list-body" id="issues" data-cid="issues.rail.list">No issues loaded yet.</div>
    </aside>
  </section>
</main>
<!-- VCS side panel is mounted by createVisualContextOverlay (packages/visual-context-web) -->
<script>
const $ = (id) => document.getElementById(id);
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const state = {
  bootstrap: null,
  phases: [],
  tasks: [],
  selects: new Map(),
  hoverCard: null,
  issueView: 'open',
};

const ENTITY_INFO = {
  project: { icon: 'PR', color: '#38bdf8', soft: 'rgba(56, 189, 248, 0.08)', title: 'Project' },
  phase: { icon: 'PH', color: '#a78bfa', soft: 'rgba(167, 139, 250, 0.08)', title: 'Phase' },
  task: { icon: 'TK', color: '#60a5fa', soft: 'rgba(96, 165, 250, 0.08)', title: 'Task' },
  issue: { icon: 'IS', color: '#f97316', soft: 'rgba(249, 115, 22, 0.08)', title: 'Issue' },
};

const PROJECT_KIND_INFO = {
  app: { icon: 'AP', color: '#22d3ee', soft: 'rgba(34, 211, 238, 0.1)', title: 'App', rank: 5, body: 'Application built from this monorepo source.' },
  framework: { icon: 'FW', color: '#fb923c', soft: 'rgba(251, 146, 60, 0.1)', title: 'Framework', rank: 0, body: 'GAD framework surface and framework documentation.' },
  global: { icon: 'GL', color: '#a3e635', soft: 'rgba(163, 230, 53, 0.1)', title: 'Global', rank: 1, body: 'Repository-wide planning root.' },
  package: { icon: 'PK', color: '#60a5fa', soft: 'rgba(96, 165, 250, 0.1)', title: 'Package', rank: 7, body: 'Internal workspace package or shared contract.' },
  project: { icon: 'PJ', color: '#a78bfa', soft: 'rgba(167, 139, 250, 0.1)', title: 'Project', rank: 3, body: 'Standalone product, tool, research, or lore root.' },
  site: { icon: 'ST', color: '#34d399', soft: 'rgba(52, 211, 153, 0.1)', title: 'Site', rank: 2, body: 'Customer-facing brand, marketing, commerce, or docs site.' },
  vendor: { icon: 'VD', color: '#fbbf24', soft: 'rgba(251, 191, 36, 0.1)', title: 'Vendor', rank: 4, body: 'Vendored framework or library substrate.' },
  workspace: { icon: 'WS', color: '#94a3b8', soft: 'rgba(148, 163, 184, 0.1)', title: 'Workspace', rank: 8, body: 'Workspace root that does not match a stricter bucket.' },
};

const TYPE_INFO = {
  'agent-error': { icon: 'AE', color: '#f43f5e', soft: 'rgba(244, 63, 94, 0.08)', title: 'Agent error', body: 'An agent misunderstood context, used the wrong command, missed an id format, or otherwise needs a durable correction.' },
  bug: { icon: 'BG', color: '#f97316', soft: 'rgba(249, 115, 22, 0.08)', title: 'Bug', body: 'A product or framework behavior is broken and should become a fix task after triage.' },
  'follow-up': { icon: 'FU', color: '#0ea5e9', soft: 'rgba(14, 165, 233, 0.08)', title: 'Follow-up', body: 'Useful work discovered during another initiative. Park it without stealing focus.' },
  note: { icon: 'NO', color: '#84cc16', soft: 'rgba(132, 204, 22, 0.08)', title: 'Note', body: 'General context worth preserving for a later planning pass.' },
  planning: { icon: 'PL', color: '#a855f7', soft: 'rgba(168, 85, 247, 0.08)', title: 'Planning', body: 'Planning metadata, task structure, phase scope, or process needs attention.' },
  ux: { icon: 'UX', color: '#eab308', soft: 'rgba(234, 179, 8, 0.08)', title: 'UX', body: 'Interface, workflow, accessibility, or operator-experience feedback.' },
};

const SEVERITY_INFO = {
  critical: { icon: '!!', rank: 0, color: '#ef4444', soft: 'rgba(239, 68, 68, 0.1)', title: 'Critical', body: 'Blocks useful work or risks corrupting durable project state. Triage soon.' },
  high: { icon: 'HI', rank: 1, color: '#f97316', soft: 'rgba(249, 115, 22, 0.09)', title: 'High', body: 'Important and likely to slow active work, but not an immediate stop-the-line issue.' },
  normal: { icon: 'NM', rank: 2, color: '#71717a', soft: 'rgba(113, 113, 122, 0.09)', title: 'Normal', body: 'Worth revisiting in the normal planning sweep.' },
  low: { icon: 'LO', rank: 3, color: '#52525b', soft: 'rgba(82, 82, 91, 0.08)', title: 'Low', body: 'Nice-to-have polish, cleanup, or future consideration.' },
};

const STATUS_INFO = {
  closed: { icon: 'CL', color: '#22c55e', soft: 'rgba(34, 197, 94, 0.14)', title: 'Closed issues', body: 'Handled human-created direction. These records show what was resolved or deliberately dismissed.' },
  open: { icon: 'OP', color: '#f97316', soft: 'rgba(249, 115, 22, 0.1)', title: 'Open issues', body: 'Active human-created direction waiting for follow-up.' },
};

const PHASE_STATUS_INFO = {
  active: { color: '#22c55e', soft: 'rgba(34, 197, 94, 0.14)', label: 'Active phase' },
  planned: { color: '#a78bfa', soft: 'rgba(167, 139, 250, 0.14)', label: 'Planned phase' },
  done: { color: '#14b8a6', soft: 'rgba(20, 184, 166, 0.14)', label: 'Completed phase' },
  cancelled: { color: '#64748b', soft: 'rgba(100, 116, 139, 0.14)', label: 'Cancelled phase' },
};

const TASK_STATUS_INFO = {
  'in-progress': { color: '#38bdf8', soft: 'rgba(56, 189, 248, 0.14)', label: 'In-progress task' },
  active: { color: '#38bdf8', soft: 'rgba(56, 189, 248, 0.14)', label: 'Active task' },
  planned: { color: '#60a5fa', soft: 'rgba(96, 165, 250, 0.14)', label: 'Planned task' },
  done: { color: '#22c55e', soft: 'rgba(34, 197, 94, 0.14)', label: 'Completed task' },
  cancelled: { color: '#64748b', soft: 'rgba(100, 116, 139, 0.14)', label: 'Cancelled task' },
};

function option(value, label, meta = {}) {
  const el = document.createElement('option');
  el.value = value;
  el.textContent = label;
  for (const [key, val] of Object.entries(meta)) {
    if (val != null) el.dataset[key] = String(val);
  }
  return el;
}

function setStatus(text) {
  $('status').textContent = text;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || res.statusText);
  return payload;
}

async function loadBootstrap() {
  state.bootstrap = await api('/api/bootstrap');
  const project = $('projectid');
  const projects = [...state.bootstrap.projects].sort((a, b) => {
    const aKind = projectKindInfo(a.kind);
    const bKind = projectKindInfo(b.kind);
    return (aKind.rank ?? 99) - (bKind.rank ?? 99) || collator.compare(a.id, b.id);
  });
  project.replaceChildren(...projects.map((p) => {
    const kind = projectKindInfo(p.kind);
    return option(p.id, kind.title + ' / ' + p.id + '  ' + p.path, {
    icon: kind.icon,
    color: kind.color,
    soft: kind.soft,
    title: p.id,
    subtitle: kind.title + ' / ' + p.path,
    body: kind.body + ' Planning root at ' + p.path + '/' + p.planningDir,
    meta: 'kind: ' + (p.kind || 'workspace'),
  });
  }));
  project.value = state.bootstrap.defaultProjectid;
  const severities = [...state.bootstrap.severities].sort((a, b) => (SEVERITY_INFO[a]?.rank ?? 99) - (SEVERITY_INFO[b]?.rank ?? 99));
  $('severity').replaceChildren(...severities.map((s) => option(s, SEVERITY_INFO[s]?.title || s, {
    icon: SEVERITY_INFO[s]?.icon || 'SE',
    color: SEVERITY_INFO[s]?.color || ENTITY_INFO.issue.color,
    soft: SEVERITY_INFO[s]?.soft || ENTITY_INFO.issue.soft,
    title: SEVERITY_INFO[s]?.title || s,
    body: SEVERITY_INFO[s]?.body || '',
  })));
  $('severity').value = 'normal';
  const types = [...state.bootstrap.types].sort((a, b) => collator.compare(TYPE_INFO[a]?.title || a, TYPE_INFO[b]?.title || b));
  $('type').replaceChildren(...types.map((t) => option(t, TYPE_INFO[t]?.title || t, {
    icon: TYPE_INFO[t]?.icon || 'TY',
    color: TYPE_INFO[t]?.color || ENTITY_INFO.issue.color,
    soft: TYPE_INFO[t]?.soft || ENTITY_INFO.issue.soft,
    title: TYPE_INFO[t]?.title || t,
    body: TYPE_INFO[t]?.body || '',
  })));
  $('type').value = 'agent-error';
  enhanceSelects(['projectid', 'severity', 'type', 'phase', 'taskId']);
  enhanceIssueTabs();
  refreshAllSelects();
  await loadProject();
}

async function loadProject() {
  const projectid = $('projectid').value;
  const data = await api('/api/project?projectid=' + encodeURIComponent(projectid));
  state.phases = [...data.phases].sort((a, b) => collator.compare(a.id, b.id));
  state.tasks = [...data.tasks].sort((a, b) => collator.compare(a.phase, b.phase) || collator.compare(a.id, b.id));
  $('phase').replaceChildren(
    option('', 'None', { icon: ENTITY_INFO.phase.icon, color: ENTITY_INFO.phase.color, soft: ENTITY_INFO.phase.soft, title: 'No phase', body: 'Capture this issue without tying it to a specific roadmap phase.' }),
    ...state.phases.map((p) => {
      const statusInfo = PHASE_STATUS_INFO[String(p.status || '').toLowerCase()] || {};
      return option(p.id, p.id + ' - ' + p.title, {
      icon: ENTITY_INFO.phase.icon,
      color: statusInfo.color || ENTITY_INFO.phase.color,
      soft: statusInfo.soft || ENTITY_INFO.phase.soft,
      title: 'Phase ' + p.id,
      subtitle: p.status || '',
      body: p.title || '',
      meta: statusInfo.label || (p.status ? 'status: ' + p.status : ''),
    });
    }),
  );
  renderTaskOptions();
  refreshSelect('phase');
  await loadIssues();
}

function renderTaskOptions() {
  const phase = $('phase').value;
  const tasks = state.tasks
    .filter((task) => !phase || task.phase === phase)
    .sort((a, b) => collator.compare(a.id, b.id));
  $('taskId').replaceChildren(
    option('', 'None', { icon: ENTITY_INFO.task.icon, color: ENTITY_INFO.task.color, soft: ENTITY_INFO.task.soft, title: 'No task', body: 'Capture this issue without tying it to a specific task.' }),
    ...tasks.map((t) => {
      const statusInfo = TASK_STATUS_INFO[String(t.status || '').toLowerCase()] || {};
      return option(t.id, t.id + ' - ' + t.goal.slice(0, 90), {
      icon: ENTITY_INFO.task.icon,
      color: statusInfo.color || ENTITY_INFO.task.color,
      soft: statusInfo.soft || ENTITY_INFO.task.soft,
      title: 'Task ' + t.id,
      subtitle: 'phase ' + t.phase + ' / ' + t.status,
      body: t.goal || '',
      meta: statusInfo.label || 'status: ' + t.status,
    });
    }),
  );
  refreshSelect('taskId');
}

async function loadIssues() {
  const projectid = $('projectid').value;
  const status = state.issueView || 'open';
  const data = await api('/api/issues?projectid=' + encodeURIComponent(projectid) + '&status=' + encodeURIComponent(status));
  await loadIssueCounts(projectid);
  renderIssues(data.issues || []);
  setStatus('Loaded ' + (data.issues || []).length + ' issue(s)');
}

async function loadIssueCounts(projectid) {
  const [openData, closedData] = await Promise.all([
    api('/api/issues?projectid=' + encodeURIComponent(projectid) + '&status=open'),
    api('/api/issues?projectid=' + encodeURIComponent(projectid) + '&status=closed'),
  ]);
  $('openIssueCount').textContent = String((openData.issues || []).length);
  $('closedIssueCount').textContent = String((closedData.issues || []).length);
}

function renderIssues(issues) {
  const root = $('issues');
  updateIssueListHeader(issues);
  if (!issues.length) {
    root.className = 'empty';
    root.textContent = state.issueView === 'closed'
      ? 'No closed issues yet. Handled human direction will appear here.'
      : 'No open issues. Capture one without interrupting the active run.';
    return;
  }
  root.className = 'issue-list-body';
  root.replaceChildren(...issues.map((issue) => {
    const item = document.createElement('article');
    item.className = 'issue';
    item.dataset.cid = 'issues.row.' + String(issue.id || 'unknown');
    item.dataset.cidLabel = 'Issue card ' + String(issue.id || 'unknown');
    item.dataset.cidComponentTag = 'IssueCard';
    item.dataset.cidSearch = "lib/issues-web-html.cjs pattern anchor: const item = document.createElement('article')";
    const severityMeta = severityMetaFor(issue.severity);
    applyTone(item, severityMeta);
    const statusMeta = statusMetaFor(issue.status);
    const heading = document.createElement('div');
    heading.className = 'issue-heading';
    const title = document.createElement('h3');
    title.textContent = issue.title || issue.id;
    const statusBadge = document.createElement('span');
    statusBadge.className = 'issue-status-badge';
    statusBadge.dataset.cid = 'issues.row.' + String(issue.id || 'unknown') + '.status';
    statusBadge.textContent = statusMeta.label;
    applyTone(statusBadge, statusMeta);
    heading.append(title, statusBadge);
    const meta = document.createElement('div');
    meta.className = 'meta';
    issuePills(issue)
      .filter(Boolean)
      .forEach((pillMeta) => {
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = pillMeta.label;
        applyTone(pill, pillMeta);
        meta.appendChild(pill);
      });
    const body = document.createElement('pre');
    body.textContent = issue.body || '';
    item.append(heading, meta, body);
    if (issue.status !== 'closed') {
      const close = document.createElement('button');
      close.className = 'secondary';
      close.type = 'button';
      close.textContent = 'Close';
      close.onclick = async () => {
        await api('/api/issues/' + encodeURIComponent(issue.id) + '/close', {
          method: 'POST',
          body: JSON.stringify({ projectid: $('projectid').value }),
        });
        await loadIssues();
      };
      item.appendChild(close);
    }
    return item;
  }));
}

function updateIssueListHeader(issues) {
  const status = state.issueView || 'open';
  const statusMeta = statusMetaFor(status);
  const title = $('issueListTitle');
  const subtitle = $('issueListSubtitle');
  const badge = $('issueListStatus');
  title.textContent = statusMeta.label;
  subtitle.textContent = status === 'closed'
    ? issues.length + ' handled human direction item' + (issues.length === 1 ? '' : 's')
    : issues.length + ' active human direction item' + (issues.length === 1 ? '' : 's');
  badge.textContent = statusMeta.label.toLowerCase();
  applyTone(badge, statusMeta);
}

function enhanceSelects(ids) {
  for (const id of ids) enhanceSelect(id);
}

function enhanceIssueTabs() {
  for (const tab of [$('openTab'), $('closedTab')]) {
    if (!tab) continue;
    const status = tab.dataset.status || 'open';
    const meta = statusMetaFor(status);
    applyTone(tab, meta);
    const count = tab.querySelector('.issue-tab-count');
    if (count) applyTone(count, meta);
    tab.addEventListener('click', async () => {
      state.issueView = status;
      updateIssueTabs();
      await loadIssues();
    });
  }
  updateIssueTabs();
}

function updateIssueTabs() {
  for (const tab of [$('openTab'), $('closedTab')]) {
    if (!tab) continue;
    const selected = (tab.dataset.status || 'open') === state.issueView;
    tab.setAttribute('aria-selected', String(selected));
  }
}

function enhanceSelect(id) {
  const select = $(id);
  if (!select || state.selects.has(id)) return;
  select.classList.add('native-select-enhanced');
  const shell = document.createElement('div');
  shell.className = 'select-shell';
  shell.dataset.selectId = id;
  shell.dataset.cid = 'gad-issues.web.select.' + id;
  shell.dataset.cidLabel = 'Select ' + id;
  shell.dataset.cidComponentTag = 'Select';
  shell.dataset.cidSearch = 'lib/issues-web-html.cjs pattern anchor: function enhanceSelect(id)';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.innerHTML = '<span class="option-icon select-trigger-icon"></span><span class="select-label"></span><span class="select-caret">v</span>';
  const menu = document.createElement('div');
  menu.className = 'select-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'listbox');
  shell.append(trigger, menu);
  select.insertAdjacentElement('afterend', shell);
  trigger.addEventListener('click', () => toggleSelect(id));
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSelect(id);
    }
  });
  state.selects.set(id, { select, shell, trigger, menu });
}

function refreshAllSelects() {
  for (const id of state.selects.keys()) refreshSelect(id);
}

function refreshSelect(id) {
  const entry = state.selects.get(id);
  if (!entry) return;
  const { select, trigger, menu } = entry;
  const selected = select.selectedOptions[0] || select.options[0];
  const meta = selected ? optionMeta(id, selected) : { icon: '--' };
  applyTone(trigger, meta);
  applyTone(trigger.querySelector('.select-trigger-icon'), meta);
  trigger.querySelector('.select-trigger-icon').textContent = meta.icon;
  trigger.querySelector('.select-label').textContent = selected ? selected.textContent : 'Select';
  trigger.title = selected ? selected.textContent : '';
  menu.replaceChildren(...Array.from(select.options).map((opt) => renderSelectOption(id, opt)));
}

function renderSelectOption(id, opt) {
  const meta = optionMeta(id, opt);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'select-option';
  button.setAttribute('role', 'option');
  button.setAttribute('aria-selected', String(opt.selected));
  applyTone(button, meta);
  button.innerHTML =
    '<span class="option-icon"></span>' +
    '<span class="option-main"><span class="option-title"></span><span class="option-subtitle"></span></span>';
  button.querySelector('.option-icon').textContent = meta.icon;
  applyTone(button.querySelector('.option-icon'), meta);
  button.querySelector('.option-title').textContent = meta.title;
  button.querySelector('.option-subtitle').textContent = meta.subtitle || meta.value || '';
  button.addEventListener('click', () => {
    const select = $(id);
    select.value = opt.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    closeSelect(id);
    refreshSelect(id);
  });
  button.addEventListener('mouseenter', (event) => showHoverCard(meta, event));
  button.addEventListener('focus', (event) => showHoverCard(meta, event));
  button.addEventListener('mousemove', (event) => positionHoverCard(event));
  button.addEventListener('mouseleave', hideHoverCard);
  button.addEventListener('blur', hideHoverCard);
  return button;
}

function optionMeta(id, opt) {
  const data = opt.dataset || {};
  const fallbackIcon = id === 'projectid' ? 'PR' : id === 'phase' ? 'PH' : id === 'taskId' ? 'TK' : id === 'severity' ? 'SE' : id === 'type' ? 'TY' : 'ST';
  return {
    value: opt.value,
    icon: data.icon || fallbackIcon,
    title: data.title || opt.textContent || opt.value || 'None',
    subtitle: data.subtitle || '',
    body: data.body || opt.textContent || '',
    meta: data.meta || '',
    color: data.color || ENTITY_INFO.issue.color,
    soft: data.soft || ENTITY_INFO.issue.soft,
  };
}

function projectKindInfo(kind) {
  return PROJECT_KIND_INFO[String(kind || 'workspace').toLowerCase()] || PROJECT_KIND_INFO.workspace;
}

function issuePills(issue) {
  return [
    statusMetaFor(issue.status),
    severityMetaFor(issue.severity),
    typeMetaFor(issue.type),
    issue.phase ? phaseMetaFor(issue.phase) : null,
    issue.task_id ? taskMetaFor(issue.task_id) : null,
  ];
}

function statusMetaFor(status) {
  const key = String(status || 'open').toLowerCase();
  const info = STATUS_INFO[key] || STATUS_INFO.open;
  return { label: info.title || key, icon: info.icon, color: info.color, soft: info.soft };
}

function severityMetaFor(severity) {
  const key = String(severity || 'normal').toLowerCase();
  const info = SEVERITY_INFO[key] || SEVERITY_INFO.normal;
  return { label: info.title || key, icon: info.icon, color: info.color, soft: info.soft };
}

function typeMetaFor(type) {
  const key = String(type || 'note').toLowerCase();
  const info = TYPE_INFO[key] || TYPE_INFO.note;
  return { label: info.title || key, icon: info.icon, color: info.color, soft: info.soft };
}

function phaseMetaFor(phaseId) {
  const phase = state.phases.find((entry) => String(entry.id) === String(phaseId));
  const statusInfo = PHASE_STATUS_INFO[String(phase?.status || '').toLowerCase()] || {};
  return {
    label: 'phase ' + phaseId,
    icon: ENTITY_INFO.phase.icon,
    color: statusInfo.color || ENTITY_INFO.phase.color,
    soft: statusInfo.soft || ENTITY_INFO.phase.soft,
  };
}

function taskMetaFor(taskId) {
  const task = state.tasks.find((entry) => String(entry.id) === String(taskId));
  const statusInfo = TASK_STATUS_INFO[String(task?.status || '').toLowerCase()] || {};
  return {
    label: 'task ' + taskId,
    icon: ENTITY_INFO.task.icon,
    color: statusInfo.color || ENTITY_INFO.task.color,
    soft: statusInfo.soft || ENTITY_INFO.task.soft,
  };
}

function applyTone(el, meta = {}) {
  if (!el) return;
  el.style.setProperty('--tone', meta.color || ENTITY_INFO.issue.color);
  el.style.setProperty('--tone-soft', meta.soft || softColor(meta.color || ENTITY_INFO.issue.color));
}

function softColor(hex) {
  const rgb = hexToRgb(hex || ENTITY_INFO.issue.color);
  if (!rgb) return ENTITY_INFO.issue.soft;
  return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.15)';
}

function projectColor(projectid) {
  const palette = ['#7dd3fc', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#22d3ee', '#fb7185', '#c084fc'];
  let hash = 0;
  for (const ch of String(projectid || 'project')) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function hexToRgb(hex) {
  const match = String(hex || '').trim().match(/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

function toggleSelect(id) {
  const entry = state.selects.get(id);
  if (!entry) return;
  if (entry.menu.hidden) openSelect(id);
  else closeSelect(id);
}

function openSelect(id) {
  for (const [otherId] of state.selects) {
    if (otherId !== id) closeSelect(otherId);
  }
  const entry = state.selects.get(id);
  if (!entry) return;
  refreshSelect(id);
  entry.menu.hidden = false;
  entry.trigger.setAttribute('aria-expanded', 'true');
  const selected = entry.menu.querySelector('[aria-selected="true"]') || entry.menu.querySelector('.select-option');
  if (selected) selected.focus({ preventScroll: true });
}

function closeSelect(id) {
  const entry = state.selects.get(id);
  if (!entry) return;
  entry.menu.hidden = true;
  entry.trigger.setAttribute('aria-expanded', 'false');
  hideHoverCard();
}

function ensureHoverCard() {
  if (state.hoverCard) return state.hoverCard;
  const card = document.createElement('div');
  card.className = 'hover-card';
  card.hidden = true;
  card.innerHTML =
    '<div class="hover-card-title"><span class="option-icon"></span><span></span></div>' +
    '<div class="hover-card-body"></div>' +
    '<div class="hover-card-meta"></div>';
  document.body.appendChild(card);
  state.hoverCard = card;
  return card;
}

function showHoverCard(meta, event) {
  const card = ensureHoverCard();
  applyTone(card, meta);
  card.querySelector('.option-icon').textContent = meta.icon;
  applyTone(card.querySelector('.option-icon'), meta);
  card.querySelector('.hover-card-title span:last-child').textContent = meta.title;
  card.querySelector('.hover-card-body').textContent = meta.body || meta.subtitle || meta.value || '';
  const chips = card.querySelector('.hover-card-meta');
  const parts = [meta.subtitle, meta.value && meta.value !== meta.title ? 'id: ' + meta.value : '', meta.meta].filter(Boolean);
  chips.replaceChildren(...parts.map((part) => {
    const chip = document.createElement('span');
    chip.className = 'hover-chip';
    chip.textContent = part;
    applyTone(chip, meta);
    return chip;
  }));
  card.hidden = false;
  positionHoverCard(event);
}

function positionHoverCard(event) {
  const card = ensureHoverCard();
  if (card.hidden) return;
  const margin = 14;
  const rect = card.getBoundingClientRect();
  const targetRect = event.target && event.target.getBoundingClientRect ? event.target.getBoundingClientRect() : null;
  const anchorX = Number.isFinite(event.clientX) ? event.clientX : (targetRect ? targetRect.right : margin);
  const anchorY = Number.isFinite(event.clientY) ? event.clientY : (targetRect ? targetRect.top : margin);
  const x = Math.min(window.innerWidth - rect.width - margin, anchorX + 18);
  const y = Math.min(window.innerHeight - rect.height - margin, anchorY + 18);
  card.style.left = Math.max(margin, x) + 'px';
  card.style.top = Math.max(margin, y) + 'px';
}

function hideHoverCard() {
  if (state.hoverCard) state.hoverCard.hidden = true;
}

// ─── Visual Context System helpers (used by vcsToggle button) ────────────────
// The full VCS overlay (Alt+I hover, Alt+click voice, Ctrl+; UPDATE, passive dot,
// side panel, typewriter merge) is handled by createVisualContextOverlay() below.
// vcsOverlay is set after the module script initialises.
let vcsOverlay = null;

$('capture').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    projectid: $('projectid').value,
    title: $('title').value,
    body: $('body').value,
    severity: $('severity').value,
    type: $('type').value,
    phase: $('phase').value,
    taskId: $('taskId').value,
  };
  setStatus('Capturing...');
  const result = await api('/api/issues', { method: 'POST', body: JSON.stringify(payload) });
  $('title').value = '';
  $('body').value = '';
  setStatus('Captured ' + result.id);
  await loadIssues();
});

$('projectid').addEventListener('change', loadProject);
$('phase').addEventListener('change', renderTaskOptions);
$('refresh').addEventListener('click', loadProject);
$('vcsToggle').addEventListener('click', () => {
  // Toggle the VCS side panel managed by createVisualContextOverlay.
  const panel = document.querySelector('.vcs-side-panel');
  if (panel) panel.classList.toggle('vcs-open');
});
$('launchTui').addEventListener('click', async () => {
  const projectid = $('projectid').value;
  $('tuiStatus').textContent = 'Launching GAD TUI...';
  try {
    await api('/api/tui', {
      method: 'POST',
      body: JSON.stringify({ projectid }),
    });
    $('tuiStatus').textContent = 'Launched gad tui for ' + projectid + '.';
  } catch (error) {
    $('tuiStatus').textContent = error.message;
  }
});
$('shutdown').addEventListener('click', async () => {
  setStatus('Shutting down...');
  await api('/api/shutdown', { method: 'POST', body: '{}' });
  document.body.innerHTML = '<main><h1>GAD issue capture stopped.</h1><p class="lede">You can close this tab.</p></main>';
});
document.addEventListener('click', (event) => {
  for (const [id, entry] of state.selects) {
    if (!entry.shell.contains(event.target) && event.target !== entry.select) closeSelect(id);
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    for (const [id] of state.selects) closeSelect(id);
  }
  // Alt+I is handled by createVisualContextOverlay (packages/visual-context-web).
});

loadBootstrap().catch((error) => setStatus(error.message));
</script>

<script type="module">
// ─── @gad/visual-context-web — inlined (packages/visual-context-web/index.js) ──
// Source: vendor/get-anything-done/packages/visual-context-web/index.js
// Reference: phase 185, task 185-02

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
    return lines.join('\\n');
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

// ─── Boot VCS on the issues page ─────────────────────────────────────────────
window.vcsOverlay = createVisualContextOverlay({
  cidPrefix: 'issues',
  onVoiceTag: ({ cid, ts, transcript }) => {
    console.debug('[vcs] voice tag captured', { cid, ts, transcript });
  },
  onUpdate: (str) => {
    console.debug('[vcs] UPDATE copied to clipboard', str.slice(0, 80));
  },
  showDevHint: true,
});
// Expose for vcsToggle button wiring (see inline script above)
// The button toggles .vcs-open class on the panel which slides it in/out.
</script>
</body>
</html>`;
}

module.exports = { renderIssuesHtml };
