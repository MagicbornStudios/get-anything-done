'use strict';

const { afterEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  TIER_MATRIX,
  readCodexModelCatalog,
  listVisibleModelSlugs,
  selectTierModels,
  selectTier,
  applyCodexModelRouting,
  decodeTextFile,
  __resetCodexModelCatalogCacheForTests,
} = require('../lib/team/codex-model-routing.cjs');

afterEach(() => {
  __resetCodexModelCatalogCacheForTests();
});

function stubSpawnSync(stdout, status = 0) {
  let calls = 0;
  const fn = () => {
    calls += 1;
    return {
      status,
      stdout,
      stderr: '',
      error: null,
    };
  };
  fn.calls = () => calls;
  return fn;
}

describe('codex model routing', () => {
  test('matrix covers the documented quick|standard|deep x prescribed|bounded|design shapes', () => {
    assert.equal(TIER_MATRIX['quick:prescribed'], 'fast');
    assert.equal(TIER_MATRIX['standard:bounded'], 'fast');
    assert.equal(TIER_MATRIX['deep:design'], 'strong');
  });

  test('reads model catalog from codex debug models and caches it', () => {
    const spawnSyncImpl = stubSpawnSync(JSON.stringify({
      models: [
        { slug: 'gpt-5.5', visibility: 'list' },
        { slug: 'gpt-5.4', visibility: 'list' },
      ],
    }));

    const first = readCodexModelCatalog({ spawnSyncImpl, now: 1000 });
    const second = readCodexModelCatalog({ spawnSyncImpl, now: 2000 });

    assert.deepEqual(listVisibleModelSlugs(first), ['gpt-5.5', 'gpt-5.4']);
    assert.deepEqual(listVisibleModelSlugs(second), ['gpt-5.5', 'gpt-5.4']);
    assert.equal(spawnSyncImpl.calls(), 1);
  });

  test('prefers the checked-in team catalog file when present', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-codex-catalog-'));
    try {
      const catalogPath = path.join(tmpDir, '.planning', 'team', 'codex-model-catalog.json');
      fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
      fs.writeFileSync(catalogPath, JSON.stringify({
        models: [
          { slug: 'gpt-5.5', visibility: 'list' },
          { slug: 'gpt-5.4', visibility: 'list' },
        ],
      }), 'utf8');

      const spawnSyncImpl = stubSpawnSync(JSON.stringify({
        models: [{ slug: 'gpt-5.4-mini', visibility: 'list' }],
      }));

      const catalog = readCodexModelCatalog({ baseDir: tmpDir, spawnSyncImpl, bypassCache: true });
      assert.deepEqual(listVisibleModelSlugs(catalog), ['gpt-5.5', 'gpt-5.4']);
      assert.equal(spawnSyncImpl.calls(), 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('decodes UTF-16LE catalog snapshots produced by Windows redirection', () => {
    const text = '{"models":[{"slug":"gpt-5.5","visibility":"list"}]}';
    const utf16le = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(text, 'utf16le'),
    ]);
    assert.equal(decodeTextFile(utf16le), text);
  });

  test('selects fast and strong tiers from the available codex catalog', () => {
    const tiers = selectTierModels(['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini']);
    assert.equal(tiers.fastModel, 'gpt-5.4-mini');
    assert.equal(tiers.strongModel, 'gpt-5.5');
  });

  test('quick prescribed routes to fast tier', () => {
    const routed = selectTier({
      time: 'quick',
      estimated_context: 'prescribed',
    });
    assert.equal(routed.tier, 'fast');
    assert.equal(routed.routeKey, 'quick:prescribed');
  });

  test('deep design routes to strong tier', () => {
    const routed = selectTier({
      time: 'deep',
      estimated_context: 'design',
    });
    assert.equal(routed.tier, 'strong');
    assert.equal(routed.routeKey, 'deep:design');
  });

  test('applies routed codex model flag to runtime command', () => {
    const spawnSyncImpl = stubSpawnSync(JSON.stringify({
      models: [
        { slug: 'gpt-5.5', visibility: 'list' },
        { slug: 'gpt-5.4', visibility: 'list' },
        { slug: 'gpt-5.4-mini', visibility: 'list' },
      ],
    }));

    const quick = applyCodexModelRouting('codex exec', {
      time: 'quick',
      estimated_context: 'prescribed',
    }, { spawnSyncImpl, bypassCache: true });
    assert.equal(quick.runtimeCmd, 'codex exec --model gpt-5.4-mini');
    assert.equal(quick.routing.tier, 'fast');

    const deep = applyCodexModelRouting('codex exec', {
      time: 'deep',
      estimated_context: 'design',
    }, { spawnSyncImpl, bypassCache: true });
    assert.equal(deep.runtimeCmd, 'codex exec --model gpt-5.5');
    assert.equal(deep.routing.tier, 'strong');
  });

  test('does not overwrite an explicit model already present in runtime_cmd', () => {
    const routed = applyCodexModelRouting('codex exec --model gpt-5.4', {
      time: 'deep',
      estimated_context: 'design',
    });
    assert.equal(routed.runtimeCmd, 'codex exec --model gpt-5.4');
    assert.equal(routed.routing.source, 'runtime-cmd-explicit-model');
  });
});
