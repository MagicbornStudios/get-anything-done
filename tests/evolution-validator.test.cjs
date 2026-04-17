/**
 * Unit tests for lib/evolution-validator.cjs
 *
 * Task 42.2-04: extractFileRefs must dedup overlapping path prefixes so a
 * long-form path and its trailing substring are treated as the same reference.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { extractFileRefs } = require('../lib/evolution-validator.cjs');

describe('extractFileRefs — prefix dedup (task 42.2-04)', () => {
  test('drops a trailing-substring ref when the longer form is also present', () => {
    const body = `
      See \`skills/vcs-primitives/SKILL.md\` for the full workflow.
      The short-form mention of \`vcs-primitives/SKILL.md\` should be deduped.
    `;
    const refs = extractFileRefs(body);
    assert.ok(
      refs.includes('skills/vcs-primitives/SKILL.md'),
      'longer ref should be kept',
    );
    assert.ok(
      !refs.includes('vcs-primitives/SKILL.md'),
      'shorter trailing-substring ref should be deduped',
    );
  });

  test('keeps both refs when neither is a trailing substring of the other', () => {
    const body = `
      See \`skills/foo/SKILL.md\` and also \`agents/bar/AGENT.md\`.
    `;
    const refs = extractFileRefs(body);
    assert.ok(refs.includes('skills/foo/SKILL.md'));
    assert.ok(refs.includes('agents/bar/AGENT.md'));
  });

  test('dedup is case-preserving and sorted', () => {
    const body = `
      \`a/b/c/file.md\` vs \`b/c/file.md\` vs \`c/file.md\`.
    `;
    const refs = extractFileRefs(body);
    // Only the longest form should survive — all three are on the same chain.
    assert.deepStrictEqual(refs, ['a/b/c/file.md']);
  });

  test('partial-segment matches do not count as trailing substrings', () => {
    // "foo-vcs/SKILL.md" is NOT a trailing substring of "skills/vcs/SKILL.md"
    // because the boundary is a path separator, not an arbitrary char.
    const body = `
      \`skills/vcs/SKILL.md\` and \`foo-vcs/SKILL.md\` are distinct.
    `;
    const refs = extractFileRefs(body);
    assert.ok(refs.includes('skills/vcs/SKILL.md'));
    assert.ok(refs.includes('foo-vcs/SKILL.md'));
  });

  test('directory refs with trailing slash still collect', () => {
    const body = `
      Folder ref: \`evals/escape-the-dungeon/\`.
    `;
    const refs = extractFileRefs(body);
    assert.ok(refs.includes('evals/escape-the-dungeon/'));
  });
});
