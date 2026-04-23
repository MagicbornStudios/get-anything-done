'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');

const { composePrompt } = require('../lib/team/prompt.cjs');

describe('team worker prompt', () => {
  test('includes verification constraint before discipline', () => {
    const prompt = composePrompt(
      {
        kind: 'handoff',
        ref: 'h-sample',
        projectid: 'global',
        body: '# Sample handoff',
      },
      { workerId: 'w1', lane: 'codex-cli' },
    );

    const constraintIndex = prompt.indexOf('VERIFICATION CONSTRAINT:');
    const disciplineIndex = prompt.indexOf('Discipline:');

    assert.ok(constraintIndex > -1, 'constraint heading is present');
    assert.ok(disciplineIndex > -1, 'discipline heading is present');
    assert.ok(constraintIndex < disciplineIndex, 'constraint precedes discipline');
    assert.match(prompt, /Do NOT run `gad self install` or `gad self build`/);
    assert.match(prompt, /node vendor\/get-anything-done\/bin\/gad\.cjs <args>/);
    assert.match(prompt, /git commit --no-verify/);
  });
});
