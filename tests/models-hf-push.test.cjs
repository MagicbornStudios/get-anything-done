'use strict';
/**
 * tests/models-hf-push.test.cjs — unit tests for lib/retraining/archiver.cjs
 *
 * Run: node --test tests/models-hf-push.test.cjs
 *
 * Covers:
 *   - HF push: correct repo / file / token / commit-msg passed to huggingface-cli
 *   - Dry-run: nothing destructive (no fs writes, no CLI invocation)
 *   - Missing HF token: NO_TOKEN error
 *   - Missing model in registry: NO_MODEL error
 *   - Missing artifact: NO_ARTIFACT error
 *   - Missing CLI: CLI_MISSING bubbled
 *   - No repo configured + no override: falls through to local archive
 *   - Commit-sha parsed from stdout
 *
 * Mocking pattern follows tests/bench-gate.test.cjs — tmp dir per test,
 * seed the registry directly. CLI subprocess is mocked via the
 * `_runHfCli` seam exported from archiver.cjs.
 */

const { describe, it, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const registry = require('../lib/models/registry.cjs');
const archiver = require('../lib/retraining/archiver.cjs');

let tmpDir;
let savedEnv;

function makeRoot() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-test-archiver-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'models'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'models', 'registry.json'),
    JSON.stringify({ models: [] }, null, 2),
  );
  return tmpDir;
}

