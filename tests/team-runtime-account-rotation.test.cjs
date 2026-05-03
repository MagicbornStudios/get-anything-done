'use strict';

const { beforeEach, afterEach, describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { createTempDir, cleanup } = require('./helpers.cjs');

const WORKER_LOOP_PATH = require.resolve('../lib/team/worker-loop.cjs');
const RATE_LIMIT_PATH = require.resolve('../lib/team/rate-limit.cjs');
const SUBPROCESS_PATH = require.resolve('../lib/team/subprocess.cjs');
const MAILBOX_PATH = require.resolve('../lib/team/mailbox.cjs');
const PROMPT_PATH = require.resolve('../lib/team/prompt.cjs');
const STATUS_PATH = require.resolve('../lib/team/status.cjs');
const IO_PATH = require.resolve('../lib/team/io.cjs');
const HANDOFFS_PATH = require.resolve('../lib/handoffs.cjs');

function writeTeamConfig(tmpDir) {
  const configPath = path.join(tmpDir, '.planning', 'team', 'config.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    workers: 1,
    roles: ['executor'],
    workers_spec: [{ id: 'w5', role: 'executor', lane: null, runtime: 'codex-cli', runtime_cmd: null }],
    runtime: 'codex-cli',
    runtime_cmd: null,
    tick_ms: 1,
  }, null, 2));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'team', 'workers', 'w5', 'out'), { recursive: true });
}

describe('team runtime account rotation', () => {
  let tmpDir;
  let originals;

  beforeEach(() => {
    tmpDir = createTempDir('gad-team-account-rotation-');
    writeTeamConfig(tmpDir);
    originals = {
      appendJsonl: require(IO_PATH).appendJsonl,
      popOldest: require(MAILBOX_PATH).popOldest,
      markDone: require(MAILBOX_PATH).markDone,
      markFailed: require(MAILBOX_PATH).markFailed,
      composePrompt: require(PROMPT_PATH).composePrompt,
      updateStatus: require(STATUS_PATH).updateStatus,
      runSubprocess: require(SUBPROCESS_PATH).runSubprocess,
      getActiveRuntimeAccount: require(RATE_LIMIT_PATH).getActiveRuntimeAccount,
      rotateRuntimeAccount: require(RATE_LIMIT_PATH).rotateRuntimeAccount,
      parkRuntime: require(RATE_LIMIT_PATH).parkRuntime,
      isParked: require(RATE_LIMIT_PATH).isParked,
      claimHandoff: require(HANDOFFS_PATH).claimHandoff,
      readHandoff: require(HANDOFFS_PATH).readHandoff,
      unclaimHandoff: require(HANDOFFS_PATH).unclaimHandoff,
    };
  });

  afterEach(() => {
    require(IO_PATH).appendJsonl = originals.appendJsonl;
    require(MAILBOX_PATH).popOldest = originals.popOldest;
    require(MAILBOX_PATH).markDone = originals.markDone;
    require(MAILBOX_PATH).markFailed = originals.markFailed;
    require(PROMPT_PATH).composePrompt = originals.composePrompt;
    require(STATUS_PATH).updateStatus = originals.updateStatus;
    require(SUBPROCESS_PATH).runSubprocess = originals.runSubprocess;
    require(RATE_LIMIT_PATH).getActiveRuntimeAccount = originals.getActiveRuntimeAccount;
    require(RATE_LIMIT_PATH).rotateRuntimeAccount = originals.rotateRuntimeAccount;
    require(RATE_LIMIT_PATH).parkRuntime = originals.parkRuntime;
    require(RATE_LIMIT_PATH).isParked = originals.isParked;
    require(HANDOFFS_PATH).claimHandoff = originals.claimHandoff;
    require(HANDOFFS_PATH).readHandoff = originals.readHandoff;
    require(HANDOFFS_PATH).unclaimHandoff = originals.unclaimHandoff;
    delete require.cache[WORKER_LOOP_PATH];
    cleanup(tmpDir);
  });

  test('logs runtime-account-rotated before parking a runtime', async () => {
    const eventOrder = [];
    const stopFlag = path.join(tmpDir, '.planning', 'team', 'workers', 'w5', 'stop.flag');
    let mailboxPopped = false;
    let runCount = 0;

    require(IO_PATH).appendJsonl = (_file, entry) => {
      eventOrder.push(`log:${entry.kind}`);
    };
    require(MAILBOX_PATH).popOldest = () => {
      if (mailboxPopped) return null;
      mailboxPopped = true;
      return {
        msg: { kind: 'handoff', ref: 'h-1', projectid: 'global' },
        fullPath: path.join(tmpDir, 'mail.msg.json'),
      };
    };
    require(MAILBOX_PATH).markDone = () => {};
    require(MAILBOX_PATH).markFailed = () => {};
    require(PROMPT_PATH).composePrompt = () => 'prompt';
    require(STATUS_PATH).updateStatus = () => {};
    require(RATE_LIMIT_PATH).isParked = () => false;
    require(RATE_LIMIT_PATH).getActiveRuntimeAccount = () => ({
      label: 'primary',
      index: 0,
      env: { GAD_RUNTIME_ACCOUNT_LABEL: 'primary' },
    });
    require(RATE_LIMIT_PATH).rotateRuntimeAccount = (_baseDir, _runtime, attemptedIndexes) => {
      if (Array.isArray(attemptedIndexes) && attemptedIndexes.length === 1 && attemptedIndexes[0] === 0) {
        return {
          label: 'secondary',
          index: 1,
          env: { GAD_RUNTIME_ACCOUNT_LABEL: 'secondary' },
        };
      }
      return null;
    };
    require(RATE_LIMIT_PATH).parkRuntime = () => {
      eventOrder.push('parkRuntime');
      return { until: Date.now() + 1000 };
    };
    require(HANDOFFS_PATH).claimHandoff = () => {};
    require(HANDOFFS_PATH).readHandoff = () => ({ body: 'body' });
    require(HANDOFFS_PATH).unclaimHandoff = () => {};
    require(SUBPROCESS_PATH).runSubprocess = async (_baseDir, _workerId, _runtimeCmd, _promptFile, _logWrite, runtimeEnv) => {
      runCount += 1;
      if (runCount === 1) {
        assert.strictEqual(runtimeEnv.GAD_RUNTIME_ACCOUNT_LABEL, 'primary');
        return { code: 143, stdout: '', stderr: 'rate limit', rate_limited: true };
      }
      assert.strictEqual(runtimeEnv.GAD_RUNTIME_ACCOUNT_LABEL, 'secondary');
      fs.writeFileSync(stopFlag, '');
      return { code: 143, stdout: '', stderr: 'rate limit', rate_limited: true };
    };

    const { runWorker } = require(WORKER_LOOP_PATH);
    await runWorker(tmpDir, 'w5');

    const rotatedIdx = eventOrder.indexOf('log:runtime-account-rotated');
    const parkIdx = eventOrder.indexOf('parkRuntime');
    assert.ok(rotatedIdx >= 0, 'rotation event logged');
    assert.ok(parkIdx >= 0, 'parkRuntime called');
    assert.ok(rotatedIdx < parkIdx, `expected rotation before park, got ${eventOrder.join(' -> ')}`);
  });
});
