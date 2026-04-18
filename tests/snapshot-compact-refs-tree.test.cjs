'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  compactRefsTree,
  compactStateXml,
} = require('../lib/snapshot-compact.cjs');

describe('compactRefsTree (decision gad-241, task 42.4-24)', () => {
  test('returns empty string for empty input', () => {
    assert.equal(compactRefsTree([]), '');
    assert.equal(compactRefsTree(null), '');
    assert.equal(compactRefsTree(undefined), '');
  });

  test('falls back to flat form below threshold', () => {
    const refs = ['a.md', 'b.md', 'c.md'];
    const out = compactRefsTree(refs);
    assert.equal(out, '- a.md\n- b.md\n- c.md');
  });

  test('emits indented tree above threshold with shared prefixes grouped', () => {
    const refs = [
      '.planning/ROADMAP.xml',
      '.planning/TASK-REGISTRY.xml',
      '.planning/workflows/gad-loop.md',
      '.planning/workflows/gad-debug.md',
      'references/skill-shape.md',
    ];
    const out = compactRefsTree(refs);
    assert.ok(out.includes('.planning/\n'), 'top-level dir header');
    assert.ok(out.includes('  ROADMAP.xml'), 'leaf indented under parent');
    assert.ok(out.includes('  workflows/\n'), 'nested dir header indented');
    assert.ok(out.includes('    gad-loop.md'), 'leaf under nested dir');
    // references/ has exactly one leaf → folded to a single line "references/skill-shape.md"
    assert.ok(out.includes('references/skill-shape.md'), 'single-leaf sibling folded');
  });

  test('collapses single-child dir chains', () => {
    const refs = [
      'sdk/src/init-runner.ts',
      'sdk/src/context-engine.ts',
      '.planning/ROADMAP.xml',
      '.planning/STATE.xml',
      'references/skill-shape.md',
    ];
    const out = compactRefsTree(refs);
    assert.ok(out.includes('sdk/src/\n'), 'sdk/src/ collapsed (no leaves at sdk level)');
    assert.ok(out.includes('  init-runner.ts'), 'leaves under collapsed chain');
    assert.ok(out.includes('  context-engine.ts'));
  });

  test('does not collapse when parent has leaves at its level', () => {
    const refs = [
      '.planning/STATE.xml',
      '.planning/workflows/gad-loop.md',
      '.planning/workflows/gad-debug.md',
      'references/a.md',
      'references/b.md',
    ];
    const out = compactRefsTree(refs);
    assert.ok(out.includes('.planning/\n'), 'kept expanded');
    assert.ok(!out.includes('.planning/workflows/\n.'), 'not joined past STATE.xml sibling');
    // STATE.xml is a leaf inside .planning/ — indented one level past its parent
    const lines = out.split('\n');
    const stateIdx = lines.findIndex(l => l.trim() === 'STATE.xml');
    assert.ok(stateIdx >= 0, 'STATE.xml appears');
    assert.equal(lines[stateIdx], '    STATE.xml', 'STATE.xml nested under .planning/ header');
  });

  test('preserves parenthetical annotations on leaves', () => {
    const refs = [
      '.planning/ROADMAP.xml (phases 42.1, 42.2)',
      '.planning/TASK-REGISTRY.xml (includes 42.4-20)',
      '.planning/DECISIONS.xml (gad-225)',
      '.planning/STATE.xml',
      '.planning/CONVENTIONS.md',
    ];
    const out = compactRefsTree(refs);
    assert.ok(out.includes('ROADMAP.xml (phases 42.1, 42.2)'), 'annotation pinned to leaf');
    assert.ok(out.includes('TASK-REGISTRY.xml (includes 42.4-20)'));
  });

  test('preserves duplicate leaf names with distinct annotations', () => {
    const refs = [
      'bin/gad.cjs (workspace commands)',
      'bin/gad.cjs (evolution commands)',
      'bin/gad-config.cjs',
      'bin/gad-tools.cjs',
      'bin/gad-mcp.cjs',
    ];
    const out = compactRefsTree(refs);
    assert.ok(out.match(/gad\.cjs.*workspace/), 'first gad.cjs annotation preserved');
    assert.ok(out.match(/gad\.cjs.*evolution/), 'second gad.cjs annotation preserved');
  });

  test('handles trailing-slash directory leaves', () => {
    const refs = [
      'tmp/get-shit-done/ (mirror pin 62b5278)',
      'evals/escape-the-dungeon/species/vcs-test/',
      'bin/gad.cjs',
      'bin/gad-config.cjs',
      'references/skill-shape.md',
    ];
    const out = compactRefsTree(refs);
    assert.ok(out.includes('get-shit-done/ (mirror pin 62b5278)'), 'trailing-slash dir preserved on leaf');
  });

  test('token savings vs flat form on realistic refs', () => {
    const refs = [
      '.planning/ROADMAP.xml',
      '.planning/TASK-REGISTRY.xml',
      '.planning/DECISIONS.xml',
      '.planning/workflows/README.md',
      '.planning/workflows/gad-loop.md',
      '.planning/workflows/gad-discuss-plan-execute.md',
      '.planning/workflows/gad-decide.md',
      '.planning/workflows/gad-debug.md',
      '.planning/workflows/gad-evolution.md',
      '.planning/workflows/gad-findings.md',
      '.planning/notes/upstream-gsd-review-2026-04-14.md',
      '.planning/notes/context-engine-hydration-questions-2026-04-14.md',
      'references/skill-shape.md',
      'references/proto-skills.md',
      'references/pressure-formula.md',
      'references/project-assets.md',
      'references/framework-comparison-matrix.md',
      'skills/gad-evolution-evolve/SKILL.md',
      'skills/gad-evolution-validator/SKILL.md',
      'skills/gad-quick-skill/SKILL.md',
      'site/scripts/build-site-data.mjs',
      'site/scripts/compute-self-eval.mjs',
      'site/lib/catalog.generated.ts',
      'site/app/formulas/page.tsx',
      'bin/gad.cjs',
      'bin/gad-config.cjs',
      'bin/gad-tools.cjs',
      'bin/gad-mcp.cjs',
      'sdk/src/init-runner.ts',
      'sdk/src/context-engine.ts',
      'workflows/gad-new-project.md',
      'workflows/settings.md',
    ];
    const flat = refs.map(r => `- ${r}`).join('\n');
    const tree = compactRefsTree(refs);
    assert.ok(tree.length < flat.length, `tree (${tree.length}B) should be smaller than flat (${flat.length}B)`);
    // Conservative floor — heavy shared prefixes (workflows/notes/src) save more than 10% bytes.
    // Token savings are typically larger than byte savings because shared prefix strings BPE-share.
    const savingsPct = 100 * (1 - tree.length / flat.length);
    assert.ok(savingsPct >= 10, `expected >=10% byte savings, got ${savingsPct.toFixed(1)}%`);
  });

  test('compactStateXml uses tree form for large refs lists', () => {
    const refs = Array.from({ length: 10 }, (_, i) => `dir/sub/file-${i}.md`);
    const xml = `
<state>
  <current-phase>42.4</current-phase>
  <references>
    ${refs.map(r => `<reference>${r}</reference>`).join('\n    ')}
  </references>
</state>`;
    const out = compactStateXml(xml);
    assert.ok(out.includes('refs:\n'), 'refs header emitted');
    assert.ok(out.includes('dir/sub/\n') || out.includes('dir/sub/'), 'collapsed path header present');
    assert.ok(!out.includes('- dir/sub/file-0.md'), 'no flat-form dashes above threshold');
  });

  test('compactStateXml keeps flat form below threshold', () => {
    const refs = ['a.md', 'b.md'];
    const xml = `
<state>
  <current-phase>42.4</current-phase>
  <references>
    ${refs.map(r => `<reference>${r}</reference>`).join('\n    ')}
  </references>
</state>`;
    const out = compactStateXml(xml);
    assert.ok(out.includes('- a.md'), 'flat form preserved below threshold');
    assert.ok(out.includes('- b.md'));
  });
});
