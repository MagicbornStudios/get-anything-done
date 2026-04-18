/**
 * task-registry-writer.test.cjs — unit tests for lib/task-registry-writer.cjs.
 *
 * Pure tests — no real fs, no real XML parser. We exercise the writer
 * against hand-built minimal TASK-REGISTRY.xml strings.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  TaskWriterError,
  escapeXml,
  buildTaskElement,
  addTaskToXml,
  addPhaseToRegistryXml,
  appendTaskToFile,
  ensurePhaseInFile,
  updateTaskGoalInXml,
  updateTaskGoalInFile,
} = require('../lib/task-registry-writer.cjs');

const BASE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<task-registry>
  <phase id="01">
    <task id="01-01" type="code" status="done">
      <goal>Scaffold phase 01.</goal>
    </task>
    <task id="01-02" type="code" status="planned">
      <goal>Phase 01 follow-up.</goal>
      <depends>01-01</depends>
    </task>
  </phase>
  <phase id="02">
    <task id="02-01" type="design" status="planned">
      <goal>Design phase 02.</goal>
    </task>
  </phase>
</task-registry>
`;

function makeFsFake(initial) {
  const store = { [initial.path]: initial.content };
  return {
    store,
    readFileSync: (p) => {
      if (!(p in store)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return store[p];
    },
    writeFileSync: (p, data) => { store[p] = data; },
    renameSync: (a, b) => { store[b] = store[a]; delete store[a]; },
    unlinkSync: (p) => { delete store[p]; },
    existsSync: (p) => p in store,
  };
}

describe('task-registry-writer: escapeXml', () => {
  test('escapes &, <, >, ", \' in body text', () => {
    const out = escapeXml(`a & b <c> "d" 'e'`);
    assert.strictEqual(out, 'a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;');
  });
});

describe('task-registry-writer: buildTaskElement', () => {
  test('required fields produce a minimal well-formed element', () => {
    const xml = buildTaskElement({ id: '02-02', phase: '02', goal: 'Add thing.' });
    assert.match(xml, /<task id="02-02" status="planned">/);
    assert.match(xml, /<goal>Add thing\.<\/goal>/);
    assert.ok(xml.endsWith('</task>\n'));
  });

  test('type + depends render in the expected positions', () => {
    const xml = buildTaskElement({
      id: '02-03',
      phase: '02',
      goal: 'Another thing.',
      type: 'code',
      depends: '02-01,02-02',
      status: 'in-progress',
    });
    assert.match(xml, /<task id="02-03" type="code" status="in-progress">/);
    assert.match(xml, /<depends>02-01,02-02<\/depends>/);
  });

  test('goal body is XML-escaped', () => {
    const xml = buildTaskElement({
      id: 'X-1',
      phase: '01',
      goal: 'Compare <a> & <b> — quote "x".',
    });
    assert.match(xml, /&lt;a&gt; &amp; &lt;b&gt; — quote &quot;x&quot;/);
  });
});

describe('task-registry-writer: addTaskToXml happy path', () => {
  test('adds as the last child of the matching phase; other phases untouched', () => {
    const out = addTaskToXml(BASE_XML, {
      id: '01-03',
      phase: '01',
      goal: 'A new phase-01 task.',
      type: 'code',
      depends: '01-02',
    });

    // New task appears between 01-02 and </phase id="01">
    const phase1Match = out.match(/<phase id="01">[\s\S]*?<\/phase>/);
    assert.ok(phase1Match, 'phase 01 block should still exist');
    assert.match(phase1Match[0], /id="01-01"[\s\S]*id="01-02"[\s\S]*id="01-03"/);
    // Phase 02 contents are exactly preserved.
    assert.match(out, /<phase id="02">\s*<task id="02-01"[\s\S]*?<\/task>\s*<\/phase>/);
    // No duplicate tasks.
    assert.strictEqual((out.match(/id="01-03"/g) || []).length, 1);
  });

  test('preserves trailing indent on </phase> — no closing-tag drift', () => {
    const out = addTaskToXml(BASE_XML, { id: '02-02', phase: '02', goal: 'g' });
    // </phase> should still be at 2-space indent, exactly as in BASE_XML.
    assert.match(out, /\n  <\/phase>/);
    // And there should be exactly 2 </phase> closers (one per phase).
    assert.strictEqual((out.match(/<\/phase>/g) || []).length, 2);
  });

  test('id is globally unique — collision with a different phase throws TASK_ID_EXISTS', () => {
    assert.throws(
      () => addTaskToXml(BASE_XML, { id: '01-01', phase: '02', goal: 'collision' }),
      (e) => e instanceof TaskWriterError && e.code === 'TASK_ID_EXISTS',
    );
  });

  test('supports inserting into a phase with zero existing tasks', () => {
    const emptyPhase = `<task-registry>\n  <phase id="99">\n  </phase>\n</task-registry>\n`;
    const out = addTaskToXml(emptyPhase, { id: '99-01', phase: '99', goal: 'first task' });
    assert.match(out, /<phase id="99">\s*<task id="99-01"/);
    assert.match(out, /<\/task>\s*<\/phase>/);
  });
});

describe('task-registry-writer: addTaskToXml failure modes', () => {
  test('PHASE_NOT_FOUND when phase id has no matching element', () => {
    assert.throws(
      () => addTaskToXml(BASE_XML, { id: '03-01', phase: '03', goal: 'nope' }),
      (e) => e instanceof TaskWriterError && e.code === 'PHASE_NOT_FOUND',
    );
  });

  test('VALIDATION_FAILED when id is missing', () => {
    assert.throws(
      () => addTaskToXml(BASE_XML, { phase: '01', goal: 'no id' }),
      (e) => e instanceof TaskWriterError && e.code === 'VALIDATION_FAILED' && /id is required/.test(e.message),
    );
  });

  test('VALIDATION_FAILED when goal is missing or whitespace-only', () => {
    assert.throws(
      () => addTaskToXml(BASE_XML, { id: '01-03', phase: '01', goal: '   ' }),
      (e) => e instanceof TaskWriterError && e.code === 'VALIDATION_FAILED' && /goal is required/.test(e.message),
    );
  });

  test('VALIDATION_FAILED when id contains disallowed characters', () => {
    assert.throws(
      () => addTaskToXml(BASE_XML, { id: '01-03 bad/id', phase: '01', goal: 'x' }),
      (e) => e instanceof TaskWriterError && e.code === 'VALIDATION_FAILED' && /disallowed characters/.test(e.message),
    );
  });

  test('XML-special characters in goal body are rendered safely, not as markup', () => {
    const out = addTaskToXml(BASE_XML, {
      id: '01-03',
      phase: '01',
      goal: 'Support <tag> & "quotes" in the goal body.',
    });
    assert.match(out, /&lt;tag&gt; &amp; &quot;quotes&quot;/);
    // Roundtrip: the inserted markup must not have broken the document.
    // Crude check: the phase closer count is still exactly 2.
    assert.strictEqual((out.match(/<\/phase>/g) || []).length, 2);
  });
});

describe('task-registry-writer: phase container sync', () => {
  test('addPhaseToRegistryXml inserts a new empty phase container', () => {
    const out = addPhaseToRegistryXml(BASE_XML, '03');
    assert.equal(out.inserted, true);
    assert.match(out.xml, /<phase id="03">\s*<\/phase>/);
  });

  test('addPhaseToRegistryXml supports idempotent no-op mode', () => {
    const out = addPhaseToRegistryXml(BASE_XML, '01', { ifExists: 'noop' });
    assert.equal(out.inserted, false);
    assert.equal(out.xml, BASE_XML);
  });

  test('ensurePhaseInFile writes when missing and no-ops when present', () => {
    const fake = makeFsFake({ path: '/fake/TASK-REGISTRY.xml', content: BASE_XML });
    const inserted = ensurePhaseInFile({
      filePath: '/fake/TASK-REGISTRY.xml',
      phaseId: '03',
      fsImpl: fake,
    });
    assert.equal(inserted.inserted, true);
    assert.match(fake.store['/fake/TASK-REGISTRY.xml'], /<phase id="03">\s*<\/phase>/);

    const noop = ensurePhaseInFile({
      filePath: '/fake/TASK-REGISTRY.xml',
      phaseId: '03',
      fsImpl: fake,
    });
    assert.equal(noop.inserted, false);
  });
});

describe('task-registry-writer: update task goal', () => {
  test('updateTaskGoalInXml rewrites goal for an existing task', () => {
    const out = updateTaskGoalInXml(BASE_XML, {
      id: '01-02',
      goal: 'Updated phase 01 follow-up goal.',
    });
    assert.match(out, /<task id="01-02"[\s\S]*?<goal>Updated phase 01 follow-up goal\.<\/goal>/);
    assert.doesNotMatch(out, /<goal>Phase 01 follow-up\.<\/goal>/);
  });

  test('updateTaskGoalInXml throws TASK_NOT_FOUND for unknown id', () => {
    assert.throws(
      () => updateTaskGoalInXml(BASE_XML, { id: '99-99', goal: 'x' }),
      (e) => e instanceof TaskWriterError && e.code === 'TASK_NOT_FOUND',
    );
  });

  test('updateTaskGoalInFile writes updated XML atomically', () => {
    const fake = makeFsFake({ path: '/fake/TASK-REGISTRY.xml', content: BASE_XML });
    const out = updateTaskGoalInFile({
      filePath: '/fake/TASK-REGISTRY.xml',
      id: '02-01',
      goal: 'Design phase 02 (updated).',
      fsImpl: fake,
    });
    assert.match(out, /<task id="02-01"[\s\S]*?<goal>Design phase 02 \(updated\)\.<\/goal>/);
    assert.match(fake.store['/fake/TASK-REGISTRY.xml'], /Design phase 02 \(updated\)\./);
  });
});

describe('task-registry-writer: appendTaskToFile with fs fake', () => {
  test('happy path writes mutated XML atomically; tmp is cleaned up', () => {
    const fake = makeFsFake({ path: '/fake/TASK-REGISTRY.xml', content: BASE_XML });
    const out = appendTaskToFile({
      filePath: '/fake/TASK-REGISTRY.xml',
      def: { id: '01-03', phase: '01', goal: 'new task' },
      fsImpl: fake,
    });
    assert.match(out, /id="01-03"/);
    assert.strictEqual(fake.store['/fake/TASK-REGISTRY.xml'], out);
    // No leftover tmp files.
    const tmpKeys = Object.keys(fake.store).filter((k) => k.includes('.tmp-'));
    assert.deepStrictEqual(tmpKeys, []);
  });

  test('TASK_ID_EXISTS leaves the file untouched', () => {
    const fake = makeFsFake({ path: '/fake/TASK-REGISTRY.xml', content: BASE_XML });
    assert.throws(
      () => appendTaskToFile({
        filePath: '/fake/TASK-REGISTRY.xml',
        def: { id: '01-01', phase: '01', goal: 'dup' },
        fsImpl: fake,
      }),
      (e) => e instanceof TaskWriterError && e.code === 'TASK_ID_EXISTS',
    );
    assert.strictEqual(fake.store['/fake/TASK-REGISTRY.xml'], BASE_XML);
  });

  test('WRITE_FAILED on rename error cleans up tmp and preserves original', () => {
    const fake = makeFsFake({ path: '/fake/TASK-REGISTRY.xml', content: BASE_XML });
    // Force rename to fail by replacing the rename function.
    fake.renameSync = () => { throw new Error('EPERM: locked'); };
    assert.throws(
      () => appendTaskToFile({
        filePath: '/fake/TASK-REGISTRY.xml',
        def: { id: '01-03', phase: '01', goal: 'x' },
        fsImpl: fake,
      }),
      (e) => e instanceof TaskWriterError && e.code === 'WRITE_FAILED',
    );
    assert.strictEqual(fake.store['/fake/TASK-REGISTRY.xml'], BASE_XML);
    const tmpKeys = Object.keys(fake.store).filter((k) => k.includes('.tmp-'));
    assert.deepStrictEqual(tmpKeys, []);
  });
});
