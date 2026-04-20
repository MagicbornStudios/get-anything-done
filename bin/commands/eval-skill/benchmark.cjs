'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvalSkillBenchmarkCommand(deps) {
  return defineCommand({
    meta: { name: 'benchmark', description: 'Aggregate grading results into benchmark.json for a skill' },
    args: { name: { type: 'positional', description: 'Skill name', required: true } },
    run({ args }) {
      const resolvedDir = deps.resolveSkillDir(args.name);
      if (!resolvedDir) {
        deps.outputError('Skill not found');
        return;
      }

      const workspaceBase = path.join(resolvedDir, `${args.name}-workspace`);
      if (!fs.existsSync(workspaceBase)) {
        deps.outputError(`No workspace found. Run: gad eval skill run ${args.name}`);
        return;
      }

      const iterations = fs.readdirSync(workspaceBase, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('iteration-'))
        .sort((a, b) => parseInt(b.name.replace('iteration-', ''), 10) - parseInt(a.name.replace('iteration-', ''), 10));
      if (iterations.length === 0) {
        deps.outputError('No iterations found in workspace');
        return;
      }

      const latestIter = iterations[0].name;
      const iterDir = path.join(workspaceBase, latestIter);

      console.log(`\n  Benchmarking: ${args.name} — ${latestIter}\n`);

      const withSkillPassRates = [];
      const withoutSkillPassRates = [];
      const withSkillTokens = [];
      const withoutSkillTokens = [];
      const withSkillTimes = [];
      const withoutSkillTimes = [];

      const evalDirs = fs.readdirSync(iterDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('eval-'));

      for (const evalEntry of evalDirs) {
        const evalDir = path.join(iterDir, evalEntry.name);

        for (const condition of ['with_skill', 'without_skill']) {
          const gradingFile = path.join(evalDir, condition, 'grading.json');
          const timingFile = path.join(evalDir, condition, 'timing.json');

          if (fs.existsSync(gradingFile)) {
            const grading = JSON.parse(fs.readFileSync(gradingFile, 'utf8'));
            const results = grading.assertion_results ?? [];
            const passed = results.filter((result) => result.passed === true).length;
            const total = results.length;
            const rate = total > 0 ? passed / total : 0;
            if (condition === 'with_skill') withSkillPassRates.push(rate);
            else withoutSkillPassRates.push(rate);
          }

          if (fs.existsSync(timingFile)) {
            const timing = JSON.parse(fs.readFileSync(timingFile, 'utf8'));
            if (condition === 'with_skill') {
              if (timing.total_tokens) withSkillTokens.push(timing.total_tokens);
              if (timing.duration_ms) withSkillTimes.push(timing.duration_ms / 1000);
            } else {
              if (timing.total_tokens) withoutSkillTokens.push(timing.total_tokens);
              if (timing.duration_ms) withoutSkillTimes.push(timing.duration_ms / 1000);
            }
          }
        }
      }

      const benchmark = {
        skill_name: args.name,
        iteration: latestIter,
        generated_on: new Date().toISOString(),
        eval_count: evalDirs.length,
        run_summary: {
          with_skill: {
            pass_rate: { mean: deps.avg(withSkillPassRates), stddev: deps.stddev(withSkillPassRates) },
            time_seconds: { mean: deps.avg(withSkillTimes), stddev: deps.stddev(withSkillTimes) },
            tokens: { mean: deps.avg(withSkillTokens), stddev: deps.stddev(withSkillTokens) },
          },
          without_skill: {
            pass_rate: { mean: deps.avg(withoutSkillPassRates), stddev: deps.stddev(withoutSkillPassRates) },
            time_seconds: { mean: deps.avg(withoutSkillTimes), stddev: deps.stddev(withoutSkillTimes) },
            tokens: { mean: deps.avg(withoutSkillTokens), stddev: deps.stddev(withoutSkillTokens) },
          },
          delta: {
            pass_rate: deps.avg(withSkillPassRates) - deps.avg(withoutSkillPassRates),
            time_seconds: deps.avg(withSkillTimes) - deps.avg(withoutSkillTimes),
            tokens: deps.avg(withSkillTokens) - deps.avg(withoutSkillTokens),
          },
        },
      };

      const benchmarkPath = path.join(resolvedDir, 'evals', 'benchmark.json');
      fs.mkdirSync(path.join(resolvedDir, 'evals'), { recursive: true });
      fs.writeFileSync(benchmarkPath, JSON.stringify(benchmark, null, 2), 'utf8');
      fs.writeFileSync(path.join(iterDir, 'benchmark.json'), JSON.stringify(benchmark, null, 2), 'utf8');

      console.log(`  with_skill:    pass_rate ${(benchmark.run_summary.with_skill.pass_rate.mean * 100).toFixed(1)}%`);
      console.log(`  without_skill: pass_rate ${(benchmark.run_summary.without_skill.pass_rate.mean * 100).toFixed(1)}%`);
      console.log(`  delta:         ${benchmark.run_summary.delta.pass_rate > 0 ? '+' : ''}${(benchmark.run_summary.delta.pass_rate * 100).toFixed(1)}pp`);

      if (benchmark.run_summary.delta.pass_rate > 0) {
        console.log('\n  ✓ Skill improves over baseline (delta.pass_rate > 0)');
        console.log('    Per gad-86: this skill is a GRADUATION CANDIDATE');
        console.log('    To graduate: update SKILL.md frontmatter to status: canonical');
      } else if (withSkillPassRates.every((rate) => rate === 0) && withoutSkillPassRates.every((rate) => rate === 0)) {
        console.log('\n  ⚠ No grading data — all assertions are pending manual review');
        console.log('    Edit the grading.json files in each eval dir, then re-run this command');
      } else {
        console.log('\n  ✗ Skill does NOT improve over baseline');
        console.log('    Status stays: experimental');
      }

      console.log(`\n  Benchmark written to: ${path.relative(process.cwd(), benchmarkPath)}\n`);
    },
  });
}

module.exports = { createEvalSkillBenchmarkCommand };
