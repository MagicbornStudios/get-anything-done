'use strict';
/**
 * Phase 145 follow-up — content-type derivation unit tests.
 * Run: node --test vendor/get-anything-done/tests/telemetry-content-type.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  VALID_CONTENT_TYPES,
  deriveContentType,
  inferFromPath,
  extractPathsFromContent,
  normalisePath,
} = require('../lib/telemetry/content-type.cjs');

// ---------------------------------------------------------------------------
// VALID_CONTENT_TYPES sanity
// ---------------------------------------------------------------------------

test('VALID_CONTENT_TYPES has exactly the 6 expected types', () => {
  assert.equal(VALID_CONTENT_TYPES.size, 6);
  for (const t of ['planning', 'code', 'site', 'eval', 'narrative', 'meta']) {
    assert.ok(VALID_CONTENT_TYPES.has(t), `missing ${t}`);
  }
});

// ---------------------------------------------------------------------------
// inferFromPath — 30 hand-crafted cases across all 6 types
// ---------------------------------------------------------------------------

const PATH_CASES = [
  // planning (5)
  ['.planning/STATE.xml', 'planning'],
  ['C:\\Users\\b\\repo\\.planning\\ROADMAP.xml', 'planning'],
  ['/repo/.planning/phases/145/PLAN.md', 'planning'],
  ['.planning/decisions/gad-285.toml', 'planning'],
  ['.planning/handoffs/open/h-2026-05-06T08-00-00-global-145.md', 'planning'],

  // code (5)
  ['lib/telemetry/envelope.cjs', 'code'],
  ['src/components/Button.tsx', 'code'],
  ['scripts/build.mjs', 'code'],
  ['rust/src/lib.rs', 'code'],
  ['cmd/main.go', 'code'],

  // site (5)
  ['sites/operator-portfolio/app/page.tsx', 'site'],
  ['sites/7greens/app/(marketing)/page.tsx', 'site'],
  ['apps/platform/site/index.tsx', 'site'],
  ['app/(marketing)/pricing/page.tsx', 'site'],
  ['sites/grime-time/components/Hero.tsx', 'site'],

  // eval (5)
  ['evals/skills/find-skills/v1/output.json', 'eval'],
  ['species/dungeon-crawler/recipe.json', 'eval'],
  ['generations/v3/manifest.json', 'eval'],
  ['bestiary/agents/agent-01.json', 'eval'],
  ['repo/eval/run-2026-05-01.json', 'eval'],

  // narrative (5)
  ['narrative/uruk/chapter-01.md', 'narrative'],
  ['souls/gilgamesh.md', 'narrative'],
  ['books/foundations.md', 'narrative'],
  ['docs/lore/origin.story.md', 'narrative'],
  ['SOUL.md', 'narrative'],

  // unmatched -> null (5)
  ['random.txt', null],
  ['README', null],
  ['docs/index.html', null],
  ['somefile.docx', null],
  ['', null],
];

test('inferFromPath classifies 30 cases correctly', () => {
  assert.equal(PATH_CASES.length, 30);
  for (const [p, expected] of PATH_CASES) {
    const got = inferFromPath(p);
    assert.equal(got, expected, `${p} -> expected ${expected}, got ${got}`);
  }
});

// ---------------------------------------------------------------------------
// normalisePath
// ---------------------------------------------------------------------------

test('normalisePath converts backslashes and lowercases', () => {
  assert.equal(normalisePath('C:\\Repo\\.Planning\\State.XML'), 'c:/repo/.planning/state.xml');
  assert.equal(normalisePath(null), '');
  assert.equal(normalisePath(123), '');
});

// ---------------------------------------------------------------------------
// extractPathsFromContent
// ---------------------------------------------------------------------------

test('extractPathsFromContent reads tool_call inputs.file_path', () => {
  const paths = extractPathsFromContent({
    inputs: { file_path: 'lib/foo.ts' },
    tool: 'Edit',
  });
  assert.deepEqual(paths, ['lib/foo.ts']);
});

test('extractPathsFromContent reads array inputs', () => {
  const paths = extractPathsFromContent({
    inputs: { paths: ['a.ts', 'b.ts'], files: ['c.ts'] },
  });
  assert.deepEqual(paths, ['a.ts', 'b.ts', 'c.ts']);
});

test('extractPathsFromContent reads source_file and prompt_file', () => {
  const paths = extractPathsFromContent({
    source_file: '1234.prompt.md',
    prompt_file: '/full/path/x.prompt.md',
  });
  assert.deepEqual(paths, ['1234.prompt.md', '/full/path/x.prompt.md']);
});

test('extractPathsFromContent reads worker-log meta ref', () => {
  const paths = extractPathsFromContent({ kind: 'work-start', ref: 'h-2026-05-06-global-145.md' });
  assert.deepEqual(paths, ['h-2026-05-06-global-145.md']);
});

test('extractPathsFromContent extracts path-like args from gad-log', () => {
  const paths = extractPathsFromContent({ args: ['snapshot', '--projectid', 'global', 'sites/foo/page.tsx'] });
  assert.deepEqual(paths, ['sites/foo/page.tsx']);
});

test('extractPathsFromContent returns [] for empty/malformed content', () => {
  assert.deepEqual(extractPathsFromContent(null), []);
  assert.deepEqual(extractPathsFromContent({}), []);
  assert.deepEqual(extractPathsFromContent('not an object'), []);
});

// ---------------------------------------------------------------------------
// deriveContentType — full envelope path
// ---------------------------------------------------------------------------

test('deriveContentType passes through pre-set value', () => {
  const env = { content: { inputs: { file_path: 'lib/foo.ts' } }, content_type: 'narrative' };
  assert.equal(deriveContentType(env), 'narrative');
});

test('deriveContentType ignores invalid pre-set value, falls back to inference', () => {
  const env = { content: { inputs: { file_path: 'lib/foo.ts' } }, content_type: 'bogus' };
  assert.equal(deriveContentType(env), 'code');
});

test('deriveContentType returns code for tool_call on .ts file', () => {
  const env = { content: { tool: 'Edit', inputs: { file_path: 'lib/telemetry/envelope.cjs' } } };
  assert.equal(deriveContentType(env), 'code');
});

test('deriveContentType returns planning for .planning/*.md', () => {
  const env = { content: { tool: 'Read', inputs: { file_path: '.planning/STATE.xml' } } };
  assert.equal(deriveContentType(env), 'planning');
});

test('deriveContentType returns site for sites/*/*.tsx', () => {
  const env = { content: { tool: 'Edit', inputs: { file_path: 'sites/operator-portfolio/app/page.tsx' } } };
  assert.equal(deriveContentType(env), 'site');
});

