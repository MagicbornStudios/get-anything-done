/**
 * Canonical skill record scan — uniform skill shape (decision gad-190).
 *
 * Verifies that readCanonicalSkillRecords prefers `workflow:` frontmatter
 * on SKILL.md, falls back to legacy `skill.json.commandPath`, and records
 * SKILL.md-only skills with a null commandPath.
 *
 * Uses node:test and node:assert.
 */

process.env.GAD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const {
  parseSkillFrontmatterWorkflow,
  readCanonicalSkillRecords,
} = require('../bin/install.js');

let tmpRoot;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-skill-shape-'));
});

afterEach(() => {
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

function writeSkill(dir, name, files) {
  const skillDir = path.join(dir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(skillDir, file), content);
  }
  return skillDir;
}

describe('parseSkillFrontmatterWorkflow', () => {
  test('extracts unquoted workflow value', () => {
    const skillFile = path.join(tmpRoot, 'SKILL.md');
    fs.writeFileSync(
      skillFile,
      '---\nname: gad-add-backlog\nworkflow: workflows/gad-add-backlog.md\n---\n\n# body'
    );
    assert.strictEqual(
      parseSkillFrontmatterWorkflow(skillFile),
      'workflows/gad-add-backlog.md'
    );
  });

  test('extracts double-quoted workflow value', () => {
    const skillFile = path.join(tmpRoot, 'SKILL.md');
    fs.writeFileSync(
      skillFile,
      '---\nname: gad-new-project\nworkflow: "workflows/gad-new-project.md"\n---\n\n# body'
    );
    assert.strictEqual(
      parseSkillFrontmatterWorkflow(skillFile),
      'workflows/gad-new-project.md'
    );
  });

  test('extracts single-quoted workflow value', () => {
    const skillFile = path.join(tmpRoot, 'SKILL.md');
    fs.writeFileSync(
      skillFile,
      "---\nname: gad-plan-phase\nworkflow: 'workflows/gad-plan-phase.md'\n---"
    );
    assert.strictEqual(
      parseSkillFrontmatterWorkflow(skillFile),
      'workflows/gad-plan-phase.md'
    );
  });

  test('returns null when no frontmatter block', () => {
    const skillFile = path.join(tmpRoot, 'SKILL.md');
    fs.writeFileSync(skillFile, '# just a body, no yaml block');
    assert.strictEqual(parseSkillFrontmatterWorkflow(skillFile), null);
  });

  test('returns null when frontmatter has no workflow key', () => {
    const skillFile = path.join(tmpRoot, 'SKILL.md');
    fs.writeFileSync(skillFile, '---\nname: create-skill\n---\n\n# body');
    assert.strictEqual(parseSkillFrontmatterWorkflow(skillFile), null);
  });

  test('handles sibling relative path for proto-skills', () => {
    const skillFile = path.join(tmpRoot, 'SKILL.md');
    fs.writeFileSync(
      skillFile,
      '---\nname: phase-44-5-editor\nstatus: proto\nworkflow: ./workflow.md\n---'
    );
    assert.strictEqual(parseSkillFrontmatterWorkflow(skillFile), './workflow.md');
  });

  test('returns null for missing file without throwing', () => {
    const missing = path.join(tmpRoot, 'does-not-exist.md');
    assert.strictEqual(parseSkillFrontmatterWorkflow(missing), null);
  });
});

describe('readCanonicalSkillRecords — frontmatter preferred', () => {
  test('prefers frontmatter workflow: over legacy skill.json', () => {
    writeSkill(tmpRoot, 'gad-add-backlog', {
      'SKILL.md':
        '---\nname: gad-add-backlog\nworkflow: workflows/gad-add-backlog.md\n---\n',
      'skill.json':
        '{"id":"gad-add-backlog","canonical":true,"source":"command","commandPath":"legacy-should-be-ignored.md"}',
    });
    const records = readCanonicalSkillRecords(tmpRoot);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].id, 'gad-add-backlog');
    // commandPath semantics: bare filename extracted from workflow basename
    assert.strictEqual(records[0].commandPath, 'gad-add-backlog.md');
  });

  test('falls back to skill.json.commandPath when no frontmatter workflow', () => {
    writeSkill(tmpRoot, 'gad-add-phase', {
      'SKILL.md': '---\nname: gad-add-phase\n---\n\n# body',
      'skill.json':
        '{"id":"gad-add-phase","canonical":true,"source":"command","commandPath":"add-phase.md"}',
      'COMMAND.md': '# add-phase command body',
    });
    const records = readCanonicalSkillRecords(tmpRoot);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].commandPath, 'add-phase.md');
    assert.ok(records[0].commandFile, 'commandFile should be set when COMMAND.md exists');
  });

  test('records SKILL.md-only skill with null commandPath', () => {
    writeSkill(tmpRoot, 'create-skill', {
      'SKILL.md': '---\nname: create-skill\ndescription: generic authoring skill\n---\n',
    });
    const records = readCanonicalSkillRecords(tmpRoot);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].commandPath, null);
    assert.strictEqual(records[0].commandFile, null);
  });

  test('extracts basename from nested workflow path', () => {
    writeSkill(tmpRoot, 'gad-debug', {
      'SKILL.md':
        '---\nname: gad-debug\nworkflow: workflows/gad-debug.md\n---\n',
    });
    const records = readCanonicalSkillRecords(tmpRoot);
    assert.strictEqual(records[0].commandPath, 'gad-debug.md');
  });

  test('scans nested subdirectories', () => {
    writeSkill(path.join(tmpRoot, 'nested'), 'gad-inner', {
      'SKILL.md':
        '---\nname: gad-inner\nworkflow: workflows/gad-inner.md\n---\n',
    });
    const records = readCanonicalSkillRecords(tmpRoot);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].id, 'gad-inner');
    assert.strictEqual(records[0].relPath, 'nested/gad-inner');
  });

  test('returns empty array for missing root', () => {
    const records = readCanonicalSkillRecords(path.join(tmpRoot, 'does-not-exist'));
    assert.deepStrictEqual(records, []);
  });
});
