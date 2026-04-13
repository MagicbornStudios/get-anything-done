import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, rm, writeFile } from 'node:fs/promises';

import { GADQuery } from './query/index.js';

async function writeFixtureProject(tmpDir: string): Promise<void> {
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
  await writeFile(join(tmpDir, '.planning', 'STATE.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase>41</current-phase>
  <status>active</status>
  <next-action>Implement query sdk.</next-action>
</state>
`);
  await writeFile(join(tmpDir, '.planning', 'ROADMAP.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <phase id="41">
    <title>Scoped snapshots + assignments</title>
    <goal>Ship scoped snapshots and agent lanes.</goal>
    <status>in-progress</status>
    <depends>35</depends>
  </phase>
</roadmap>
`);
  await writeFile(join(tmpDir, '.planning', 'TASK-REGISTRY.xml'), `<?xml version="1.0" encoding="UTF-8"?>
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
`);
}

describe('GADQuery scoped snapshots and claims', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gad-query-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await writeFixtureProject(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('auto-registers scoped snapshot lanes and returns agent metadata', async () => {
    const query = new GADQuery(tmpDir);
    const snapshot = await query.getScopedSnapshot({
      projectId: 'sample',
      taskId: '41-02',
      runtime: 'codex',
    });

    expect(snapshot.scope.snapshotMode).toBe('task');
    expect(snapshot.scope.taskId).toBe('41-02');
    expect(snapshot.agent?.runtime).toBe('codex');
    expect(snapshot.agent?.agentId).toMatch(/^codex-default-\d{4}$/);
    expect(snapshot.agent?.depth).toBe(0);
    expect(snapshot.assignments.activeAgents).toHaveLength(1);
  });

  it('enforces the hard subagent depth limit', async () => {
    const query = new GADQuery(tmpDir);
    const root = await query.getScopedSnapshot({
      projectId: 'sample',
      taskId: '41-01',
      runtime: 'claude-code',
    });
    const child = await query.getScopedSnapshot({
      projectId: 'sample',
      taskId: '41-02',
      runtime: 'claude-code',
      role: 'gad-planner',
      parentAgentId: root.agent?.agentId,
    });

    expect(child.agent?.depth).toBe(1);
    await expect(query.getScopedSnapshot({
      projectId: 'sample',
      taskId: '41-03',
      runtime: 'claude-code',
      role: 'gad-executor',
      parentAgentId: child.agent?.agentId,
    })).rejects.toThrow(/Maximum depth is 1/i);
  });

  it('claims and releases tasks through the in-process query surface', async () => {
    const query = new GADQuery(tmpDir);
    const claim = await query.claimTask({
      taskId: '41-02',
      runtime: 'cursor',
    });

    expect(claim.task.status).toBe('in-progress');
    expect(claim.task.agentId).toBe(claim.agent.agentId);
    expect(claim.task.runtime).toBe('cursor');

    const active = await query.listActiveAssignments();
    expect(active.activeTasks).toHaveLength(1);
    expect(active.activeAgents).toHaveLength(1);

    const release = await query.releaseTask({
      taskId: '41-02',
      agentId: claim.agent.agentId,
      done: true,
    });

    expect(release.task.status).toBe('done');
    expect(release.task.agentId).toBe(claim.agent.agentId);
  });
});
