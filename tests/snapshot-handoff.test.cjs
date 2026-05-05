'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  matchRelevantSkills,
  parseSkillFrontmatter,
  isUiHandoff,
  tokenize,
  DEFAULT_UI_MANDATORY,
} = require('../lib/skills/relevance-match.cjs');

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gad-handoff-'));
}

function writeSkill(rootDir, slug, frontmatter, body = '') {
  const dir = path.join(rootDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  const fmLines = ['---'];
  for (const [k, v] of Object.entries(frontmatter)) {
    if (Array.isArray(v)) fmLines.push(`${k}: [${v.map((s) => `"${s}"`).join(', ')}]`);
    else fmLines.push(`${k}: ${v}`);
  }
  fmLines.push('---');
  fmLines.push('');
  fmLines.push(body);
  fs.writeFileSync(path.join(dir, 'SKILL.md'), fmLines.join('\n'));
  return path.join(dir, 'SKILL.md');
}

describe('relevance-match', () => {
  test('parseSkillFrontmatter handles list, scalar, folded', () => {
    const raw = '---\nname: foo\nruntime: [codex-cli, gemini-cli]\ndescription: >-\n  multi-line description\n  continuing here\n---\nbody text\n';
    const { frontmatter, body } = parseSkillFrontmatter(raw);
    assert.equal(frontmatter.name, 'foo');
    assert.deepEqual(frontmatter.runtime, ['codex-cli', 'gemini-cli']);
    assert.match(body, /body text/);
  });

  test('isUiHandoff triggers on .tsx, components/, frontend keywords', () => {
    assert.ok(isUiHandoff('please edit app/page.tsx', '', ''));
    assert.ok(isUiHandoff('', 'redesign frontend layout', ''));
    assert.ok(isUiHandoff('', '', 'wire components/Button styling'));
    assert.ok(!isUiHandoff('CLI internals refactor', 'rename a domain key', 'register lib/handoffs.cjs helpers'));
  });

  test('runtime-tagged skill matches matching runtime_preference', () => {
    const tmp = mkTmp();
    writeSkill(tmp, 'codex-cli-runtime-preflight', {
      name: 'codex-cli-runtime-preflight',
      runtime: ['codex-cli'],
      description: 'Run codex-cli preflight',
    }, 'preflight body');
    writeSkill(tmp, 'unrelated-skill', {
      name: 'unrelated-skill',
      runtime: ['gemini-cli'],
      description: 'Different lane entirely',
    }, '...');

    const matched = matchRelevantSkills({
      handoffFrontmatter: { runtime_preference: 'codex-cli', task_id: '107-10' },
      handoffBody: 'fix codex-cli preflight regression',
      phaseTitle: 'Phase 107 — codex preflight',
      taskGoal: 'wire codex-cli preflight check before dispatch',
      skillRoots: [{ dir: tmp, source: 'test' }],
    });

    assert.ok(matched.length >= 1);
    assert.equal(matched[0].slug, 'codex-cli-runtime-preflight');
    assert.match(matched[0].match_reason, /runtime=codex-cli/);
  });

  test('mandatory UI triplets auto-load on UI handoffs', () => {
    const tmp = mkTmp();
    for (const slug of DEFAULT_UI_MANDATORY) {
      writeSkill(tmp, slug, { name: slug, description: `${slug} description` }, `body of ${slug}`);
    }
    const matched = matchRelevantSkills({
      handoffFrontmatter: { runtime_preference: 'claude-code' },
      handoffBody: 'edit components/Button.tsx for new style',
      phaseTitle: 'UI redesign',
      taskGoal: 'frontend layout polish',
      skillRoots: [{ dir: tmp, source: 'test' }],
    });
    const slugs = matched.map((m) => m.slug);
    for (const slug of DEFAULT_UI_MANDATORY) {
      assert.ok(slugs.includes(slug), `expected mandatory slug ${slug} to be present`);
    }
    for (const m of matched) {
      if (DEFAULT_UI_MANDATORY.includes(m.slug)) assert.match(m.match_reason, /mandatory/);
    }
  });

  test('non-UI handoff does NOT auto-load UI triplets', () => {
    const tmp = mkTmp();
    for (const slug of DEFAULT_UI_MANDATORY) {
      writeSkill(tmp, slug, { name: slug, description: `${slug} description` }, `body of ${slug}`);
    }
    const matched = matchRelevantSkills({
      handoffFrontmatter: { runtime_preference: 'codex-cli' },
      handoffBody: 'refactor lib/handoffs.cjs frontmatter parser',
      phaseTitle: 'Library hygiene',
      taskGoal: 'clean up parseFrontmatter',
      skillRoots: [{ dir: tmp, source: 'test' }],
    });
    const slugs = matched.map((m) => m.slug);
    for (const slug of DEFAULT_UI_MANDATORY) {
      assert.ok(!slugs.includes(slug), `mandatory UI slug ${slug} should NOT load on non-UI handoff`);
    }
  });

  test('tokenize drops stopwords + short tokens', () => {
    const toks = tokenize('the gad CLI is broken on codex-cli runtime preflight');
    assert.ok(toks.includes('broken'));
    assert.ok(toks.includes('codex'));
    assert.ok(!toks.includes('the'));
    assert.ok(!toks.includes('on'));
    assert.ok(!toks.includes('cli')); // stopword in our list
  });
});

describe('snapshot --handoff smoke', () => {
  test('handleHandoffSnapshot emits skills + handoff sections', () => {
    const { emitSkillsSection, emitHandoffSection } = require('../bin/commands/snapshot/handoff.cjs');
    const matched = [{
      slug: 'codex-cli-runtime-preflight',
      source: 'test',
      score: 5,
      match_reason: 'runtime=codex-cli',
      raw: '---\nname: codex-cli-runtime-preflight\n---\nbody verbatim\n',
    }];
    const skillsOut = emitSkillsSection(matched);
    assert.match(skillsOut, /## Loaded skills/);
    assert.match(skillsOut, /### Skill: codex-cli-runtime-preflight/);
    assert.match(skillsOut, /body verbatim/);

    const handoffOut = emitHandoffSection('h-2026-test-x', { projectid: 'global', phase: '107', task_id: '107-10', runtime_preference: 'codex-cli' }, 'do the thing');
    assert.match(handoffOut, /## Handoff/);
    assert.match(handoffOut, /\*\*Handoff ID:\*\* h-2026-test-x/);
    assert.match(handoffOut, /do the thing/);
  });
});
