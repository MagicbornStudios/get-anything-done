/**
 * Verifies `gad evolution promote --projectid <id>` (project scope, slm-learning-209):
 *   1. Locates proto-skill at <projectRoot>/.planning/proto-skills/<slug>/
 *   2. Promotes to <projectRoot>/skills/<slug>/ + <projectRoot>/workflows/<slug>.md
 *   3. Awards PROJECT XP (bumps <level> in <projectRoot>/.planning/STATE.xml)
 *   4. Does NOT touch framework canonical (no cross-contamination)
 *   5. Reaches level-up readiness at xp >= xp_to_next
 *
 * And that `gad evolution promote --framework` still works as before, awarding
 * framework XP only (no project-side write).
 */

process.env.GAD_TEST_MODE = '1';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');

const GAD_CLI = path.resolve(__dirname, '..', 'bin', 'gad.cjs');

function runGad(args, cwd, env) {
  return spawnSync('node', [GAD_CLI, ...args], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, ...(env || {}) },
  });
}

function writeProtoSkillBundle(protoDir, slug) {
  fs.mkdirSync(protoDir, { recursive: true });
  fs.writeFileSync(
    path.join(protoDir, 'SKILL.md'),
    [
      '---',
      `name: ${slug}`,
      'status: proto',
      'workflow: ./workflow.md',
      'description: >-',
      '  Project-scope promote XP smoke test fixture.',
      '---',
      '',
      `# ${slug}`,
      '',
      'Project-scope test fixture.',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(protoDir, 'workflow.md'),
    '# Workflow body\n\nProject-scope sibling workflow.\n'
  );
  fs.writeFileSync(
    path.join(protoDir, 'PROVENANCE.md'),
    `# Provenance\n\ncandidate: ${slug}\nstatus: complete\n`
  );
}

function writeProjectScaffold(tmpRoot, projectId) {
  // gad-config.toml at root pointing at the project root.
  const configPath = path.join(tmpRoot, 'gad-config.toml');
  fs.writeFileSync(
    configPath,
    [
      '[[planning.roots]]',
      `id = "${projectId}"`,
      `path = "${projectId}"`,
      'planningDir = ".planning"',
      '',
    ].join('\n')
  );

  const projectRoot = path.join(tmpRoot, projectId);
  fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });

  const stateXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<state project="${projectId}" schema="1">`,
    '  <status>active</status>',
    '  <level value="1" xp="0" xp_to_next="100" loaded_skills="0"/>',
    '</state>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(projectRoot, '.planning', 'STATE.xml'), stateXml);

  return projectRoot;
}

function readLevel(stateXmlPath) {
  const xml = fs.readFileSync(stateXmlPath, 'utf8');
  const m = xml.match(/<level\s+value="(\d+)"\s+xp="(\d+(?:\.\d+)?)"\s+xp_to_next="(\d+)"\s+loaded_skills="(\d+)"\/?>/);
  if (!m) return null;
  return { value: parseInt(m[1], 10), xp: parseFloat(m[2]), xpToNext: parseInt(m[3], 10), loadedSkills: parseInt(m[4], 10) };
}

describe('gad evolution promote --projectid → project XP (slm-learning-209)', () => {
  let tmpRoot;
  let projectRoot;
  const projectId = 'pxp-fixture';
  const slug = 'project-xp-fixture-skill';

  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-promote-pxp-'));
    projectRoot = writeProjectScaffold(tmpRoot, projectId);
  });

  beforeEach(() => {
    // Reset proto-skill bundle + STATE.xml + final dirs between tests.
    const protoDir = path.join(projectRoot, '.planning', 'proto-skills', slug);
    if (fs.existsSync(protoDir)) fs.rmSync(protoDir, { recursive: true, force: true });
    const skillsDir = path.join(projectRoot, 'skills');
    if (fs.existsSync(skillsDir)) fs.rmSync(skillsDir, { recursive: true, force: true });
    const workflowsDir = path.join(projectRoot, 'workflows');
    if (fs.existsSync(workflowsDir)) fs.rmSync(workflowsDir, { recursive: true, force: true });
    writeProtoSkillBundle(protoDir, slug);
    // Reset STATE.xml level to xp=0
    const statePath = path.join(projectRoot, '.planning', 'STATE.xml');
    fs.writeFileSync(statePath, [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<state project="${projectId}" schema="1">`,
      '  <status>active</status>',
      '  <level value="1" xp="0" xp_to_next="100" loaded_skills="0"/>',
      '</state>',
      '',
    ].join('\n'));
  });

  after(() => {
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('project promote relocates bundle into <projectRoot>/skills + workflows', () => {
    const result = runGad(
      ['evolution', 'promote', slug, '--projectid', projectId],
      tmpRoot
    );
    assert.strictEqual(result.status, 0, `CLI exit failed: ${result.stderr}\n${result.stdout}`);

    // Skill landed at projectRoot, NOT at framework canonical.
    const promotedSkillDir = path.join(projectRoot, 'skills', slug);
    assert.ok(fs.existsSync(promotedSkillDir), 'project-local skills/<slug>/ created');
    assert.ok(fs.existsSync(path.join(promotedSkillDir, 'SKILL.md')), 'SKILL.md copied');
    assert.ok(fs.existsSync(path.join(promotedSkillDir, 'PROVENANCE.md')), 'PROVENANCE.md copied');

    const canonicalWorkflow = path.join(projectRoot, 'workflows', `${slug}.md`);
    assert.ok(fs.existsSync(canonicalWorkflow), 'project-local workflows/<slug>.md created');

    // Proto dir cleaned.
    const protoDir = path.join(projectRoot, '.planning', 'proto-skills', slug);
    assert.ok(!fs.existsSync(protoDir), 'project-local proto-skill dir removed');

    // Framework canonical untouched.
    const fwCanonicalSkill = path.resolve(__dirname, '..', 'skills', slug);
    assert.ok(!fs.existsSync(fwCanonicalSkill), 'framework skills/ not contaminated');
  });

  test('project promote awards +8 XP to project STATE.xml', () => {
    const before = readLevel(path.join(projectRoot, '.planning', 'STATE.xml'));
    assert.strictEqual(before.xp, 0, 'starts at 0 xp');

    const result = runGad(
      ['evolution', 'promote', slug, '--projectid', projectId],
      tmpRoot
    );
    assert.strictEqual(result.status, 0, `CLI exit: ${result.stderr}`);

    const after = readLevel(path.join(projectRoot, '.planning', 'STATE.xml'));
    assert.strictEqual(after.xp, 8, 'project XP bumped by promote weight 8');
    assert.strictEqual(after.value, 1, 'level not auto-advanced (level-up command does that)');
    assert.strictEqual(after.xpToNext, 100, 'xp_to_next unchanged');

    // CLI output mentions "+8 XP (project)"
    assert.match(result.stdout, /\+8 XP \(project\)/, 'XP award message printed');
  });

  test('repeated promotes accumulate XP and trigger level-up readiness', () => {
    // Set up 13 promotions worth (13 * 8 = 104 >= 100 threshold).
    // Each iteration writes a fresh bundle then promotes it.
    const statePath = path.join(projectRoot, '.planning', 'STATE.xml');
    for (let i = 0; i < 13; i += 1) {
      const iterSlug = `${slug}-${i}`;
      const protoDir = path.join(projectRoot, '.planning', 'proto-skills', iterSlug);
      writeProtoSkillBundle(protoDir, iterSlug);
      const r = runGad(['evolution', 'promote', iterSlug, '--projectid', projectId], tmpRoot);
      assert.strictEqual(r.status, 0, `iter ${i} failed: ${r.stderr}`);
    }
    const finalLevel = readLevel(statePath);
    assert.ok(finalLevel.xp >= finalLevel.xpToNext, `xp ${finalLevel.xp} should reach threshold ${finalLevel.xpToNext}`);
    assert.strictEqual(finalLevel.value, 1, 'level cache stays at 1 until level-up command runs');
  });

  test('--projectid + --framework conflict errors out', () => {
    const result = runGad(
      ['evolution', 'promote', slug, '--projectid', projectId, '--framework'],
      tmpRoot
    );
    assert.notStrictEqual(result.status, 0, 'mutually-exclusive flags should fail');
    assert.match(result.stderr, /mutually exclusive/, 'error mentions mutual exclusion');
    // Bundle untouched.
    const protoDir = path.join(projectRoot, '.planning', 'proto-skills', slug);
    assert.ok(fs.existsSync(protoDir), 'proto-skill bundle preserved on flag-conflict refuse');
  });

  test('--projectid with unknown id errors out cleanly', () => {
    const result = runGad(
      ['evolution', 'promote', slug, '--projectid', 'no-such-project'],
      tmpRoot
    );
    assert.notStrictEqual(result.status, 0, 'unknown project id should fail');
    // resolveRoots prints either "No project resolved" or "Project not found"
    // depending on which surface intercepts first. Either is acceptable.
    assert.match(
      result.stderr,
      /(No project resolved|Project not found|no project)/i,
      'error mentions resolution failure'
    );
  });

  test('framework promote leaves project STATE.xml untouched (no cross-contamination)', () => {
    // Stage a framework-canonical proto-skill (separate from the project one)
    // and promote with --framework. Project STATE.xml must be unchanged.
    const fwSlug = 'fw-only-fixture';
    const fwProtoDir = path.resolve(__dirname, '..', '.planning', 'proto-skills', fwSlug);
    writeProtoSkillBundle(fwProtoDir, fwSlug);

    const projectStatePath = path.join(projectRoot, '.planning', 'STATE.xml');
    const beforeProject = readLevel(projectStatePath);

    const result = runGad(
      ['evolution', 'promote', fwSlug, '--framework'],
      path.resolve(__dirname, '..')
    );

    // Cleanup framework-canonical artifacts regardless of outcome.
    const fwSkillDir = path.resolve(__dirname, '..', 'skills', fwSlug);
    const fwWorkflow = path.resolve(__dirname, '..', 'workflows', `${fwSlug}.md`);
    if (fs.existsSync(fwSkillDir)) fs.rmSync(fwSkillDir, { recursive: true, force: true });
    if (fs.existsSync(fwWorkflow)) fs.rmSync(fwWorkflow);
    if (fs.existsSync(fwProtoDir)) fs.rmSync(fwProtoDir, { recursive: true, force: true });

    assert.strictEqual(result.status, 0, `framework promote failed: ${result.stderr}`);

    const afterProject = readLevel(projectStatePath);
    assert.deepStrictEqual(afterProject, beforeProject, 'project STATE.xml untouched by framework promote');
  });
});
