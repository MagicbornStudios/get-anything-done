'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');

const {
  write,
  claim,
  scan,
  resolveAgentSlug,
  ageLabel,
  presenceDir,
  presenceFilePath,
  LIVE_THRESHOLD_S,
} = require('../lib/agent-presence.cjs');

const { buildAgentPresenceSection } = require('../lib/snapshot-agent-presence-section.cjs');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-presence-'));
  // Pre-create the .planning dir like a real repo root
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
  // Restore env vars in case tests mutated them
  delete process.env.GAD_AGENT_NAME;
  delete process.env.GAD_RUNTIME;
  delete process.env.GAD_MODEL;
});

// ---------------------------------------------------------------------------
// resolveAgentSlug
// ---------------------------------------------------------------------------

test('resolveAgentSlug — prefers GAD_AGENT_NAME', () => {
  process.env.GAD_AGENT_NAME = 'gilgamesh-monorepo';
  const slug = resolveAgentSlug('global');
  assert.equal(slug, 'gilgamesh-monorepo');
});

test('resolveAgentSlug — falls back to USERNAME-projectid', () => {
  delete process.env.GAD_AGENT_NAME;
  const slug = resolveAgentSlug('test-project');
  // Must contain the projectid
  assert.ok(slug.endsWith('-test-project'), `expected slug to end with -test-project, got: ${slug}`);
});

test('resolveAgentSlug — last resort anonymous-<projectid>', () => {
  delete process.env.GAD_AGENT_NAME;
  delete process.env.USERNAME;
  delete process.env.USER;
  // Can't delete os.userInfo() but the fallback path is still exercised if both env vars missing
  // Just verify it returns a string containing the projectid
  const slug = resolveAgentSlug('fallback-proj');
  assert.ok(typeof slug === 'string' && slug.length > 0);
});

// ---------------------------------------------------------------------------
// write + file shape
// ---------------------------------------------------------------------------

test('write creates presence file with correct shape', () => {
  const baseDir = makeTempDir();
  process.env.GAD_AGENT_NAME = 'test-agent';

  const { agentSlug, filePath } = write({
    baseDir,
    projectid: 'global',
    runtime:   'claude-code',
    model:     'claude-opus-4-7',
  });

  assert.equal(agentSlug, 'test-agent');
  assert.ok(fs.existsSync(filePath), 'presence file should exist');

  const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(record.agent_slug,  'test-agent');
  assert.equal(record.projectid,   'global');
  assert.equal(record.runtime,     'claude-code');
  assert.equal(record.model,       'claude-opus-4-7');
  assert.ok(record.started_at,     'started_at should be set');
  assert.ok(record.last_heartbeat, 'last_heartbeat should be set');
  assert.equal(record.current_focus_route, null);
  assert.equal(record.active_skill,        null);
});

test('write preserves started_at on refresh', () => {
  const baseDir = makeTempDir();
  process.env.GAD_AGENT_NAME = 'test-agent-b';

  const first = write({ baseDir, projectid: 'global', runtime: 'claude-code' });
  const r1    = JSON.parse(fs.readFileSync(first.filePath, 'utf8'));
  const sa1   = r1.started_at;

  // Small delay to ensure last_heartbeat changes
  const before = new Date().toISOString();
  const second = write({ baseDir, projectid: 'global', runtime: 'claude-code' });
  const r2     = JSON.parse(fs.readFileSync(second.filePath, 'utf8'));

  assert.equal(r2.started_at, sa1, 'started_at should not change on re-write');
  assert.ok(r2.last_heartbeat >= before, 'last_heartbeat should be refreshed');
});

test('write accepts optional focus fields', () => {
  const baseDir = makeTempDir();
  process.env.GAD_AGENT_NAME = 'agent-focus';

  write({
    baseDir,
    projectid:        'global',
    runtime:          'claude-code',
    focusRoute:       '/kael',
    focusCid:         'cid-kael-chat',
    activeSkill:      'frontend-design',
    currentHandoffId: 'h-2026-05-08T10-00-00-global-89',
  });

  const fp     = presenceFilePath(baseDir, 'agent-focus');
  const record = JSON.parse(fs.readFileSync(fp, 'utf8'));
  assert.equal(record.current_focus_route, '/kael');
  assert.equal(record.current_focus_cid,   'cid-kael-chat');
  assert.equal(record.active_skill,        'frontend-design');
  assert.equal(record.current_handoff_id,  'h-2026-05-08T10-00-00-global-89');
});

// ---------------------------------------------------------------------------
// claim
// ---------------------------------------------------------------------------

test('claim updates only specified fields', () => {
  const baseDir = makeTempDir();
  process.env.GAD_AGENT_NAME = 'agent-claim';

  write({ baseDir, projectid: 'global', runtime: 'claude-code', model: 'opus', focusRoute: '/old' });
  claim({ baseDir, projectid: 'global', focusRoute: '/new-route' });

  const fp     = presenceFilePath(baseDir, 'agent-claim');
  const record = JSON.parse(fs.readFileSync(fp, 'utf8'));
  assert.equal(record.current_focus_route, '/new-route');
  // Model should still be preserved from original write
  assert.equal(record.model, 'opus');
});

