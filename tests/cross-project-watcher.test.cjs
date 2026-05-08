'use strict';
/**
 * cross-project-watcher.test.cjs — unit tests for lib/cross-project-watcher.cjs.
 *
 * Pure: injectable fsImpl fake, no real disk access, no daemon spawned,
 * no Tauri invoke called.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const {
  tickOnce,
  seenSetPath,
  parseFrontmatter,
  firstBodyLine,
  resolvePlanningRoots,
  loadOpenHandoffs,
} = require('../lib/cross-project-watcher.cjs');

// ---------------------------------------------------------------------------
// In-memory fs fake
// ---------------------------------------------------------------------------

function makeFsFake(files = {}) {
  const store = Object.assign({}, files);
  return {
    store,
    existsSync(p) {
      if (store[p] !== undefined) return true;
      const prefix = p.endsWith(path.sep) ? p : p + path.sep;
      return Object.keys(store).some((k) => k === p || k.startsWith(prefix));
    },
    readdirSync(dir) {
      const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
      const names = [];
      for (const k of Object.keys(store)) {
        if (k.startsWith(prefix)) {
          const rest = k.slice(prefix.length);
          if (!rest.includes(path.sep) && rest.length > 0) names.push(rest);
        }
      }
      return names;
    },
    readFileSync(p) { return store[p] || ''; },
    writeFileSync(p, d) { store[p] = d; },
    mkdirSync() {},
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHandoffContent(id, recipient, bodyText) {
  return [
    '---',
    `id: ${id}`,
    `projectid: slm-learning`,
    `phase: 35`,
    `created_at: 2026-05-08T10:00:00.000Z`,
    `created_by: dr-stein`,
    `recipient: ${recipient}`,
    `claimed_by: null`,
    `claimed_at: null`,
    `completed_at: null`,
    `priority: normal`,
    `estimated_context: bounded`,
    `risk: safe`,
    `time: standard`,
    `surface: local`,
    '---',
    bodyText || '# Test handoff\nThis is a test body line.',
  ].join('\n');
}

function makePresenceContent(agentSlug, projectid, ageMs = 0) {
  const hb = new Date(Date.now() - ageMs).toISOString();
  return JSON.stringify({
    agent_slug: agentSlug,
    projectid,
    runtime: 'claude-code',
    model: null,
    started_at: hb,
    last_heartbeat: hb,
    current_focus_route: null,
    current_focus_cid: null,
    active_skill: null,
    current_handoff_id: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseFrontmatter', () => {
  test('parses basic frontmatter + body', () => {
    const text = '---\nid: h-123\nprojectid: global\n---\n# Title\nbody here';
    const { frontmatter, body } = parseFrontmatter(text);
    assert.strictEqual(frontmatter.id, 'h-123');
    assert.strictEqual(frontmatter.projectid, 'global');
    assert.ok(body.includes('body here'));
  });

  test('returns empty frontmatter when no delimiters', () => {
    const { frontmatter, body } = parseFrontmatter('just body text');
    assert.deepStrictEqual(frontmatter, {});
    assert.strictEqual(body, 'just body text');
  });
});

describe('firstBodyLine', () => {
  test('extracts first non-empty line, stripping # markers', () => {
    // # Title → strips the # prefix, returns 'Title' (first line wins)
    assert.strictEqual(firstBodyLine('# Title\nActual body'), 'Title');
    assert.strictEqual(firstBodyLine('\n\nFirst line'), 'First line');
    assert.strictEqual(firstBodyLine(''), '');
  });

  test('strips markdown heading markers', () => {
    assert.strictEqual(firstBodyLine('## Section heading'), 'Section heading');
  });
});

describe('resolvePlanningRoots', () => {
  test('always includes self root', () => {
    const roots = resolvePlanningRoots('/repo', null);
    assert.ok(roots.some((r) => r.absPath === '/repo'));
  });

  test('includes config roots', () => {
    const config = { roots: [{ id: 'slm-learning', path: '../slm_learning' }] };
    const roots = resolvePlanningRoots('/repo', config);
    assert.strictEqual(roots.length, 2);
    assert.ok(roots[1].id === 'slm-learning');
  });

  test('deduplicates self root', () => {
    const config = { roots: [{ id: 'self-dup', path: '.' }] };
    const roots = resolvePlanningRoots('/repo', config);
    // '.' resolves to /repo which is already in the list
    assert.strictEqual(roots.filter((r) => r.absPath === '/repo').length, 1);
  });
});

describe('loadOpenHandoffs', () => {
  test('returns empty array when open/ dir missing', () => {
    const fsi = makeFsFake({});
    const result = loadOpenHandoffs('/repo', 'global', fsi);
    assert.deepStrictEqual(result, []);
  });

  test('parses handoff files from open/', () => {
    const id = 'h-2026-05-08T10-00-00-slm-learning-35';
    const openDir = path.join('/repo', '.planning', 'handoffs', 'open');
    const fsi = makeFsFake({
      [path.join(openDir, `${id}.md`)]: makeHandoffContent(id, 'gilgamesh-monorepo', '# Cross project\nSome work needed.'),
    });
    const result = loadOpenHandoffs('/repo', 'slm-learning', fsi);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, id);
    assert.strictEqual(result[0].recipient, 'gilgamesh-monorepo');
    assert.strictEqual(result[0].body_first, 'Cross project');
  });
});

describe('tickOnce — matchAll mode', () => {
  test('returns all open handoffs on first tick', () => {
    const BASE = '/monorepo';
    const id = 'h-2026-05-08T10-00-00-slm-learning-35';
    const openDir = path.join(BASE, '.planning', 'handoffs', 'open');
    const seenFile = path.join(BASE, '.planning', '.cross-project-seen.json');
    const fsi = makeFsFake({
      [path.join(openDir, `${id}.md`)]: makeHandoffContent(id, 'gilgamesh-monorepo', 'Do something'),
    });

    const { newHandoffs } = tickOnce({ baseDir: BASE, config: null, fsImpl: fsi, matchAll: true });
    assert.strictEqual(newHandoffs.length, 1);
    assert.strictEqual(newHandoffs[0].id, id);

    // Verify seen-set was written
    const seen = JSON.parse(fsi.store[seenFile]);
    assert.ok(seen[id]);
  });

  test('does not re-emit already-seen handoffs', () => {
    const BASE = '/monorepo';
    const id = 'h-2026-05-08T10-00-00-slm-learning-35';
    const openDir = path.join(BASE, '.planning', 'handoffs', 'open');
    const seenFile = path.join(BASE, '.planning', '.cross-project-seen.json');
    const fsi = makeFsFake({
      [path.join(openDir, `${id}.md`)]: makeHandoffContent(id, 'gilgamesh-monorepo', 'Do something'),
      [seenFile]: JSON.stringify({ [id]: '2026-05-08T10:01:00.000Z' }),
    });

    const { newHandoffs } = tickOnce({ baseDir: BASE, config: null, fsImpl: fsi, matchAll: true });
    assert.strictEqual(newHandoffs.length, 0);
  });
});

describe('tickOnce — presence-filtered mode', () => {
  test('emits handoff when recipient matches live agent', () => {
    const BASE = '/monorepo';
    const id = 'h-2026-05-08T11-00-00-slm-learning-35';
    const openDir = path.join(BASE, '.planning', 'handoffs', 'open');
    const presDir = path.join(BASE, '.planning', '.presence');
    const fsi = makeFsFake({
      [path.join(openDir, `${id}.md`)]: makeHandoffContent(id, 'gilgamesh-monorepo', 'Urgent cross-project task'),
      [path.join(presDir, 'gilgamesh-monorepo.json')]: makePresenceContent('gilgamesh-monorepo', 'global', 60_000),
    });

    const { newHandoffs } = tickOnce({ baseDir: BASE, config: null, fsImpl: fsi, matchAll: false });
    assert.strictEqual(newHandoffs.length, 1);
    assert.strictEqual(newHandoffs[0].body_first, 'Urgent cross-project task');
  });

  test('does NOT emit when recipient agent is stale (> 5 min heartbeat)', () => {
    const BASE = '/monorepo';
    const id = 'h-2026-05-08T11-00-00-slm-learning-35';
    const openDir = path.join(BASE, '.planning', 'handoffs', 'open');
    const presDir = path.join(BASE, '.planning', '.presence');
    const fsi = makeFsFake({
      [path.join(openDir, `${id}.md`)]: makeHandoffContent(id, 'gilgamesh-monorepo', 'Stale test'),
      [path.join(presDir, 'gilgamesh-monorepo.json')]: makePresenceContent('gilgamesh-monorepo', 'global', 6 * 60 * 1000),
    });

    const { newHandoffs } = tickOnce({ baseDir: BASE, config: null, fsImpl: fsi, matchAll: false });
    assert.strictEqual(newHandoffs.length, 0);
  });

  test('does NOT emit when handoff has no recipient', () => {
    const BASE = '/monorepo';
    const id = 'h-2026-05-08T11-30-00-slm-learning-35';
    const openDir = path.join(BASE, '.planning', 'handoffs', 'open');
    const presDir = path.join(BASE, '.planning', '.presence');
    const fsi = makeFsFake({
      [path.join(openDir, `${id}.md`)]: makeHandoffContent(id, '', 'No recipient set'),
      [path.join(presDir, 'gilgamesh-monorepo.json')]: makePresenceContent('gilgamesh-monorepo', 'global', 1000),
    });

    const { newHandoffs } = tickOnce({ baseDir: BASE, config: null, fsImpl: fsi, matchAll: false });
    assert.strictEqual(newHandoffs.length, 0);
  });
});

describe('system singleton spec', () => {
  test('cross-project-watcher entry exists in buildSingletons', () => {
    const systemCmd = require('../bin/commands/system.cjs');
    // Access buildSingletons via module internals — use the register hook
    // to verify the singleton list contains our entry without spawning.
    // We do this by re-reading the source file for the id string.
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'bin', 'commands', 'system.cjs'),
      'utf8'
    );
    assert.ok(src.includes("id: 'cross-project-watcher'"), 'singleton id missing');
    assert.ok(src.includes("'cross-project', 'watch', '--daemon'"), 'spawn args missing');
    assert.ok(src.includes('phase: 323'), 'phase 323 marker missing');
  });
});
