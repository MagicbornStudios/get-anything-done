'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvalSkillGradeCommand(deps) {
  return defineCommand({
    meta: { name: 'grade', description: 'Grade a skill eval iteration by checking assertions against outputs' },
    args: {
      name: { type: 'positional', description: 'Skill name', required: true },
      iteration: { type: 'string', description: 'Iteration number', default: '1' },
    },
    run({ args }) {
      const resolvedDir = deps.resolveSkillDir(args.name);
      if (!resolvedDir) {
        deps.outputError('Skill not found');
        return;
      }

      const workspaceDir = path.join(resolvedDir, `${args.name}-workspace`, `iteration-${args.iteration}`);
      if (!fs.existsSync(workspaceDir)) {
        deps.outputError(`No workspace at iteration-${args.iteration}. Run: gad eval skill run ${args.name} --iteration ${args.iteration}`);
        return;
      }

      console.log(`\n  Grading: ${args.name} — iteration ${args.iteration}\n`);

      const evalDirs = fs.readdirSync(workspaceDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('eval-'))
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const evalEntry of evalDirs) {
        const evalDir = path.join(workspaceDir, evalEntry.name);
        const assertionsFile = path.join(evalDir, 'assertions.json');
        if (!fs.existsSync(assertionsFile)) continue;

        const { eval_id, assertions } = JSON.parse(fs.readFileSync(assertionsFile, 'utf8'));

        const withOutputDir = path.join(evalDir, 'with_skill', 'outputs');
        const withOutputFiles = fs.existsSync(withOutputDir) ? fs.readdirSync(withOutputDir) : [];
        const withTimingFile = path.join(evalDir, 'with_skill', 'timing.json');
        const withTiming = fs.existsSync(withTimingFile) ? JSON.parse(fs.readFileSync(withTimingFile, 'utf8')) : null;

        const withoutOutputDir = path.join(evalDir, 'without_skill', 'outputs');
        const withoutOutputFiles = fs.existsSync(withoutOutputDir) ? fs.readdirSync(withoutOutputDir) : [];
        const withoutTimingFile = path.join(evalDir, 'without_skill', 'timing.json');
        const withoutTiming = fs.existsSync(withoutTimingFile) ? JSON.parse(fs.readFileSync(withoutTimingFile, 'utf8')) : null;

        const withHasOutput = withOutputFiles.length > 0;
        const withoutHasOutput = withoutOutputFiles.length > 0;

        const gradingResult = {
          eval_id,
          with_skill: {
            has_output: withHasOutput,
            output_files: withOutputFiles,
            timing: withTiming,
            grading: {
              assertion_results: assertions.map((assertion) => ({
                text: assertion,
                passed: null,
                evidence: withHasOutput ? 'PENDING MANUAL REVIEW — edit this grading.json with PASS/FAIL + evidence' : 'NO OUTPUT — run did not produce results',
              })),
              summary: { passed: 0, failed: 0, pending: assertions.length, total: assertions.length },
            },
          },
          without_skill: {
            has_output: withoutHasOutput,
            output_files: withoutOutputFiles,
            timing: withoutTiming,
            grading: {
              assertion_results: assertions.map((assertion) => ({
                text: assertion,
                passed: null,
                evidence: withoutHasOutput ? 'PENDING MANUAL REVIEW' : 'NO OUTPUT',
              })),
              summary: { passed: 0, failed: 0, pending: assertions.length, total: assertions.length },
            },
          },
        };

        fs.writeFileSync(path.join(evalDir, 'with_skill', 'grading.json'), JSON.stringify(gradingResult.with_skill.grading, null, 2), 'utf8');
        fs.writeFileSync(path.join(evalDir, 'without_skill', 'grading.json'), JSON.stringify(gradingResult.without_skill.grading, null, 2), 'utf8');

        const withStatus = withHasOutput ? '✓ has output' : '✗ no output';
        const withoutStatus = withoutHasOutput ? '✓ has output' : '✗ no output';
        console.log(`  eval-${eval_id}: with_skill ${withStatus} | without_skill ${withoutStatus}`);
        if (!withHasOutput || !withoutHasOutput) {
          console.log('    → Run the PROMPT.md files before grading');
        } else {
          console.log(`    → ${assertions.length} assertion(s) pending manual review`);
          console.log('    → Edit grading.json files: set "passed" to true/false + add evidence');
        }
      }

      console.log(`\n  After reviewing grading.json files: gad eval skill benchmark ${args.name}\n`);
    },
  });
}

module.exports = { createEvalSkillGradeCommand };
