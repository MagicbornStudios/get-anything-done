'use strict';
/**
 * `gad eval skill ...` — per-skill evaluation harness (decision gad-87, task 22-52).
 *
 * Subcommand behavior lives in `bin/commands/eval-skill/*.cjs`.
 */

const path = require('path');
const { defineCommand } = require('citty');
const { createSharedHelpers } = require('./eval-skill/shared.cjs');
const { createEvalSkillListCommand } = require('./eval-skill/list.cjs');
const { createEvalSkillInitCommand } = require('./eval-skill/init.cjs');
const { createEvalSkillRunCommand } = require('./eval-skill/run.cjs');
const { createEvalSkillGradeCommand } = require('./eval-skill/grade.cjs');
const { createEvalSkillBenchmarkCommand } = require('./eval-skill/benchmark.cjs');
const { createEvalSkillDraftCandidatesCommand } = require('./eval-skill/draft-candidates.cjs');

function createEvalSkillCommands(deps) {
  const SKILLS_ROOT = path.join(__dirname, '..', '..', 'skills');
  const helpers = createSharedHelpers(SKILLS_ROOT);
  const commandDeps = {
    ...deps,
    ...helpers,
    SKILLS_ROOT,
  };

  const evalSkillCmd = defineCommand({
    meta: { name: 'skill', description: 'Per-skill evaluation harness (gad-87) — list, init, run, grade, benchmark, draft-candidates' },
    subCommands: {
      list: createEvalSkillListCommand(commandDeps),
      init: createEvalSkillInitCommand(commandDeps),
      run: createEvalSkillRunCommand(commandDeps),
      grade: createEvalSkillGradeCommand(commandDeps),
      benchmark: createEvalSkillBenchmarkCommand(commandDeps),
      'draft-candidates': createEvalSkillDraftCandidatesCommand(commandDeps),
    },
  });

  return { evalSkillCmd };
}

module.exports = { createEvalSkillCommands };
module.exports.provides = (ctx) => createEvalSkillCommands(ctx.common);
