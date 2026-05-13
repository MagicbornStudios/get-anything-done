'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { createTempProject, cleanup } = require('./helpers.cjs');
const { createStateCommand } = require('../bin/commands/state.cjs');
const { readState } = require('../lib/state-reader.cjs');

function captureConsole(fn) {
  const logs = [];
  const warns = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args) => logs.push(args.join(' '));
  console.warn = (...args) => warns.push(args.join(' '));
  try {
    fn();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
  return { logs: logs.join('\n'), warns: warns.join('\n') };
}

describe('gad state set-next-action deprecation wrapper', () => {
  let tmpDir;
  let root;
  let stateCommand;

  beforeEach(() => {
    tmpDir = createTempProject('gad-state-set-next-action-');
    root = { id: 'sample', path: '.', planningDir: '.planning' };
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.xml'),
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<state>',
        '  <current-phase>109</current-phase>',
        '  <status>active</status>',
        '  <next-action>Legacy action.</next-action>',
        '</state>',
        '',
      ].join('\n'),
      'utf8',
    );

    stateCommand = createStateCommand({
      findRepoRoot: () => tmpDir,
      gadConfig: {
        load: () => ({ roots: [root] }),
      },
      resolveRoots: () => [root],
      outputError(message) {
        throw new Error(message);
      },
      render: () => '',
      shouldUseJson: () => false,
      readState,
      graphExtractor: {
        isGraphQueryEnabled: () => false,
      },
      maybeRebuildGraph: () => {},
    });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('logs the message into <state-log> with the current phase tag instead of rewriting <next-action>', () => {
    const output = captureConsole(() => stateCommand.subCommands['set-next-action'].run({
      args: {
        text: 'Use the state log instead.',
        projectid: 'sample',
      },
    }));

    assert.match(output.warns, /deprecated/i);
    assert.match(output.logs, /Logged: \[team-w1\] Use the state log instead\./);

    const stateXml = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.xml'), 'utf8');
    assert.match(stateXml, /<next-action>Legacy action\.<\/next-action>/);
    assert.match(stateXml, /<entry agent="team-w1" at="[^"]+" tags="109">Use the state log instead\.<\/entry>/);
  });
});
