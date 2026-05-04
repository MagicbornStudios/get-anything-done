'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createHandoff, readHandoff } = require('../lib/handoffs.cjs');
const { createHandoffsCommand } = require('../bin/commands/handoffs.cjs');
const { composePrompt } = require('../lib/team/prompt.cjs');
const { load } = require('../bin/gad-config.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

function captureConsole(fn) {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  return logs.join('\n');
}

function makeCommand(tmpDir) {
  return createHandoffsCommand({
    findRepoRoot() {
      return tmpDir;
    },
    outputError(message) {
      throw new Error(message);
    },
    render() {
      throw new Error('render should not be used in these tests');
    },
    shouldUseJson() {
      return false;
    },
    detectRuntimeIdentity() {
      return { id: 'codex-cli' };
    },
    gadConfig: {
      load() {
        return { roots: [{ id: 'sample', path: '.', planningDir: '.planning' }] };
      },
    },
    resolveRoots(args, _baseDir, allRoots) {
      return allRoots.filter((root) => !args.projectid || root.id === args.projectid);
    },
  });
}

describe('handoff context taxonomy', () => {
  test('legacy context aliases are accepted and normalized', () => {
    const tmpDir = createTempDir('gad-handoff-context-');
    try {
      const mechanical = createHandoff({
        baseDir: tmpDir,
        projectid: 'sample',
        phase: '87',
        body: 'body',
        estimatedContext: 'mechanical',
      });
      const exploratory = createHandoff({
        baseDir: tmpDir,
        projectid: 'sample',
        phase: '88',
        body: 'body',
        estimatedContext: 'reasoning',
      });

      assert.equal(readHandoff({ baseDir: tmpDir, id: mechanical.id }).frontmatter.estimated_context, 'prescribed');
      assert.equal(readHandoff({ baseDir: tmpDir, id: exploratory.id }).frontmatter.estimated_context, 'exploratory');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('all six new context values are accepted', () => {
    const tmpDir = createTempDir('gad-handoff-context-');
    try {
      for (const context of ['prescribed', 'bounded', 'exploratory', 'design', 'audit', 'decision']) {
        const created = createHandoff({
          baseDir: tmpDir,
          projectid: 'sample',
          phase: '87',
          body: 'body',
          estimatedContext: context,
        });
        assert.equal(readHandoff({ baseDir: tmpDir, id: created.id }).frontmatter.estimated_context, context);
      }
    } finally {
      cleanup(tmpDir);
    }
  });

  test('orthogonal flags persist in frontmatter', () => {
    const tmpDir = createTempDir('gad-handoff-context-');
    try {
      const created = createHandoff({
        baseDir: tmpDir,
        projectid: 'sample',
        phase: '87',
        body: 'body',
        estimatedContext: 'design',
        risk: 'irreversible',
        time: 'deep',
        surface: 'api-bound',
      });
      const loaded = readHandoff({ baseDir: tmpDir, id: created.id });
      assert.equal(loaded.frontmatter.estimated_context, 'design');
      assert.equal(loaded.frontmatter.risk, 'irreversible');
      assert.equal(loaded.frontmatter.time, 'deep');
      assert.equal(loaded.frontmatter.surface, 'api-bound');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('existing handoffs without new fields read back with safe defaults', () => {
    const tmpDir = createTempDir('gad-handoff-context-');
    try {
      const handoffPath = path.join(tmpDir, '.planning', 'handoffs', 'open', 'h-legacy.md');
      fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
      fs.writeFileSync(handoffPath, [
        '---',
        'id: h-legacy',
        'projectid: sample',
        'phase: 87',
        'priority: normal',
        'estimated_context: mechanical',
        '---',
        '',
        'body',
      ].join('\n'));

      const loaded = readHandoff({ baseDir: tmpDir, id: 'h-legacy' });
      assert.equal(loaded.frontmatter.estimated_context, 'prescribed');
      assert.equal(loaded.frontmatter.risk, 'safe');
      assert.equal(loaded.frontmatter.time, 'standard');
      assert.equal(loaded.frontmatter.surface, 'local');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('worker prompt includes the constraint banner', () => {
    const prompt = composePrompt({
      kind: 'handoff',
      ref: 'h-1',
      projectid: 'sample',
      body: 'Do the work.',
      frontmatter: {
        estimated_context: 'design',
        risk: 'irreversible',
        time: 'deep',
        surface: 'api-bound',
      },
    }, { workerId: 'w1', lane: 'codex-primary' });

    assert.match(prompt, /This handoff is:/);
    assert.match(prompt, /context: design \(aesthetic judgment needed\)/);
    assert.match(prompt, /risk: irreversible \(require operator confirmation before external writes\)/);
    assert.match(prompt, /time: deep \(checkpoint past 20min\)/);
    assert.match(prompt, /surface: api-bound \(verify env vars first\)/);
  });

  test('worker prompt includes scoped preload skills from gad-config skills.scope', () => {
    const tmpDir = createTempDir('gad-handoff-context-');
    try {
      fs.writeFileSync(path.join(tmpDir, 'gad-config.toml'), [
        '[skills.scope]',
        'enabled = true',
        'standing = ["frontend-design"]',
        'standing_contexts = ["design"]',
        '',
        '[skills.scope.runtime]',
        'codex-cli = ["repo-planner"]',
        '',
        '[skills.scope.context]',
        'design = ["web-design-guidelines"]',
        '',
      ].join('\n'));

      const config = load(tmpDir);
      const prompt = composePrompt({
        kind: 'handoff',
        ref: 'h-2',
        projectid: 'sample',
        body: 'Do the work.',
        frontmatter: {
          estimated_context: 'design',
        },
      }, {
        workerId: 'w1',
        lane: 'codex-primary',
        runtime: 'codex-cli',
        skillsScope: config.skills.scope,
      });

      assert.match(prompt, /Scoped preload skills \(codex-cli \/ design\): frontend-design, repo-planner, web-design-guidelines\./);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('handoffs create help surface exposes new flags', () => {
    const tmpDir = createTempDir('gad-handoff-context-');
    const command = makeCommand(tmpDir);
    try {
      const output = captureConsole(() => {
        for (const [name, spec] of Object.entries(command.subCommands.create.args)) {
          console.log(`${name}: ${spec.description}`);
        }
      });

      assert.match(output, /context: prescribed \| bounded \| exploratory \| design \| audit \| decision/);
      assert.match(output, /risk: safe \| destructive \| irreversible/);
      assert.match(output, /time: quick \| standard \| deep/);
      assert.match(output, /surface: local \| api-bound \| human-loop/);
    } finally {
      cleanup(tmpDir);
    }
  });
});
