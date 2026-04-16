/**
 * gad try — temporary skill install flow (task 42.2-40).
 *
 * Covers three primary paths:
 *   A. Local-slug staging from skills/<slug>/
 *   B. Local-path staging from an arbitrary directory
 *   C. Lifecycle: stage → status → cleanup → status
 *
 * Git URL path is exercised manually (requires network) and is not in
 * this suite. Flow D-like operator trial lives in the graphify findings
 * doc instead.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runGadCli, createTempDir, cleanup } = require('./helpers.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

describe('gad try — local slug', () => {
  let cwd;
  let savedCwd;

  before(() => {
    cwd = createTempDir('gad-try-local-slug-');
    savedCwd = process.cwd();
    process.chdir(cwd);
  });

  after(() => {
    process.chdir(savedCwd);
    cleanup(cwd);
  });

  test('stages skills/gad-help/ into .gad-try/gad-help/', () => {
    const result = runGadCli(['try', 'gad-help', '--yes'], cwd);
    assert.ok(result.success, `stage failed: ${result.error}`);
    assert.match(result.output, /Staged/, 'prints Staged line');

    const sandbox = path.join(cwd, '.gad-try', 'gad-help');
    assert.ok(fs.existsSync(sandbox), 'sandbox directory created');
    assert.ok(fs.existsSync(path.join(sandbox, 'SKILL.md')), 'SKILL.md copied');
    assert.ok(fs.existsSync(path.join(sandbox, 'PROVENANCE.md')), 'PROVENANCE.md written');
    assert.ok(fs.existsSync(path.join(sandbox, 'ENTRY.md')), 'ENTRY.md handoff written');

    const prov = fs.readFileSync(path.join(sandbox, 'PROVENANCE.md'), 'utf8');
    assert.match(prov, /slug: gad-help/, 'PROVENANCE has slug');
    assert.match(prov, /kind: local-slug/, 'PROVENANCE has kind');
    assert.match(prov, /staged_by: gad-try/, 'PROVENANCE attribution');

    const entry = fs.readFileSync(path.join(sandbox, 'ENTRY.md'), 'utf8');
    assert.match(entry, /— try entry/, 'ENTRY has try entry heading');
    assert.match(entry, /Invoke the skill at \.gad-try\/gad-help\/SKILL\.md/, 'ENTRY has handoff prompt');
    assert.match(entry, /gad try cleanup gad-help/, 'ENTRY documents cleanup command');
    assert.match(entry, /Where the sandbox is/, 'ENTRY explains cwd-relative sandbox location');
    assert.match(entry, /copied to your clipboard/, 'ENTRY mentions clipboard auto-populate');

    // stdout should also include the handoff prompt inline + clipboard status.
    assert.match(result.output, /Paste this into your coding agent running in/, 'stdout prints paste banner');
    assert.match(result.output, /Invoke the skill at \.gad-try\/gad-help\/SKILL\.md/, 'stdout prints the handoff prompt');
    assert.match(result.output, /Clipboard:/, 'stdout reports clipboard status');
  });

  test('refuses to re-stage when sandbox already exists', () => {
    const result = runGadCli(['try', 'gad-help', '--yes'], cwd);
    assert.ok(!result.success, 'second stage should fail');
    assert.match(result.error || result.output, /already exists/, 'error mentions collision');
  });

  test('status lists the staged sandbox', () => {
    const result = runGadCli(['try', 'status'], cwd);
    assert.ok(result.success, `status failed: ${result.error}`);
    assert.match(result.output, /gad-help/, 'status lists gad-help');
  });

  test('cleanup removes the sandbox', () => {
    const result = runGadCli(['try', 'cleanup', 'gad-help'], cwd);
    assert.ok(result.success, `cleanup failed: ${result.error}`);
    assert.ok(
      !fs.existsSync(path.join(cwd, '.gad-try', 'gad-help')),
      'sandbox removed',
    );
  });

  test('status after cleanup shows empty', () => {
    const result = runGadCli(['try', 'status'], cwd);
    assert.ok(result.success, `status failed: ${result.error}`);
    assert.match(result.output, /No staged tries/, 'empty message shown');
  });
});

describe('gad try — local path', () => {
  let cwd;
  let savedCwd;
  let sourceSkillDir;

  before(() => {
    cwd = createTempDir('gad-try-local-path-');
    savedCwd = process.cwd();
    sourceSkillDir = path.join(cwd, 'my-local-skill');
    fs.mkdirSync(sourceSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(sourceSkillDir, 'SKILL.md'),
      [
        '---',
        'name: my-local-skill',
        'description: A fixture skill for the gad try local-path test.',
        'requires:',
        '  - node>=18',
        'installs:',
        '  - npm install -g some-tool',
        'outputs:',
        '  - my-local-output/',
        '---',
        '',
        '# my-local-skill',
        '',
        'Run `pip install graphifyy` to get the dependency.',
        '',
      ].join('\n'),
    );
    process.chdir(cwd);
  });

  after(() => {
    process.chdir(savedCwd);
    cleanup(cwd);
  });

  test('stages ./my-local-skill/ and captures declared + implicit deps', () => {
    const result = runGadCli(['try', './my-local-skill', '--yes'], cwd);
    assert.ok(result.success, `stage failed: ${result.error}`);

    const sandbox = path.join(cwd, '.gad-try', 'my-local-skill');
    assert.ok(fs.existsSync(sandbox), 'sandbox directory created');

    const prov = fs.readFileSync(path.join(sandbox, 'PROVENANCE.md'), 'utf8');
    assert.match(prov, /kind: local-path/, 'PROVENANCE records local-path kind');
    assert.match(prov, /node>=18/, 'captures declared requires');
    assert.match(prov, /npm install -g some-tool/, 'captures declared installs');
    assert.match(prov, /pip install graphifyy/, 'captures implicit install from body scan');
    assert.match(prov, /my-local-output/, 'captures declared outputs');
  });

  test('cleanup --all removes every sandbox at once', () => {
    // Create a second sandbox first.
    const second = path.join(cwd, 'second-skill');
    fs.mkdirSync(second, { recursive: true });
    fs.writeFileSync(
      path.join(second, 'SKILL.md'),
      '---\nname: second\ndescription: another fixture\n---\n\n# second\n',
    );
    runGadCli(['try', './second-skill', '--yes'], cwd);

    const result = runGadCli(['try', 'cleanup', '--all'], cwd);
    assert.ok(result.success, `cleanup --all failed: ${result.error}`);
    const sandboxRoot = path.join(cwd, '.gad-try');
    // Either removed or empty — both count as cleaned.
    const remaining = fs.existsSync(sandboxRoot) ? fs.readdirSync(sandboxRoot) : [];
    assert.deepStrictEqual(remaining, [], 'all sandboxes removed');
  });
});

describe('gad try — bad refs', () => {
  let cwd;
  let savedCwd;

  before(() => {
    cwd = createTempDir('gad-try-bad-refs-');
    savedCwd = process.cwd();
    process.chdir(cwd);
  });

  after(() => {
    process.chdir(savedCwd);
    cleanup(cwd);
  });

  test('unresolvable slug fails cleanly', () => {
    const result = runGadCli(['try', 'definitely-not-a-real-skill-slug-xyzzy', '--yes'], cwd);
    assert.ok(!result.success, 'should fail');
    assert.match(result.error || result.output, /could not resolve/, 'clear error message');
  });

  test('nonexistent path fails cleanly', () => {
    const result = runGadCli(['try', './no-such-dir/', '--yes'], cwd);
    assert.ok(!result.success, 'should fail');
  });
});
