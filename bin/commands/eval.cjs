'use strict';
/**
 * gad eval — DEPRECATED composer (decision gad-212).
 *
 * This module owns no eval behavior of its own. It composes the deprecated
 * `eval` command tree from services exposed by eval-* sibling modules and
 * owns the compatibility promotions into species/generation.
 *
 * Adding/removing subcommands here is the only edit needed to keep the
 * deprecated alias surface in sync — each eval-* module keeps owning its
 * own commands.
 */

const { defineCommand } = require('citty');

module.exports.register = (ctx) => {
  const info = ctx.services['eval-info'];
  const suite = ctx.services['eval-suite'];
  const artifacts = ctx.services['eval-artifacts'];
  const preview = ctx.services['eval-preview'];
  const evalRun = ctx.services['eval-run'].cmd;
  const evalTrace = ctx.services['eval-trace'].evalTraceCmd;
  const evalSkill = ctx.services['eval-skill'].evalSkillCmd;

  const evalCmd = defineCommand({
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

  return { eval: evalCmd };
};

module.exports.postWire = ({ services, subCommands }) => {
  Object.assign(subCommands.species.subCommands, {
    run: services['eval-run'].cmd,
    suite: services['eval-suite'].evalSuite,
  });

  Object.assign(subCommands.generation.subCommands, {
    preserve: services['eval-artifacts'].evalPreserve,
    verify: services['eval-artifacts'].evalVerify,
    open: services['eval-preview'].evalOpen,
    review: services['eval-preview'].evalReview,
    report: services['eval-suite'].evalReport,
  });
};
