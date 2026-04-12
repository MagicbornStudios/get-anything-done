/**
 * Cursor conversion regression tests.
 *
 * Ensures Cursor frontmatter names are emitted as plain identifiers
 * (without surrounding quotes), so Cursor does not treat quotes as
 * literal parts of skill/subagent names.
 */

process.env.GAD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert');

const {
  convertClaudeCommandToCursorSkill,
  convertClaudeAgentToCursorAgent,
} = require('../bin/install.js');

describe('convertClaudeCommandToCursorSkill', () => {
  test('writes unquoted Cursor skill name in frontmatter', () => {
    const input = `---
name: quick
description: Execute a quick task
---

<objective>
Test body
</objective>
`;

    const result = convertClaudeCommandToCursorSkill(input, 'gad-quick');
    const nameMatch = result.match(/^name:\s*(.+)$/m);

    assert.ok(nameMatch, 'frontmatter contains name field');
    assert.strictEqual(nameMatch[1], 'gad-quick', 'skill name is plain scalar');
    assert.ok(!result.includes('name: "gad-quick"'), 'quoted skill name is not emitted');
  });

  test('preserves slash for slash commands in markdown body', () => {
    const input = `---
name: gad:plan-phase
description: Plan a phase
---

Next:
/gad:execute-phase 17
/gad-help
gad:progress
`;

    const result = convertClaudeCommandToCursorSkill(input, 'gad-plan-phase');

    assert.ok(result.includes('/gad-execute-phase 17'), 'slash command remains slash-prefixed');
    assert.ok(result.includes('/gad-help'), 'existing slash command is preserved');
    assert.ok(result.includes('gad-progress'), 'non-slash gad: references still normalize');
    assert.ok(!result.includes('/gad:execute-phase'), 'legacy colon command form is removed');
  });
});

describe('convertClaudeAgentToCursorAgent', () => {
  test('writes unquoted Cursor agent name in frontmatter', () => {
    const input = `---
name: gad-planner
description: Planner agent
tools: Read, Write
color: green
---

<role>
Planner body
</role>
`;

    const result = convertClaudeAgentToCursorAgent(input);
    const nameMatch = result.match(/^name:\s*(.+)$/m);

    assert.ok(nameMatch, 'frontmatter contains name field');
    assert.strictEqual(nameMatch[1], 'gad-planner', 'agent name is plain scalar');
    assert.ok(!result.includes('name: "gad-planner"'), 'quoted agent name is not emitted');
  });
});
