const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runGadCli, createTempProject, cleanup } = require('./helpers.cjs');

function writeFixtureProject(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, 'config.json'),
    JSON.stringify({
      planning: {
        id: 'sample',
        planningDir: '.planning',
        sub_repos: [],
      },
    }, null, 2),
    'utf8',
  );

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase>41</current-phase>
  <status>active</status>
  <next-action>Implement scoped snapshots.</next-action>
</state>
`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <phase id="41">
    <title>Scoped snapshots + assignments</title>
    <goal>Ship scoped snapshots and agent lanes.</goal>
    <status>in-progress</status>
    <depends>35</depends>
  </phase>
</roadmap>
`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<task-registry>
  <phase id="41">
    <task id="41-01" status="planned">
      <goal>Build the query slice.</goal>
      <keywords>sdk,query</keywords>
    </task>
    <task id="41-02" status="planned">
      <goal>Ship scoped snapshots.</goal>
      <keywords>snapshot,scope</keywords>
    </task>
    <task id="41-03" status="planned">
      <goal>Add task claims.</goal>
      <keywords>tasks,claims</keywords>
    </task>
  </phase>
</task-registry>
`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'DECISIONS.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <decision id="gad-147">
    <title>Workstreams are scoped execution contexts</title>
    <summary>Keep one planning tree.</summary>
    <impact>Snapshot scopes context instead of duplicating files.</impact>
  </decision>
</decisions>
`,
    'utf8',
  );
}

describe('snapshot agent lanes', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-snapshot-lanes-');
    writeFixtureProject(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('scoped snapshot auto-registers a root lane and returns agent metadata', () => {
    const result = runGadCli(['snapshot', '--projectid', 'sample', '--taskid', '41-02', '--runtime', 'codex', '--json'], tmpDir);
    assert.ok(result.success, `snapshot failed: ${result.error}`);

    const payload = JSON.parse(result.output);
    assert.equal(payload.mode, 'scoped');
    assert.equal(payload.scope.snapshotMode, 'task');
    assert.equal(payload.scope.taskId, '41-02');
    assert.equal(payload.agent.runtime, 'codex');
    assert.match(payload.agent.agentId, /^codex-default-\d{4}$/);
    assert.equal(payload.agent.depth, 0);
    assert.equal(payload.agent.autoRegistered, true);

    const lanesPath = path.join(tmpDir, '.planning', '.gad-agent-lanes.json');
    assert.ok(fs.existsSync(lanesPath), 'lane state file should be created');
    const lanes = JSON.parse(fs.readFileSync(lanesPath, 'utf8'));
    assert.equal(lanes.agents.length, 1);
    assert.equal(lanes.agents[0].agentId, payload.agent.agentId);
  });

  test('depth limit rejects subagent-of-subagent bootstrap', () => {
    const root = JSON.parse(runGadCli(['snapshot', '--projectid', 'sample', '--taskid', '41-01', '--runtime', 'claude-code', '--json'], tmpDir).output);
    const child = JSON.parse(runGadCli([
      'snapshot',
      '--projectid', 'sample',
      '--taskid', '41-02',
      '--runtime', 'claude-code',
      '--role', 'gad-planner',
      '--parent-agentid', root.agent.agentId,
      '--json',
    ], tmpDir).output);

    assert.equal(child.agent.depth, 1);
    assert.equal(child.agent.parentAgentId, root.agent.agentId);

    const grandchild = runGadCli([
      'snapshot',
      '--projectid', 'sample',
      '--taskid', '41-03',
      '--runtime', 'claude-code',
      '--role', 'gad-executor',
      '--parent-agentid', child.agent.agentId,
      '--json',
    ], tmpDir);

    assert.equal(grandchild.success, false);
    assert.match(grandchild.error, /Maximum depth is 1/i);
  });
});

describe('task claim lifecycle', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-task-claims-');
    writeFixtureProject(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('claim, active, and release update task registry and lane state', () => {
    const claim = runGadCli(['tasks', 'claim', '41-02', '--projectid', 'sample', '--runtime', 'codex', '--json'], tmpDir);
    assert.ok(claim.success, `claim failed: ${claim.error}`);
    const claimPayload = JSON.parse(claim.output);
    assert.equal(claimPayload.task.status, 'in-progress');
    assert.equal(claimPayload.task.agentId, claimPayload.agent.agentId);
    assert.equal(claimPayload.task.runtime, 'codex');

    const active = runGadCli(['tasks', 'active', '--projectid', 'sample', '--json'], tmpDir);
    assert.ok(active.success, `active failed: ${active.error}`);
    const activePayload = JSON.parse(active.output);
    assert.equal(activePayload.totalActiveTasks, 1);
    assert.equal(activePayload.totalActiveAgents, 1);
    assert.equal(activePayload.projects[0].activeTasks[0].id, '41-02');

    const release = runGadCli([
      'tasks', 'release', '41-02',
      '--projectid', 'sample',
      '--agentid', claimPayload.agent.agentId,
      '--done',
      '--json',
    ], tmpDir);
    assert.ok(release.success, `release failed: ${release.error}`);
    const releasePayload = JSON.parse(release.output);
    assert.equal(releasePayload.task.status, 'done');
    assert.equal(releasePayload.task.agentId, claimPayload.agent.agentId, 'done tasks keep attribution');

    const activeAfter = JSON.parse(runGadCli(['tasks', 'active', '--projectid', 'sample', '--json'], tmpDir).output);
    assert.equal(activeAfter.totalActiveTasks, 0);
  });
});