test('deriveContentType returns eval for evals/*/output.json', () => {
  const env = { content: { tool: 'Read', inputs: { file_path: 'evals/find-skills/v1/output.json' } } };
  assert.equal(deriveContentType(env), 'eval');
});

test('deriveContentType returns narrative for souls/*.md', () => {
  const env = { content: { tool: 'Read', inputs: { file_path: 'souls/gilgamesh.md' } } };
  assert.equal(deriveContentType(env), 'narrative');
});

test('deriveContentType falls back to meta for unmatched content', () => {
  const env = { content: { kind: 'work-complete' } };
  assert.equal(deriveContentType(env), 'meta');
});

test('deriveContentType handles null/undefined env gracefully', () => {
  assert.equal(deriveContentType(null), 'meta');
  assert.equal(deriveContentType(undefined), 'meta');
  assert.equal(deriveContentType({}), 'meta');
});

test('deriveContentType: site rule beats code rule for tsx under sites/', () => {
  // sites/foo/app/page.tsx matches both site and code patterns; site
  // must win because it appears earlier in PATH_RULES.
  const env = { content: { inputs: { file_path: 'sites/grime-time/app/page.tsx' } } };
  assert.equal(deriveContentType(env), 'site');
});

test('deriveContentType: narrative rule beats planning for souls in .planning/', () => {
  // narrative comes first in PATH_RULES so souls/foo.md wins narrative
  // even when path also lives under .planning/.
  const env = { content: { inputs: { file_path: '.planning/souls/gilgamesh.md' } } };
  assert.equal(deriveContentType(env), 'narrative');
});

test('deriveContentType uses worker-log handoff ref', () => {
  const env = { content: { kind: 'work-start', ref: 'h-2026-05-06T08-00-00-global-145.md' } };
  // ref doesn't carry .planning/ prefix; rule for handoff_id requires
  // /handoffs?/ in the path, so this falls through to meta — caller
  // (worker-log adapter) overrides to 'planning' when handoff_id set.
  assert.equal(deriveContentType(env), 'meta');
});
