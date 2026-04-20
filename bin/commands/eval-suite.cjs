'use strict';

const { createEvalSetupCommand } = require('./eval-suite/setup.cjs');
const { createEvalSuiteCommand } = require('./eval-suite/suite.cjs');
const { createEvalReportCommand } = require('./eval-suite/report.cjs');
const { createEvalReadmeCommand } = require('./eval-suite/readme.cjs');
const { createEvalInheritSkillsCommand } = require('./eval-suite/inherit-skills.cjs');

function createEvalSuiteCommands(deps) {
  return {
    evalSetup: createEvalSetupCommand(deps),
    evalSuite: createEvalSuiteCommand(deps),
    evalReport: createEvalReportCommand(deps),
    evalReadme: createEvalReadmeCommand(deps),
    evalInheritSkills: createEvalInheritSkillsCommand(deps),
  };
}

module.exports = { createEvalSuiteCommands };
module.exports.provides = (ctx) => createEvalSuiteCommands(ctx.common);
