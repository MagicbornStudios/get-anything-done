const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempDir, cleanup } = require('./helpers.cjs');

process.env.GAD_TEST_MODE = '1';
const { configureOpencodePermissions } = require('../bin/install.js');

const envKeys = ['OPENCODE_CONFIG_DIR', 'OPENCODE_CONFIG', 'XDG_CONFIG_HOME'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));

function restoreEnv(snapshot) {
  for (const key of envKeys) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

let configDir;

beforeEach(() => {
  configDir = createTempDir('gad-opencode-');
});

afterEach(() => {
  cleanup(configDir);
  restoreEnv(originalEnv);
});

describe('configureOpencodePermissions', () => {
  test('sets permission to "allow" when config is empty', () => {
    const configPath = path.join(configDir, 'opencode.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2) + '\n');
    process.env.OPENCODE_CONFIG_DIR = configDir;

    configureOpencodePermissions(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(config.permission, 'allow');
  });

  test('leaves config unchanged when permission is already "allow"', () => {
    const configPath = path.join(configDir, 'opencode.json');
    const original = JSON.stringify({ permission: 'allow', skills: { paths: ['/tmp/skills'] } }, null, 2) + '\n';
    fs.writeFileSync(configPath, original);
    process.env.OPENCODE_CONFIG_DIR = configDir;

    configureOpencodePermissions(true);

    assert.strictEqual(fs.readFileSync(configPath, 'utf8'), original);
  });

  test('does not crash when config cannot be parsed', () => {
    const configPath = path.join(configDir, 'opencode.jsonc');
    fs.writeFileSync(configPath, '{ broken json }');
    process.env.OPENCODE_CONFIG_DIR = configDir;

    assert.doesNotThrow(() => configureOpencodePermissions(true));
  });
});
