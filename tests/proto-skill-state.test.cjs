/**
 * Proto-skill drafting state classifier — unit tests for the pending /
 * in-progress / complete counts that back `gad evolution status` per
 * decision gad-171 + task 42.2-06.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createTempDir, cleanup } = require('./helpers.cjs');
const { classifyProtoSkillDraftingState } = require('../lib/proto-skill-state.cjs');

function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(p, content = '') {
  mkdir(path.dirname(p));
  fs.writeFileSync(p, content);
}

function setupFixture() {
  const root = createTempDir('gad-proto-skill-state-');
  const candidatesDir = path.join(root, '.planning', 'candidates');
  const protoSkillsDir = path.join(root, '.planning', 'proto-skills');
  mkdir(candidatesDir);
  mkdir(protoSkillsDir);
  return { root, candidatesDir, protoSkillsDir };
}

describe('classifyProtoSkillDraftingState', () => {
  test('empty dirs → all buckets empty', () => {
    const { root, candidatesDir, protoSkillsDir } = setupFixture();
    try {
      const state = classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir);
      assert.deepStrictEqual(state, { pending: [], inProgress: [], complete: [] });
    } finally {
      cleanup(root);
    }
  });

  test('candidate without proto-skill dir → pending', () => {
    const { root, candidatesDir, protoSkillsDir } = setupFixture();
    try {
      mkdir(path.join(candidatesDir, 'phase-x'));
      writeFile(path.join(candidatesDir, 'phase-x', 'CANDIDATE.md'), '# x');

      const state = classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir);
      assert.deepStrictEqual(state.pending, ['phase-x']);
      assert.deepStrictEqual(state.inProgress, []);
      assert.deepStrictEqual(state.complete, []);
    } finally {
      cleanup(root);
    }
  });

  test('proto-skill dir with PROVENANCE.md but no SKILL.md → in-progress (resume target)', () => {
    const { root, candidatesDir, protoSkillsDir } = setupFixture();
    try {
      mkdir(path.join(candidatesDir, 'phase-y'));
      writeFile(path.join(candidatesDir, 'phase-y', 'CANDIDATE.md'), '# y');
      writeFile(
        path.join(protoSkillsDir, 'phase-y', 'PROVENANCE.md'),
        '---\nstatus: in-progress\n---\n',
      );

      const state = classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir);
      assert.deepStrictEqual(state.pending, []);
      assert.deepStrictEqual(state.inProgress, ['phase-y']);
      assert.deepStrictEqual(state.complete, []);
    } finally {
      cleanup(root);
    }
  });

  test('proto-skill dir with both PROVENANCE.md and SKILL.md → complete', () => {
    const { root, candidatesDir, protoSkillsDir } = setupFixture();
    try {
      mkdir(path.join(candidatesDir, 'phase-z'));
      writeFile(path.join(candidatesDir, 'phase-z', 'CANDIDATE.md'), '# z');
      writeFile(path.join(protoSkillsDir, 'phase-z', 'PROVENANCE.md'), 'x');
      writeFile(
        path.join(protoSkillsDir, 'phase-z', 'SKILL.md'),
        '---\nname: phase-z\n---\n',
      );

      const state = classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir);
      assert.deepStrictEqual(state.pending, []);
      assert.deepStrictEqual(state.inProgress, []);
      assert.deepStrictEqual(state.complete, ['phase-z']);
    } finally {
      cleanup(root);
    }
  });

  test('proto-skill dir with SKILL.md but no PROVENANCE.md → still complete (pre-gad-171 shape)', () => {
    const { root, candidatesDir, protoSkillsDir } = setupFixture();
    try {
      writeFile(path.join(protoSkillsDir, 'legacy-skill', 'SKILL.md'), '---\nname: legacy-skill\n---\n');

      const state = classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir);
      assert.deepStrictEqual(state.complete, ['legacy-skill']);
      assert.deepStrictEqual(state.inProgress, []);
    } finally {
      cleanup(root);
    }
  });

  test('mixed batch — pending + in-progress + complete counted independently', () => {
    const { root, candidatesDir, protoSkillsDir } = setupFixture();
    try {
      // Three candidates, different states.
      mkdir(path.join(candidatesDir, 'a-pending'));
      mkdir(path.join(candidatesDir, 'b-in-progress'));
      mkdir(path.join(candidatesDir, 'c-complete'));

      writeFile(path.join(protoSkillsDir, 'b-in-progress', 'PROVENANCE.md'), 'x');

      writeFile(path.join(protoSkillsDir, 'c-complete', 'PROVENANCE.md'), 'x');
      writeFile(path.join(protoSkillsDir, 'c-complete', 'SKILL.md'), '---\nname: c\n---\n');

      const state = classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir);
      assert.deepStrictEqual(state.pending.sort(), ['a-pending']);
      assert.deepStrictEqual(state.inProgress.sort(), ['b-in-progress']);
      assert.deepStrictEqual(state.complete.sort(), ['c-complete']);
    } finally {
      cleanup(root);
    }
  });

  test('missing dirs → all buckets empty, no crash', () => {
    const root = createTempDir('gad-proto-skill-state-missing-');
    try {
      const candidatesDir = path.join(root, '.planning', 'candidates');
      const protoSkillsDir = path.join(root, '.planning', 'proto-skills');
      // Intentionally do NOT create either dir.
      const state = classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir);
      assert.deepStrictEqual(state, { pending: [], inProgress: [], complete: [] });
    } finally {
      cleanup(root);
    }
  });
});
