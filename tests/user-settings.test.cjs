/**
 * user-settings.test.cjs — unit tests for lib/user-settings.cjs.
 *
 * Pure tests — no real fs, no real os. Exercises resolution order,
 * machine-name default, assigned-soul lookup, and atomic write.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const {
  UserSettingsError,
  candidatePaths,
  resolveReadPath,
  resolveWritePath,
  read,
  write,
  getDisplayName,
  getAssignedSoul,
  setLastActiveProjectid,
  setAssignedSoul,
} = require('../lib/user-settings.cjs');

function makeFsFake(initial) {
  const store = { ...initial };
  return {
    store,
    existsSync: (p) => p in store,
    readFileSync: (p) => {
      if (!(p in store)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return store[p];
    },
    writeFileSync: (p, data) => { store[p] = data; },
    renameSync: (a, b) => { store[b] = store[a]; delete store[a]; },
    unlinkSync: (p) => { delete store[p]; },
    mkdirSync: () => {},
  };
}

function makeOsFake(username = 'benja') {
  return {
    homedir: () => '/home/benja',
    userInfo: () => ({ username }),
  };
}

describe('user-settings: candidate-path resolution', () => {
  test('GAD_USER_SETTINGS env beats XDG beats ~/.config beats ~/.claude', () => {
    const paths = candidatePaths({
      envImpl: { GAD_USER_SETTINGS: '/tmp/override.json', XDG_CONFIG_HOME: '/xdg' },
      osImpl: makeOsFake(),
    });
    assert.equal(paths[0], '/tmp/override.json');
    assert.equal(paths[1], path.join('/xdg', 'gad', 'user.json'));
    assert.equal(paths[2], path.join('/home/benja', '.config', 'gad', 'user.json'));
    assert.equal(paths[3], path.join('/home/benja', '.claude', 'gad-user.json'));
  });

  test('no env → default order is ~/.config/gad then ~/.claude/gad-user.json', () => {
    const paths = candidatePaths({ envImpl: {}, osImpl: makeOsFake() });
    assert.equal(paths.length, 2);
    assert.equal(paths[0], path.join('/home/benja', '.config', 'gad', 'user.json'));
    assert.equal(paths[1], path.join('/home/benja', '.claude', 'gad-user.json'));
  });

  test('resolveReadPath returns the first candidate that exists', () => {
    const fsFake = makeFsFake({ [path.join('/home/benja', '.claude', 'gad-user.json')]: '{}' });
    const got = resolveReadPath({ fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake() });
    assert.equal(got, path.join('/home/benja', '.claude', 'gad-user.json'));
  });

  test('resolveReadPath returns null when no candidate exists', () => {
    const fsFake = makeFsFake({});
    const got = resolveReadPath({ fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake() });
    assert.equal(got, null);
  });

  test('resolveWritePath returns the first candidate regardless of existence', () => {
    const got = resolveWritePath({
      envImpl: { XDG_CONFIG_HOME: '/xdg' },
      osImpl: makeOsFake(),
    });
    assert.equal(got, path.join('/xdg', 'gad', 'user.json'));
  });
});

describe('user-settings: read defaults', () => {
  test('missing file → displayName defaults to os.userInfo().username', () => {
    const fsFake = makeFsFake({});
    const { settings, path: p } = read({ fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake('alice') });
    assert.equal(p, null);
    assert.equal(settings.displayName, 'alice');
    assert.equal(settings.lastActiveProjectid, '');
    assert.deepEqual(settings.assignedSouls, {});
  });

  test('existing file with displayName keeps it', () => {
    const writePath = path.join('/home/benja', '.config', 'gad', 'user.json');
    const fsFake = makeFsFake({
      [writePath]: JSON.stringify({ displayName: 'Operator', lastActiveProjectid: 'get-anything-done' }),
    });
    const { settings } = read({ fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake('alice') });
    assert.equal(settings.displayName, 'Operator');
    assert.equal(settings.lastActiveProjectid, 'get-anything-done');
  });

  test('existing file with empty displayName backfills from os', () => {
    const writePath = path.join('/home/benja', '.config', 'gad', 'user.json');
    const fsFake = makeFsFake({ [writePath]: JSON.stringify({ displayName: '' }) });
    const { settings } = read({ fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake('bob') });
    assert.equal(settings.displayName, 'bob');
  });

  test('malformed JSON throws MALFORMED_JSON', () => {
    const writePath = path.join('/home/benja', '.config', 'gad', 'user.json');
    const fsFake = makeFsFake({ [writePath]: '{ not json' });
    assert.throws(
      () => read({ fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake() }),
      (e) => e instanceof UserSettingsError && e.code === 'MALFORMED_JSON',
    );
  });

  test('non-object JSON (array, null) throws MALFORMED_JSON', () => {
    const writePath = path.join('/home/benja', '.config', 'gad', 'user.json');
    const fsFake = makeFsFake({ [writePath]: '[]' });
    assert.throws(
      () => read({ fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake() }),
      (e) => e instanceof UserSettingsError && e.code === 'MALFORMED_JSON',
    );
  });

  test('assignedSouls wrong shape normalizes to {}', () => {
    const writePath = path.join('/home/benja', '.config', 'gad', 'user.json');
    const fsFake = makeFsFake({
      [writePath]: JSON.stringify({ assignedSouls: 'not-a-map' }),
    });
    const { settings } = read({ fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake() });
    assert.deepEqual(settings.assignedSouls, {});
  });
});

describe('user-settings: write atomicity', () => {
  test('write creates file at first candidate path when none exist', () => {
    const fsFake = makeFsFake({});
    const { path: p } = write(
      { displayName: 'Op', lastActiveProjectid: 'x' },
      { fsImpl: fsFake, envImpl: { XDG_CONFIG_HOME: '/xdg' }, osImpl: makeOsFake() },
    );
    assert.equal(p, path.join('/xdg', 'gad', 'user.json'));
    const parsed = JSON.parse(fsFake.store[p]);
    assert.equal(parsed.displayName, 'Op');
    assert.equal(parsed.lastActiveProjectid, 'x');
  });

  test('write to existing path replaces content atomically (tmp + rename)', () => {
    const target = path.join('/home/benja', '.config', 'gad', 'user.json');
    const fsFake = makeFsFake({ [target]: JSON.stringify({ displayName: 'Old' }) });
    write(
      { displayName: 'New', lastActiveProjectid: 'y' },
      { fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake() },
    );
    const parsed = JSON.parse(fsFake.store[target]);
    assert.equal(parsed.displayName, 'New');
    assert.equal(parsed.lastActiveProjectid, 'y');
    // no .tmp-* residue
    const leftover = Object.keys(fsFake.store).filter((k) => k.includes('.tmp-'));
    assert.equal(leftover.length, 0);
  });

  test('non-object settings rejected with VALIDATION_FAILED', () => {
    assert.throws(
      () => write('not-an-object'),
      (e) => e instanceof UserSettingsError && e.code === 'VALIDATION_FAILED',
    );
  });
});

describe('user-settings: accessor helpers', () => {
  test('getDisplayName pulls from file when present', () => {
    const writePath = path.join('/home/benja', '.config', 'gad', 'user.json');
    const fsFake = makeFsFake({ [writePath]: JSON.stringify({ displayName: 'Kael' }) });
    assert.equal(
      getDisplayName({ fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake() }),
      'Kael',
    );
  });

  test('getAssignedSoul returns mapped slug or empty string', () => {
    const writePath = path.join('/home/benja', '.config', 'gad', 'user.json');
    const fsFake = makeFsFake({
      [writePath]: JSON.stringify({
        assignedSouls: { 'get-anything-done': 'kael', 'llm-from-scratch': 'orin' },
      }),
    });
    const ctx = { fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake() };
    assert.equal(getAssignedSoul('get-anything-done', ctx), 'kael');
    assert.equal(getAssignedSoul('llm-from-scratch', ctx), 'orin');
    assert.equal(getAssignedSoul('unmapped-project', ctx), '');
  });

  test('setLastActiveProjectid round-trips through read/write', () => {
    const fsFake = makeFsFake({});
    const ctx = { fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake() };
    setLastActiveProjectid('get-anything-done', ctx);
    const { settings } = read(ctx);
    assert.equal(settings.lastActiveProjectid, 'get-anything-done');
  });

  test('setAssignedSoul adds then removes mapping', () => {
    const fsFake = makeFsFake({});
    const ctx = { fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake() };
    setAssignedSoul('get-anything-done', 'kael', ctx);
    assert.equal(getAssignedSoul('get-anything-done', ctx), 'kael');
    setAssignedSoul('get-anything-done', '', ctx);
    assert.equal(getAssignedSoul('get-anything-done', ctx), '');
  });

  test('setAssignedSoul without projectid throws VALIDATION_FAILED', () => {
    const fsFake = makeFsFake({});
    const ctx = { fsImpl: fsFake, envImpl: {}, osImpl: makeOsFake() };
    assert.throws(
      () => setAssignedSoul('', 'kael', ctx),
      (e) => e instanceof UserSettingsError && e.code === 'VALIDATION_FAILED',
    );
  });
});
