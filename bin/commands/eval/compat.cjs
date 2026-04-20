'use strict';

const { defineCommand } = require('citty');

function createDeprecatedEvalCommand(services) {
  const info = services['eval-info'];
  const suite = services['eval-suite'];
  const artifacts = services['eval-artifacts'];
  const preview = services['eval-preview'];
  const evalRun = services['eval-run'].cmd;
  const evalTrace = services['eval-trace'].evalTraceCmd;
  const evalSkill = services['eval-skill'].evalSkillCmd;

  return defineCommand({
    meta: {
      name: 'eval',
      description: '[DEPRECATED] Use `gad species` or `gad generation` instead',
    },
    subCommands: {
      list: info.evalList,
      setup: suite.evalSetup,
      status: info.evalStatus,
      version: info.evalVersion,
      run: evalRun,
      runs: info.evalRuns,
      show: info.evalShow,
      score: info.evalScore,
      scores: info.evalScores,
      diff: info.evalDiff,
      trace: evalTrace,
      suite: suite.evalSuite,
      report: suite.evalReport,
      review: preview.evalReview,
      open: preview.evalOpen,
      preserve: artifacts.evalPreserve,
      verify: artifacts.evalVerify,
      skill: evalSkill,
      'inherit-skills': suite.evalInheritSkills,
      readme: suite.evalReadme,
    },
    run() {
      console.warn(
        "DEPRECATED: 'gad eval <cmd>' is deprecated. Use 'gad species <cmd>' or 'gad generation <cmd>' instead.",
      );
    },
  });
}

module.exports = { createDeprecatedEvalCommand };