function cleanRoot() {
  if (tmpDir && fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
}

function seed(id, patch) {
  return registry.upsertModel(tmpDir, id, patch);
}

function seedArtifact(relPath, content = 'fake-weights') {
  const abs = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

function snapshotEnv() {
  savedEnv = {
    HF_TOKEN: process.env.HF_TOKEN,
    HF_TOKEN_ALT: process.env.HF_TOKEN_ALT,
    GAD_HF_ARCHIVE_REPO: process.env.GAD_HF_ARCHIVE_REPO,
  };
}

function restoreEnv() {
  for (const [k, v] of Object.entries(savedEnv || {})) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

// ─── _parseCommitSha (pure) ──────────────────────────────────────────────────

describe('_parseCommitSha', () => {
  it('parses /commit/<sha> URL form', () => {
    const sha = archiver._parseCommitSha(
      'https://huggingface.co/owner/repo/commit/abcdef1234567890'
    );
    assert.equal(sha, 'abcdef1234567890');
  });

  it('parses "Commit sha: <hex>" form', () => {
    const sha = archiver._parseCommitSha('Upload complete\nCommit sha: deadbeefcafe1234\n');
    assert.equal(sha, 'deadbeefcafe1234');
  });

  it('returns null when no sha present', () => {
    assert.equal(archiver._parseCommitSha('all good no commit info here'), null);
    assert.equal(archiver._parseCommitSha(''), null);
    assert.equal(archiver._parseCommitSha(null), null);
  });
});

// ─── HF push path ────────────────────────────────────────────────────────────

describe('archiveModel — HF push', () => {
  beforeEach(() => {
    makeRoot();
    snapshotEnv();
    process.env.HF_TOKEN = 'fake-token-xyz';
    delete process.env.GAD_HF_ARCHIVE_REPO;
  });
  afterEach(() => { restoreEnv(); cleanRoot(); });

  it('errors NO_MODEL when model not in registry', () => {
    assert.throws(
      () => archiver.archiveModel(tmpDir, 'nonexistent', { repo: 'org/repo' }),
      (err) => err.code === 'NO_MODEL'
    );
  });

  it('errors NO_TOKEN when HF token env is missing', () => {
    delete process.env.HF_TOKEN;
    seed('kael-v1', { kind: 'llm', status: 'staging', artifact_path: '.planning/models/artifacts/kael-v1' });
    seedArtifact('.planning/models/artifacts/kael-v1/weights.bin');

    assert.throws(
      () => archiver.archiveModel(tmpDir, 'kael-v1', { repo: 'org/repo' }),
      (err) => err.code === 'NO_TOKEN' && err.tokenEnv === 'HF_TOKEN'
    );
  });

  it('respects --token-env override for token lookup', () => {
    delete process.env.HF_TOKEN;
    process.env.HF_TOKEN_ALT = 'alt-token';
    seed('kael-v1', { kind: 'llm', status: 'staging', artifact_path: '.planning/models/artifacts/kael-v1' });
    seedArtifact('.planning/models/artifacts/kael-v1/weights.bin');

    const calls = [];
    const result = archiver.archiveModel(tmpDir, 'kael-v1', {
      repo: 'org/repo',
      tokenEnv: 'HF_TOKEN_ALT',
      _runHfCli: (args, opts) => {
        calls.push({ args, opts });
        return { stdout: 'https://huggingface.co/org/repo/commit/abc1234', ok: true };
      },
    });
    assert.equal(result.mode, 'hf');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.token, 'alt-token');
  });

  it('errors NO_REPO when no repo + no setting configured', () => {
    seed('kael-v1', { kind: 'llm', status: 'staging', artifact_path: '.planning/models/artifacts/kael-v1' });
    seedArtifact('.planning/models/artifacts/kael-v1/weights.bin');

    // forceLocal is FALSE but no repo: archiver should fall through to local
    // (matches CLI behavior). Use forceHfPath via direct _archiveHf to test
    // the explicit NO_REPO surface.
    const m = registry.getModel(tmpDir, 'kael-v1');
    assert.throws(
      () => archiver._archiveHf(tmpDir, m, {}),
      (err) => err.code === 'NO_REPO'
    );
  });

  it('errors NO_ARTIFACT when artifact path does not exist', () => {
    seed('kael-v1', { kind: 'llm', status: 'staging', artifact_path: '.planning/models/artifacts/missing' });

    assert.throws(
      () => archiver.archiveModel(tmpDir, 'kael-v1', { repo: 'org/repo' }),
      (err) => err.code === 'NO_ARTIFACT'
    );
  });

  it('passes correct repo / file / commit-msg / private flag to huggingface-cli', () => {
    seed('kael-v1', {
      kind: 'llm',
      status: 'staging',
      artifact_path: '.planning/models/artifacts/kael-v1',
    });
    seedArtifact('.planning/models/artifacts/kael-v1/adapter_model.safetensors');

    const calls = [];
    const result = archiver.archiveModel(tmpDir, 'kael-v1', {
      repo: 'magicbornstudios/gad-models-archive',
      commitMsg: 'archive kael-v1 displaced by kael-v2',
      _runHfCli: (args, opts) => {
        calls.push({ args, opts });
        return {
          stdout: 'Uploaded.\nhttps://huggingface.co/magicbornstudios/gad-models-archive/commit/c0ffee1234567890\n',
          ok: true,
        };
      },
    });

    assert.equal(calls.length, 1);
    const { args, opts } = calls[0];
    assert.equal(args[0], 'upload');
    assert.equal(args[1], 'magicbornstudios/gad-models-archive');
    // args[2] = artifact path (absolute, on tmp dir)
    assert.ok(args[2].endsWith('kael-v1'), `expected artifact path to end with kael-v1, got ${args[2]}`);
    // args[3] = path-in-repo (the model id)
    assert.equal(args[3], 'kael-v1');
    assert.ok(args.includes('--repo-type'));
    assert.equal(args[args.indexOf('--repo-type') + 1], 'model');
    assert.ok(args.includes('--commit-message'));
    assert.equal(args[args.indexOf('--commit-message') + 1], 'archive kael-v1 displaced by kael-v2');
    assert.ok(args.includes('--private'), 'private by default');
    assert.equal(opts.token, 'fake-token-xyz');

    assert.equal(result.mode, 'hf');
    assert.equal(result.repo, 'magicbornstudios/gad-models-archive');
    assert.equal(result.repoUrl, 'https://huggingface.co/magicbornstudios/gad-models-archive');
    assert.equal(result.pathInRepo, 'kael-v1');
    assert.equal(result.commitSha, 'c0ffee1234567890');
    assert.equal(result.private, true);
  });

  it('honors private: false to drop the --private flag', () => {
    seed('mid-a', {
      kind: 'mid',
      status: 'staging',
      artifact_path: '.planning/models/artifacts/mid-a',
    });
    seedArtifact('.planning/models/artifacts/mid-a/model.pt');

    const calls = [];
    archiver.archiveModel(tmpDir, 'mid-a', {
      repo: 'org/repo',
      private: false,
      _runHfCli: (args, opts) => {
        calls.push({ args, opts });
        return { stdout: '', ok: true };
      },
    });
    assert.equal(calls[0].args.includes('--private'), false);
  });

  it('CLI_MISSING error bubbles up unchanged', () => {
    seed('kael-v1', { kind: 'llm', status: 'staging', artifact_path: '.planning/models/artifacts/kael-v1' });
    seedArtifact('.planning/models/artifacts/kael-v1/weights.bin');

    assert.throws(
      () => archiver.archiveModel(tmpDir, 'kael-v1', {
        repo: 'org/repo',
        _runHfCli: () => {
          const e = new Error('huggingface-cli not found.');
          e.code = 'CLI_MISSING';
          throw e;
        },
      }),
      (err) => err.code === 'CLI_MISSING'
    );
  });

  it('CLI_FAILED error bubbles up with message', () => {
    seed('kael-v1', { kind: 'llm', status: 'staging', artifact_path: '.planning/models/artifacts/kael-v1' });
    seedArtifact('.planning/models/artifacts/kael-v1/weights.bin');

    assert.throws(
      () => archiver.archiveModel(tmpDir, 'kael-v1', {
        repo: 'org/repo',
        _runHfCli: () => {
          const e = new Error('huggingface-cli failed: 401 unauthorized');
          e.code = 'CLI_FAILED';
          throw e;
        },
      }),
      (err) => err.code === 'CLI_FAILED' && /401/.test(err.message)
    );
  });
});

// ─── Dry-run ─────────────────────────────────────────────────────────────────

describe('archiveModel — dry-run', () => {
  beforeEach(() => {
    makeRoot();
    snapshotEnv();
    process.env.HF_TOKEN = 'fake-token-xyz';
  });
  afterEach(() => { restoreEnv(); cleanRoot(); });

  it('HF dry-run does not invoke huggingface-cli', () => {
    seed('kael-v1', { kind: 'llm', status: 'staging', artifact_path: '.planning/models/artifacts/kael-v1' });
    seedArtifact('.planning/models/artifacts/kael-v1/weights.bin');

    let invoked = false;
    const result = archiver.archiveModel(tmpDir, 'kael-v1', {
      repo: 'org/repo',
      dryRun: true,
      _runHfCli: () => { invoked = true; return { stdout: '', ok: true }; },
    });
    assert.equal(invoked, false, 'huggingface-cli must not be invoked on dry-run');
    assert.equal(result.dryRun, true);
    assert.equal(result.mode, 'hf');
    assert.equal(result.repo, 'org/repo');
    assert.ok(Array.isArray(result.cliArgs) && result.cliArgs[0] === 'upload');
  });

  it('HF dry-run is OK even when artifact missing (describes intent)', () => {
    seed('kael-v1', { kind: 'llm', status: 'staging', artifact_path: '.planning/models/artifacts/kael-v1' });
    // no seedArtifact — path does not exist

    const result = archiver.archiveModel(tmpDir, 'kael-v1', {
      repo: 'org/repo',
      dryRun: true,
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.mode, 'hf');
  });

  it('local dry-run does not write meta.json', () => {
    seed('intent-a', { kind: 'intent', status: 'staging' });
    const result = archiver.archiveModel(tmpDir, 'intent-a', {
      dryRun: true,
      forceLocal: true,
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.mode, 'local');
    assert.equal(fs.existsSync(result.metaPath), false, 'meta.json must not be written on dry-run');
  });
});

// ─── Local archive (fallback) ────────────────────────────────────────────────

describe('archiveModel — local archive', () => {
  beforeEach(() => { makeRoot(); snapshotEnv(); });
  afterEach(() => { restoreEnv(); cleanRoot(); });

  it('falls back to local when no repo configured and forceLocal not set', () => {
    delete process.env.GAD_HF_ARCHIVE_REPO;
    seed('knn-a', { kind: 'knn', status: 'staging' });

    const result = archiver.archiveModel(tmpDir, 'knn-a', {});
    assert.equal(result.mode, 'local');
    assert.ok(fs.existsSync(result.metaPath));
    const meta = JSON.parse(fs.readFileSync(result.metaPath, 'utf8'));
    assert.equal(meta.id, 'knn-a');
    assert.equal(meta.kind, 'knn');
    assert.ok(meta.archived_at);
  });

  it('forceLocal=true skips HF even when repo configured', () => {
    process.env.HF_TOKEN = 'fake-token';
    seed('kael-v1', { kind: 'llm', status: 'staging' });

    const result = archiver.archiveModel(tmpDir, 'kael-v1', {
      repo: 'org/repo',
      forceLocal: true,
      _runHfCli: () => { throw new Error('should not be called'); },
    });
    assert.equal(result.mode, 'local');
    assert.ok(fs.existsSync(result.metaPath));
  });
});

// ─── _readArtifactPath ───────────────────────────────────────────────────────

describe('_readArtifactPath', () => {
  beforeEach(() => makeRoot());
  after(() => cleanRoot());

  it('prefers explicit artifact_path when it exists', () => {
    seedArtifact('models/explicit/file.bin');
    const m = { id: 'x', artifact_path: 'models/explicit' };
    const r = archiver._readArtifactPath(tmpDir, m);
    assert.equal(r.exists, true);
    assert.ok(r.path.endsWith('explicit'));
  });

  it('falls back to adapters[0] when artifact_path missing', () => {
    seedArtifact('adapters/kael-lora/adapter.bin');
    const m = { id: 'kael-v1', adapters: ['adapters/kael-lora'] };
    const r = archiver._readArtifactPath(tmpDir, m);
    assert.equal(r.exists, true);
    assert.ok(r.path.endsWith('kael-lora'));
  });

  it('falls back to .planning/models/artifacts/<id>/ when neither set', () => {
    seedArtifact('.planning/models/artifacts/auto-id/file.bin');
    const m = { id: 'auto-id' };
    const r = archiver._readArtifactPath(tmpDir, m);
    assert.equal(r.exists, true);
    assert.ok(r.path.includes('auto-id'));
  });

  it('returns exists=false when no candidate path exists on disk', () => {
    const m = { id: 'ghost', artifact_path: 'models/ghost' };
    const r = archiver._readArtifactPath(tmpDir, m);
    assert.equal(r.exists, false);
    assert.ok(r.path);
  });
});
