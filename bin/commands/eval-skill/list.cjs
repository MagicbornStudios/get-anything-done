'use strict';

const fs = require('fs');
const { defineCommand } = require('citty');

function createEvalSkillListCommand(deps) {
  return defineCommand({
    meta: { name: 'list', description: 'Show all skills with their eval status (has evals/evals.json or not)' },
    run() {
      if (!fs.existsSync(deps.SKILLS_ROOT)) {
        deps.outputError('No skills/ directory found');
        return;
      }

      const skills = deps.walkSkills();

      console.log(`\n  Per-skill evaluation status (${skills.length} skills)\n`);
      console.log(`  ${'Skill'.padEnd(35)} ${'Status'.padEnd(15)} ${'Origin'.padEnd(16)} ${'Evals'.padEnd(8)} Tests  Benchmark`);
      console.log(`  ${'—'.repeat(35)} ${'—'.repeat(15)} ${'—'.repeat(16)} ${'—'.repeat(8)} ${'—'.repeat(6)} ${'—'.repeat(9)}`);

      for (const skill of skills.sort((a, b) => a.id.localeCompare(b.id))) {
        const evalIcon = skill.hasEvals ? '✓' : '✗';
        const benchIcon = skill.benchmarkExists ? '✓' : '—';
        console.log(
          `  ${skill.id.padEnd(35)} ${skill.status.padEnd(15)} ${skill.origin.padEnd(16)} ${evalIcon.padEnd(8)} ${String(skill.testCount).padEnd(6)} ${benchIcon}`
        );
      }

      const withEvals = skills.filter((skill) => skill.hasEvals).length;
      const withBenchmark = skills.filter((skill) => skill.benchmarkExists).length;
      const canonical = skills.filter((skill) => skill.status === 'canonical').length;
      console.log(`\n  Summary: ${withEvals}/${skills.length} have evals/evals.json, ${withBenchmark} have benchmarks, ${canonical} canonical`);
      console.log('  Per gad-86: skills without evaluation = experimental. Run `gad eval skill init <name>` to create test cases.\n');
    },
  });
}

module.exports = { createEvalSkillListCommand };
