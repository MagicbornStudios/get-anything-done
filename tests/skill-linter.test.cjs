/**
 * skill-linter.test.cjs — unit tests for lib/skill-linter.cjs.
 *
 * Pure tests using an injectable fsImpl fake.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const {
  parseFrontmatter,
  extractBodyRefs,
  lintSkill,
  summarizeLint,
} = require('../lib/skill-linter.cjs');

function makeFs(files) {
  return {
    readFileSync: (p) => {
      if (!(p in files)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return files[p];
    },
    statSync: (p) => {
      if (p in files) return { isFile: () => true, isDirectory: () => false };
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    },
    readdirSync: () => [],
  };
}

describe('skill-linter: parseFrontmatter', () => {
  test('parses scalar fields', () => {
    const { fields, hasFrontmatter } = parseFrontmatter('---\nname: foo\nlane: dev\n---\nbody');
    assert.equal(hasFrontmatter, true);
    assert.equal(fields.name, 'foo');
    assert.equal(fields.lane, 'dev');
  });

  test('parses folded block scalar (>-)', () => {
    const raw = '---\nname: foo\ndescription: >-\n  Line 1\n  Line 2\n---\nbody';
    const { fields } = parseFrontmatter(raw);
    assert.equal(fields.description, 'Line 1 Line 2');
  });

  test('parses flow-style array', () => {
    const raw = '---\nname: foo\nlane: [dev, meta]\n---\nbody';
    const { fields } = parseFrontmatter(raw);
    assert.deepEqual(fields.lane, ['dev', 'meta']);
  });

  test('flags duplicate keys', () => {
    const raw = '---\nname: foo\nlane: dev\nlane: meta\n---\nbody';
    const { fields, duplicateKeys } = parseFrontmatter(raw);
    assert.equal(duplicateKeys.length, 1);
    assert.equal(duplicateKeys[0].key, 'lane');
  });

  test('returns hasFrontmatter=false when no leading ---', () => {
    const { hasFrontmatter } = parseFrontmatter('# No frontmatter\n\nBody only.');
    assert.equal(hasFrontmatter, false);
  });

  test('returns unterminated=true when closing --- missing', () => {
    const { unterminated } = parseFrontmatter('---\nname: foo\nbody without close');
    assert.equal(unterminated, true);
  });
});

describe('skill-linter: extractBodyRefs', () => {
  test('extracts @alias refs', () => {
    const refs = extractBodyRefs('See @workflows/foo.md and @references/skill-shape.md');
    assert.equal(refs.length, 2);
    assert.equal(refs[0].kind, 'alias');
    assert.equal(refs[0].ref, '@workflows/foo.md');
  });

  test('extracts markdown link refs with .md/.cjs extensions', () => {
    const refs = extractBodyRefs('See [workflow](./workflow.md) and [lib](../lib/foo.cjs)');
    assert.equal(refs.length, 2);
    assert.equal(refs[0].kind, 'relative');
  });
});

describe('skill-linter: lintSkill — errors', () => {
  test('flags missing frontmatter as error', () => {
    const fs = makeFs({ '/skills/x/SKILL.md': '# Just a header\n' });
    const { issues } = lintSkill('/skills/x/SKILL.md', { fsImpl: fs, gadDir: '/' });
    assert.ok(issues.some((i) => i.code === 'NO_FRONTMATTER'));
  });

  test('flags missing required fields', () => {
    const fs = makeFs({ '/skills/x/SKILL.md': '---\nlane: dev\n---\nbody' });
    const { issues } = lintSkill('/skills/x/SKILL.md', { fsImpl: fs, gadDir: '/' });
    const codes = issues.map((i) => i.code);
    assert.ok(codes.includes('MISSING_REQUIRED_FIELD'));
  });

  test('flags invalid lane value', () => {
    const raw = '---\nname: foo\ndescription: valid description long enough to not hit short warning\nlane: bogus\n---\nbody';
    const fs = makeFs({ '/skills/x/SKILL.md': raw });
    const { issues } = lintSkill('/skills/x/SKILL.md', { fsImpl: fs, gadDir: '/' });
    assert.ok(issues.some((i) => i.code === 'INVALID_LANE'));
  });

  test('flags duplicate frontmatter keys', () => {
    const raw = '---\nname: foo\ndescription: this description is long enough to pass the short-description check\nlane: dev\nlane: meta\n---\nbody';
    const fs = makeFs({ '/skills/x/SKILL.md': raw });
    const { issues } = lintSkill('/skills/x/SKILL.md', { fsImpl: fs, gadDir: '/' });
    assert.ok(issues.some((i) => i.code === 'DUPLICATE_KEY'));
  });

  test('flags broken workflow pointer', () => {
    const raw = '---\nname: foo\ndescription: long enough description for the linter to pass its short-description warning\nlane: dev\nworkflow: workflows/missing.md\n---\nbody';
    const fs = makeFs({ '/skills/x/SKILL.md': raw });
    const { issues } = lintSkill('/skills/x/SKILL.md', { fsImpl: fs, gadDir: '/' });
    assert.ok(issues.some((i) => i.code === 'BROKEN_WORKFLOW_REF'));
  });
});

describe('skill-linter: lintSkill — warnings + info', () => {
  test('warns on description too short', () => {
    const raw = '---\nname: foo\ndescription: too short\nlane: dev\n---\nbody';
    const fs = makeFs({ '/skills/x/SKILL.md': raw });
    const { issues } = lintSkill('/skills/x/SKILL.md', { fsImpl: fs, gadDir: '/' });
    assert.ok(issues.some((i) => i.code === 'DESCRIPTION_TOO_SHORT'));
  });

  test('warns on missing lane (recommended)', () => {
    const raw = '---\nname: foo\ndescription: long enough description to pass the short check without problems here\n---\nbody';
    const fs = makeFs({ '/skills/x/SKILL.md': raw });
    const { issues } = lintSkill('/skills/x/SKILL.md', { fsImpl: fs, gadDir: '/' });
    assert.ok(issues.some((i) => i.code === 'MISSING_RECOMMENDED_FIELD'));
  });

  test('info-level issue for broken body ref', () => {
    const raw = '---\nname: foo\ndescription: long enough description here to pass the short check without problems\nlane: dev\n---\nSee @references/nonexistent.md for details.';
    const fs = makeFs({ '/skills/x/SKILL.md': raw });
    const { issues } = lintSkill('/skills/x/SKILL.md', { fsImpl: fs, gadDir: '/gad' });
    assert.ok(issues.some((i) => i.code === 'BROKEN_BODY_REF' && i.severity === 'info'));
  });

  test('clean skill produces zero issues', () => {
    const raw = '---\nname: foo\ndescription: this is a clean skill with a description long enough to pass all the linter checks without issue\nlane: dev\n---\nBody content with no broken refs.';
    const fs = makeFs({ '/skills/x/SKILL.md': raw });
    const { issues } = lintSkill('/skills/x/SKILL.md', { fsImpl: fs, gadDir: '/gad' });
    assert.deepEqual(issues, []);
  });
});

describe('skill-linter: summarizeLint', () => {
  test('aggregates counts and top-by-tokens', () => {
    const reports = [
      { skillPath: '/a/SKILL.md', issues: [{ severity: 'error', code: 'NO_FRONTMATTER' }], tokenEstimate: 1000 },
      { skillPath: '/b/SKILL.md', issues: [], tokenEstimate: 500 },
      { skillPath: '/c/SKILL.md', issues: [{ severity: 'warning', code: 'DESCRIPTION_TOO_SHORT' }], tokenEstimate: 200 },
    ];
    const s = summarizeLint(reports);
    assert.equal(s.totalSkills, 3);
    assert.equal(s.clean, 1);
    assert.equal(s.bySeverity.error, 1);
    assert.equal(s.bySeverity.warning, 1);
    assert.equal(s.totalTokens, 1700);
    assert.equal(s.topByTokens[0].path, '/a/SKILL.md');
  });
});