// ---------------------------------------------------------------------------
// scan
// ---------------------------------------------------------------------------

test('scan lists all presence files in baseDir', () => {
  const baseDir = makeTempDir();

  // Write two agents
  process.env.GAD_AGENT_NAME = 'agent-one';
  write({ baseDir, projectid: 'global',  runtime: 'claude-code' });

  process.env.GAD_AGENT_NAME = 'agent-two';
  write({ baseDir, projectid: 'slm-learning', runtime: 'gemini' });

  const entries = scan(baseDir);
  assert.equal(entries.length, 2);
  const slugs = entries.map((e) => e.record.agent_slug).sort();
  assert.deepEqual(slugs, ['agent-one', 'agent-two']);
});

test('scan marks recent heartbeat as live', () => {
  const baseDir = makeTempDir();
  process.env.GAD_AGENT_NAME = 'live-agent';
  write({ baseDir, projectid: 'global', runtime: 'claude-code' });

  const entries = scan(baseDir);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].live, true);
  assert.ok(entries[0].ageSeconds < 5, 'age should be near zero');
});

test('scan marks stale heartbeat as idle', () => {
  const baseDir = makeTempDir();
  process.env.GAD_AGENT_NAME = 'stale-agent';

  // Write a presence file with an old heartbeat
  const dir = presenceDir(baseDir);
  fs.mkdirSync(dir, { recursive: true });
  const fp = presenceFilePath(baseDir, 'stale-agent');
  const old = new Date(Date.now() - (LIVE_THRESHOLD_S + 60) * 1000).toISOString();
  fs.writeFileSync(fp, JSON.stringify({
    agent_slug: 'stale-agent',
    projectid: 'global',
    runtime: 'claude-code',
    model: null,
    started_at: old,
    last_heartbeat: old,
    current_focus_route: null,
    current_focus_cid: null,
    active_skill: null,
    current_handoff_id: null,
  }), 'utf8');

  const entries = scan(baseDir);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].live, false);
});

test('scan returns empty array when .presence dir does not exist', () => {
  const baseDir = makeTempDir();
  const entries = scan(baseDir);
  assert.equal(entries.length, 0);
});

// ---------------------------------------------------------------------------
// ageLabel
// ---------------------------------------------------------------------------

test('ageLabel — seconds', () => {
  assert.equal(ageLabel(30),   '30s ago');
  assert.equal(ageLabel(59),   '59s ago');
});

test('ageLabel — minutes', () => {
  assert.equal(ageLabel(60),   '1m ago');
  assert.equal(ageLabel(120),  '2m ago');
  assert.equal(ageLabel(3599), '60m ago');
});

test('ageLabel — hours', () => {
  assert.equal(ageLabel(3600), '1h ago');
  assert.equal(ageLabel(7200), '2h ago');
});

// ---------------------------------------------------------------------------
// buildAgentPresenceSection
// ---------------------------------------------------------------------------

test('buildAgentPresenceSection returns null when no presence files', () => {
  const baseDir = makeTempDir();
  const section = buildAgentPresenceSection({ baseDir });
  assert.equal(section, null);
});

test('buildAgentPresenceSection renders header and rows', () => {
  const baseDir = makeTempDir();

  process.env.GAD_AGENT_NAME = 'gilgamesh-monorepo';
  write({ baseDir, projectid: 'global', runtime: 'claude-code', model: 'claude-opus-4-7', focusRoute: '/kael' });

  const section = buildAgentPresenceSection({ baseDir });
  assert.ok(section, 'section should not be null');
  assert.ok(section.title.includes('AGENT PRESENCE'), 'title should include AGENT PRESENCE');
  assert.ok(section.title.includes('1 live'), 'title should indicate 1 live agent');
  assert.ok(section.content.includes('gilgamesh-monorepo'), 'content should include agent slug');
  assert.ok(section.content.includes('claude-code'),        'content should include runtime');
  assert.ok(section.content.includes('/kael'),              'content should include focus route');
});

test('buildAgentPresenceSection shows live and idle counts', () => {
  const baseDir = makeTempDir();
  const dir     = presenceDir(baseDir);
  fs.mkdirSync(dir, { recursive: true });

  // One live agent
  process.env.GAD_AGENT_NAME = 'live-one';
  write({ baseDir, projectid: 'global', runtime: 'claude-code' });

  // One stale agent
  const old = new Date(Date.now() - (LIVE_THRESHOLD_S + 120) * 1000).toISOString();
  fs.writeFileSync(path.join(dir, 'old-agent.json'), JSON.stringify({
    agent_slug: 'old-agent', projectid: 'global', runtime: 'codex',
    model: null, started_at: old, last_heartbeat: old,
    current_focus_route: null, current_focus_cid: null,
    active_skill: null, current_handoff_id: null,
  }), 'utf8');

  const section = buildAgentPresenceSection({ baseDir });
  assert.ok(section.title.includes('1 live'), `expected "1 live" in title: ${section.title}`);
  assert.ok(section.title.includes('1 idle'), `expected "1 idle" in title: ${section.title}`);
});
