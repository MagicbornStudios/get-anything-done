/**
 * Task attribution enforcement test (GAD-D-104).
 *
 * Every task with status="done" in .planning/TASK-REGISTRY.xml MUST carry
 * three attributes:
 *   - agent-id="..."  — which coding agent / subagent completed it
 *   - skill="..."     — which GAD skill (or comma-list) was used
 *   - type="..."      — category (framework, cli, site, eval, etc.)
 *
 * Why: without attribution, /skills and /agents usage tabs are empty and
 * self-eval can't derive real stats from TASK-REGISTRY. We mandated this
 * in GAD-D-104 but never enforced it — this test enforces it going forward.
 *
 * Grace window: historical tasks before 2026-04-12 are exempt. New tasks
 * marked done after that date must be attributed. This keeps the test from
 * breaking on existing unattributed history while catching new violations.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const registryPath = path.join(repoRoot, '.planning', 'TASK-REGISTRY.xml');

// Tasks completed before this date are not required to carry attribution.
// New tasks (status="done") marked done after this date must be attributed.
const GRACE_CUTOFF = '2026-04-12';

function parseTasks(xml) {
  const tasks = [];
  const taskRe = /<task\s([^>]*)>([\s\S]*?)<\/task>/g;
  let m;
  while ((m = taskRe.exec(xml)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const get = (name) => {
      const rx = new RegExp(`(?<![a-z-])${name}="([^"]*)"`);
      const match = attrs.match(rx);
      return match ? match[1] : '';
    };
    const id = get('id');
    if (!id) continue;
    const status = (get('status') || 'planned').toLowerCase();
    const agentId = get('agent-id') || get('agent');
    const skill = get('skill');
    const type = get('type');
    const completedMatch = body.match(/<completed>([\s\S]*?)<\/completed>/);
    const completed = completedMatch ? completedMatch[1].trim() : '';
    tasks.push({ id, status, agentId, skill, type, completed });
  }
  return tasks;
}

describe('Task attribution enforcement (GAD-D-104)', () => {
  if (!fs.existsSync(registryPath)) {
    test('TASK-REGISTRY.xml exists', () => {
      assert.fail('TASK-REGISTRY.xml not found at ' + registryPath);
    });
    return;
  }

  const xml = fs.readFileSync(registryPath, 'utf8');
  const tasks = parseTasks(xml);

  // Only enforce on tasks completed after the grace cutoff. Tasks without a
  // <completed> date are assumed historical.
  const newlyDone = tasks.filter(
    (t) => t.status === 'done' && t.completed && t.completed > GRACE_CUTOFF,
  );

  test(`${newlyDone.length} newly-completed tasks all have agent-id set`, () => {
    const missing = newlyDone.filter((t) => !t.agentId);
    assert.strictEqual(
      missing.length,
      0,
      'Tasks completed after ' +
        GRACE_CUTOFF +
        ' missing agent-id="..." (GAD-D-104): ' +
        missing.map((t) => t.id).join(', '),
    );
  });

  test(`${newlyDone.length} newly-completed tasks all have skill set`, () => {
    const missing = newlyDone.filter((t) => !t.skill);
    assert.strictEqual(
      missing.length,
      0,
      'Tasks completed after ' +
        GRACE_CUTOFF +
        ' missing skill="..." (GAD-D-104): ' +
        missing.map((t) => t.id).join(', '),
    );
  });

  test(`${newlyDone.length} newly-completed tasks all have type set`, () => {
    const missing = newlyDone.filter((t) => !t.type);
    assert.strictEqual(
      missing.length,
      0,
      'Tasks completed after ' +
        GRACE_CUTOFF +
        ' missing type="..." (GAD-D-104): ' +
        missing.map((t) => t.id).join(', '),
    );
  });
});
