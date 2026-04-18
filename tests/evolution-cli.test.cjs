const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runGadCli, createTempProject, cleanup } = require('./helpers.cjs');

function writeConfig(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, 'gad-config.toml'), [
    '[planning]',
    '',
    '[[planning.roots]]',
    'id = "sample"',
    'path = "."',
    'planningDir = ".planning"',
    'discover = false',
    'enabled = true',
    '',
  ].join('\n'), 'utf8');
}

function writePlanning(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.xml'), [
    '<state>',
    '  <current-phase>55</current-phase>',
    '  <next-action>Finish evolution CLI wiring.</next-action>',
    '</state>',
    '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.xml'), [
    '<roadmap>',
    '  <phase id="55"><title>Phase 55</title><status>active</status><goal>Skill hygiene.</goal></phase>',
    '</roadmap>',
    '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'DECISIONS.xml'), '<decisions />\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml'), [
    '<task-registry>',
    '  <phase id="55">',
    '    <task id="55-01" status="done" skill="gad-plan-phase" type="framework"><goal>Do planning work.</goal></task>',
    '    <task id="55-02" status="done" skill="gad-plan-phase" type="framework"><goal>Repeat the same pattern.</goal></task>',
    '  </phase>',
    '</task-registry>',
    '',
  ].join('\n'), 'utf8');
}

function writeSkill(rootDir, id, lines) {
  const dir = path.join(rootDir, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), lines.join('\n'), 'utf8');
}

describe('evolution CLI surfaces', () => {
  let tmpDir;
  let skillsDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-evolution-cli-');
    skillsDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    writeConfig(tmpDir);
    writePlanning(tmpDir);
    writeSkill(skillsDir, 'gad-plan-phase', [
      '---',
      'name: gad-plan-phase',
      'description: This workflow skill is used enough to keep it out of the shed list.',
      'lane: dev',
      'type: workflow',
      'status: stable',
      '---',
      '',
      '## Workflow',
      '',
      'Plan the phase.',
      '',
    ]);
    writeSkill(skillsDir, 'unused-skill', [
      '---',
      'name: unused-skill',
      'description: This captured answer has enough text to keep the linter satisfied while remaining unused.',
      'lane: meta',
      'type: captured-answer',
      'status: stable',
      '---',
      '',
      '## Purpose',
      '',
      'Unused on purpose.',
      '',
    ]);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('skill token-audit prints the token summary', () => {
    const result = runGadCli(
      ['skill', 'token-audit', '--top', '1'],
      tmpDir,
      { GAD_SKILLS_DIR: skillsDir },
    );

    assert.equal(result.success, true, result.error);
    assert.match(result.output, /Skill token audit - 2 skills/);
    assert.match(result.output, /Top 1 bloat:/);
  });

  test('skill status shows type and usage metadata', () => {
    const result = runGadCli(
      ['skill', 'status', 'gad-plan-phase'],
      tmpDir,
      { GAD_SKILLS_DIR: skillsDir, GAD_PROTO_SKILLS_DIR: path.join(tmpDir, 'proto-skills') },
    );

    assert.equal(result.success, true, result.error);
    assert.match(result.output, /type:\s+workflow/);
    assert.match(result.output, /usage:\s+2 done tasks, 1 project/);
  });

  test('evolution scan writes the scan file and shed dry-run reports flagged skills', () => {
    const env = {
      GAD_SKILLS_DIR: skillsDir,
      GAD_PROTO_SKILLS_DIR: path.join(tmpDir, 'proto-skills'),
    };
    const scan = runGadCli(['evolution', 'scan', '--projectid', 'sample'], tmpDir, env);
    assert.equal(scan.success, true, scan.error);
    assert.match(scan.output, /Evolution scan: \d+ candidate\(s\), \d+ shed candidate\(s\)/);

    const scanFile = path.join(tmpDir, '.planning', '.evolution-scan.json');
    assert.equal(fs.existsSync(scanFile), true);
    const written = JSON.parse(fs.readFileSync(scanFile, 'utf8'));
    assert.equal(Array.isArray(written.shedCandidates), true);

    const shed = runGadCli(['evolution', 'shed', '--projectid', 'sample'], tmpDir, env);
    assert.equal(shed.success, true, shed.error);
    assert.match(shed.output, /Evolution shed dry-run:/);
    assert.match(shed.output, /unused-skill/);
  });
});
