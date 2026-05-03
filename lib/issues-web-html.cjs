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
.vc-panel {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 80;
  width: min(380px, calc(100vw - 36px));
  max-height: min(520px, calc(100vh - 36px));
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #101014;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  padding: 10px;
}
.vc-panel[hidden] { display: none; }
.vc-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line-soft);
}
.vc-panel-header strong { font-size: 13px; }
.vc-panel-header span { color: var(--muted); font-size: 12px; }
.vc-selected-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line-soft);
  color: var(--muted);
  font-size: 12px;
}
.vc-selected-actions,
.vc-entry-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.vc-recorder {
  display: grid;
  gap: 8px;
  margin: 8px 0;
  padding: 9px;
  border: 1px solid rgba(249, 115, 22, 0.32);
  border-radius: 10px;
  background: rgba(249, 115, 22, 0.08);
}
.vc-recorder[hidden] { display: none; }
.vc-recorder-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.vc-recorder-head strong {
  font-size: 12px;
}
.vc-recorder-head span,
.vc-recorder-log {
  color: var(--muted);
  font-size: 11px;
}
.vc-recorder-live {
  min-height: 58px;
  max-height: 128px;
  overflow: auto;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: #0c0c0f;
  color: var(--ink);
  padding: 8px;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
}
.vc-recorder-interim {
  color: #fed7aa;
}
.vc-entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  padding: 8px;
  text-align: left;
  font: inherit;
}
.vc-entry:hover { background: #18181b; }
.vc-entry[data-selected="true"] {
  border-color: rgba(249, 115, 22, 0.36);
  background: rgba(249, 115, 22, 0.08);
}
.vc-entry-main {
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  text-align: left;
  font: inherit;
}
.vc-entry code {
  color: #fb923c;
  font: 12px ui-monospace, "SFMono-Regular", Consolas, monospace;
  overflow-wrap: anywhere;
}
.vc-entry span { color: var(--muted); font-size: 11px; }
.vc-entry-action {
  border-color: var(--line);
  background: #111113;
  color: var(--ink);
  padding: 5px 7px;
  font-size: 11px;
}
.vc-entry-action[data-active="true"] {
  border-color: rgba(249, 115, 22, 0.46);
  color: #fed7aa;
  background: rgba(249, 115, 22, 0.12);
}
.vc-highlight {
  outline: 2px solid #fb923c;
  outline-offset: 2px;
}
.vc-selected-target {
  outline: 2px solid #f97316;
  outline-offset: 3px;
  box-shadow: 0 0 0 5px rgba(249, 115, 22, 0.14);
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
      <input id="title" name="title" placeholder="Agent did not know decision id format" required>
      <div class="three">
        <div>
          <label for="severity">Severity</label>
          <select id="severity" name="severity"></select>
        </div>
        <div>
          <label for="type">Type</label>
          <select id="type" name="type"></select>
        </div>
        <div>
          <label for="phase">Phase</label>
          <select id="phase" name="phase"></select>
        </div>
      </div>
      <div class="two">
        <div>
          <label for="taskId">Task</label>
          <select id="taskId" name="taskId"></select>
        </div>
      </div>
      <label for="body">Prompt / Context</label>
      <textarea id="body" name="body" placeholder="Paste the exact prompt, observation, terminal output, or concern to revisit later." required></textarea>
      <div class="actions">
        <span class="status">Writes to <code>.planning/issues/open</code></span>
        <button type="submit">Capture</button>
      </div>
    </form>
    <aside class="card list" data-cid="gad-issues.web.issue-rail" data-cid-label="Human Direction Issue Rail" data-cid-component-tag="SidePanel" data-cid-search="lib/issues-web-html.cjs pattern anchor: <aside class=&quot;card list&quot;">
      <div class="issue-list-header">
        <div class="issue-list-title">
          <strong id="issueListTitle">Human direction inbox</strong>
          <span id="issueListSubtitle">Open items are active operator direction. Closed items are handled history.</span>
        </div>
        <span class="issue-list-status" id="issueListStatus">open</span>
      </div>
      <div class="issue-tabs" role="tablist" aria-label="Issue status">
        <button class="issue-tab" id="openTab" type="button" role="tab" aria-selected="true" data-status="open">
          <span>Open</span>
          <span class="issue-tab-count" id="openIssueCount">0</span>
        </button>
        <button class="issue-tab" id="closedTab" type="button" role="tab" aria-selected="false" data-status="closed">
          <span>Closed</span>
          <span class="issue-tab-count" id="closedIssueCount">0</span>
        </button>
      </div>
      <div class="issue-list-body" id="issues">No issues loaded yet.</div>
    </aside>
  </section>
</main>
<div class="vc-panel" id="vcPanel" hidden aria-live="polite"></div>
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
  selectedTargets: new Set(),
  recorder: null,
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
    item.dataset.cid = 'gad-issues.web.issue-card.' + String(issue.id || 'unknown');
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

function collectVcEntries() {
  return Array.from(document.querySelectorAll('[data-cid]')).map((node) => ({
    cid: node.dataset.cid || '',
    label: node.dataset.cidLabel || node.dataset.cid || '',
    componentTag: node.dataset.cidComponentTag || '',
    searchHint: node.dataset.cidSearch || '',
    node,
  })).filter((entry) => entry.cid);
}

function renderVcPanel() {
  const panel = $('vcPanel');
  const entries = collectVcEntries();
  syncVcTargetHighlights(entries);
  panel.innerHTML =
    '<div class="vc-panel-header"><div><strong>Visual Context</strong><br><span>Alt+I toggles. Select one or many targets, then record or copy a prompt.</span></div><button class="secondary" type="button" id="vcClose">Close</button></div>' +
    '<div class="vc-selected-bar"><span id="vcSelectedSummary">0 targets selected</span><div class="vc-selected-actions"><button class="vc-entry-action" type="button" id="vcCopySelected">Copy selected</button><button class="vc-entry-action" type="button" id="vcRecordSelected">Record selected</button><button class="vc-entry-action" type="button" id="vcClearSelected">Clear</button></div></div>' +
    '<div class="vc-recorder" id="vcRecorder" hidden><div class="vc-recorder-head"><div><strong id="vcRecorderTitle">Recording</strong><br><span id="vcRecorderStatus">Listening...</span></div><div class="vc-selected-actions"><button class="vc-entry-action" type="button" id="vcStopCapture">Stop + capture</button><button class="vc-entry-action" type="button" id="vcCancelCapture">Cancel</button></div></div><div class="vc-recorder-live" id="vcRecorderLive"></div><div class="vc-recorder-log" id="vcRecorderLog"></div></div>' +
    '<div id="vcEntries"></div>';
  const list = panel.querySelector('#vcEntries');
  list.replaceChildren(...entries.map((entry) => {
    const row = document.createElement('div');
    row.className = 'vc-entry';
    row.dataset.cid = entry.cid;
    row.dataset.selected = String(state.selectedTargets.has(entry.cid));
    row.innerHTML =
      '<button class="vc-entry-main" type="button"><code></code><br><span></span></button>' +
      '<div class="vc-entry-actions"><button class="vc-entry-action" type="button" data-action="select"></button><button class="vc-entry-action" type="button" data-action="record">Record</button></div>';
    row.querySelector('code').textContent = entry.cid;
    row.querySelector('span').textContent = [entry.label, entry.componentTag].filter(Boolean).join(' / ');
    row.querySelector('[data-action="select"]').textContent = state.selectedTargets.has(entry.cid) ? 'Deselect' : 'Select';
    row.querySelector('[data-action="record"]').dataset.active = String(isVcRecordingTarget(entry.cid));
    row.addEventListener('mouseenter', () => entry.node.classList.add('vc-highlight'));
    row.addEventListener('mouseleave', () => entry.node.classList.remove('vc-highlight'));
    row.querySelector('.vc-entry-main').addEventListener('click', () => toggleVcTarget(entry.cid));
    row.querySelector('[data-action="select"]').addEventListener('click', () => toggleVcTarget(entry.cid));
    row.querySelector('[data-action="record"]').addEventListener('click', () => recordVcInput([entry]));
    return row;
  }));
  panel.querySelector('#vcClose').addEventListener('click', toggleVcPanel);
  panel.querySelector('#vcClearSelected').addEventListener('click', clearVcTargets);
  panel.querySelector('#vcCopySelected').addEventListener('click', () => copyVcPrompt(selectedVcEntries(entries)));
  panel.querySelector('#vcRecordSelected').addEventListener('click', () => {
    const selected = selectedVcEntries(entries);
    recordVcInput(selected.length ? selected : entries.slice(0, 1));
  });
  panel.querySelector('#vcStopCapture').addEventListener('click', () => stopVcRecording({ capture: true }));
  panel.querySelector('#vcCancelCapture').addEventListener('click', () => stopVcRecording({ capture: false }));
  updateVcSelectionUi(entries);
  updateVcRecorderUi();
}

function toggleVcPanel() {
  const panel = $('vcPanel');
  if (panel.hidden) renderVcPanel();
  panel.hidden = !panel.hidden;
}

function selectedVcEntries(entries = collectVcEntries()) {
  return entries.filter((entry) => state.selectedTargets.has(entry.cid));
}

function isVcRecordingTarget(cid) {
  return Boolean(state.recorder?.targets?.some((target) => target.cid === cid));
}

function syncVcTargetHighlights(entries = collectVcEntries()) {
  for (const entry of entries) {
    entry.node.classList.toggle('vc-selected-target', state.selectedTargets.has(entry.cid));
  }
}

function toggleVcTarget(cid) {
  if (state.selectedTargets.has(cid)) state.selectedTargets.delete(cid);
  else state.selectedTargets.add(cid);
  renderVcPanel();
}

function clearVcTargets() {
  state.selectedTargets.clear();
  syncVcTargetHighlights();
  renderVcPanel();
}

function updateVcSelectionUi(entries = collectVcEntries()) {
  const selected = selectedVcEntries(entries);
  const summary = $('vcSelectedSummary');
  if (summary) summary.textContent = selected.length + ' target' + (selected.length === 1 ? '' : 's') + ' selected';
}

function buildVcPrompt(entries, requestText = '') {
  const targets = entries.length ? entries : selectedVcEntries();
  return [
    'operation: UPDATE',
    'route: /',
    'targets:',
    ...targets.map((entry) => [
      '- target id: ' + entry.cid,
      '  label: ' + entry.label,
      '  source file: ' + (entry.searchHint || 'lib/issues-web-html.cjs'),
    ].join('\\n')),
    'request: ' + requestText,
  ].join('\\n');
}

async function copyVcPrompt(entries) {
  const targets = entries.length ? entries : selectedVcEntries();
  if (!targets.length) {
    setStatus('Select at least one VCS target first.');
    return;
  }
  await navigator.clipboard?.writeText(buildVcPrompt(targets));
  setStatus('Copied VCS prompt for ' + targets.length + ' target(s)');
}

function appendVcCapture(entries, transcript) {
  const targets = entries.length ? entries : selectedVcEntries();
  const prompt = buildVcPrompt(targets, transcript);
  const body = $('body');
  const prefix = body.value.trim() ? '\\n\\n' : '';
  body.value += prefix + prompt;
  if (!$('title').value.trim() && targets[0]) $('title').value = 'Update ' + targets[0].label;
  setStatus('Captured VCS input for ' + targets.length + ' target(s)');
}

function liveRecorderText() {
  if (!state.recorder) return '';
  return [state.recorder.transcript, state.recorder.interim]
    .filter(Boolean)
    .join(state.recorder.transcript && state.recorder.interim ? ' ' : '');
}

function updateVcRecorderUi() {
  const panel = $('vcPanel');
  if (!panel || panel.hidden) return;
  const box = $('vcRecorder');
  if (!box) return;
  const recorder = state.recorder;
  box.hidden = !recorder;
  if (!recorder) return;
  const elapsed = Math.max(0, Math.floor((Date.now() - recorder.startedAt) / 1000));
  $('vcRecorderTitle').textContent = 'Recording ' + recorder.targets.length + ' target' + (recorder.targets.length === 1 ? '' : 's');
  $('vcRecorderStatus').textContent = 'Listening for ' + elapsed + 's. Use Stop + capture when you are done.';
  const live = $('vcRecorderLive');
  live.textContent = recorder.transcript || '';
  if (recorder.interim) {
    const interim = document.createElement('span');
    interim.className = 'vc-recorder-interim';
    interim.textContent = (recorder.transcript ? ' ' : '') + recorder.interim;
    live.appendChild(interim);
  }
  $('vcRecorderLog').textContent = recorder.activity.slice(-3).join(' / ');
}

function logVcRecorder(message) {
  if (!state.recorder) return;
  state.recorder.activity.push(message);
  updateVcRecorderUi();
}

function recordVcInput(entries) {
  const targets = entries.length ? entries : selectedVcEntries();
  if (!targets.length) {
    setStatus('Select a VCS target before recording.');
    return;
  }
  if (state.recorder) {
    stopVcRecording({ capture: true });
  }
  for (const target of targets) state.selectedTargets.add(target.cid);
  syncVcTargetHighlights();
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const text = window.prompt('Describe the update for the selected VCS target(s):');
    if (text) appendVcCapture(targets, text);
    renderVcPanel();
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = true;
  state.recorder = {
    recognition,
    targets,
    transcript: '',
    interim: '',
    startedAt: Date.now(),
    stopped: false,
    activity: ['microphone starting'],
    restartTimer: null,
    uiTimer: window.setInterval(updateVcRecorderUi, 1000),
  };
  renderVcPanel();
  setStatus('Recording VCS input. Speak freely, then press Stop + capture.');
  recognition.onresult = (event) => {
    if (!state.recorder) return;
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const phrase = result[0]?.transcript || '';
      if (result.isFinal) {
        state.recorder.transcript = [state.recorder.transcript, phrase.trim()].filter(Boolean).join(' ');
      } else {
        interim = [interim, phrase.trim()].filter(Boolean).join(' ');
      }
    }
    state.recorder.interim = interim;
    logVcRecorder(interim ? 'live words coming in' : 'captured phrase');
  };
  recognition.onerror = (event) => {
    const error = event.error || 'unknown error';
    setStatus('Recording activity: ' + error);
    logVcRecorder('event: ' + error);
  };
  recognition.onend = () => {
    if (!state.recorder) return;
    if (state.recorder.stopped) return;
    logVcRecorder('browser paused recognition; restarting');
    state.recorder.restartTimer = window.setTimeout(() => {
      try {
        state.recorder?.recognition.start();
        logVcRecorder('listening resumed');
      } catch (error) {
        setStatus('Recording restart failed: ' + error.message);
      }
    }, 250);
  };
  try {
    recognition.start();
  } catch (error) {
    setStatus('Recording failed: ' + error.message);
  }
}

function stopVcRecording({ capture }) {
  const recorder = state.recorder;
  if (!recorder) return;
  recorder.stopped = true;
  if (recorder.restartTimer) window.clearTimeout(recorder.restartTimer);
  if (recorder.uiTimer) window.clearInterval(recorder.uiTimer);
  const transcript = liveRecorderText().trim();
  try {
    recorder.recognition.stop();
  } catch {}
  if (capture && transcript) appendVcCapture(recorder.targets, transcript);
  else if (capture) setStatus('No recording transcript captured.');
  else setStatus('Recording cancelled.');
  state.recorder = null;
  if (!$('vcPanel').hidden) renderVcPanel();
}

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
$('vcsToggle').addEventListener('click', toggleVcPanel);
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
  if (event.altKey && event.key.toLowerCase() === 'i') {
    event.preventDefault();
    toggleVcPanel();
    return;
  }
  if (event.key === 'Escape') {
    for (const [id] of state.selects) closeSelect(id);
    if (!$('vcPanel').hidden) $('vcPanel').hidden = true;
  }
});

loadBootstrap().catch((error) => setStatus(error.message));
</script>
</body>
</html>`;
}

module.exports = { renderIssuesHtml };
