'use strict';
/**
 * `gad eval skill ...` — per-skill evaluation harness (decision gad-87, task 22-52).
 *
 * Follows the agentskills.io methodology: evals/evals.json per skill with
 * with_skill vs without_skill baseline runs, assertion-based grading,
 * benchmark.json aggregation.
 *
 * Required deps: outputError.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvalSkillCommands(deps) {
  const { outputError } = deps;
  const SKILLS_ROOT = path.join(__dirname, '..', '..', 'skills');

  const evalSkillList = defineCommand({
    meta: { name: 'list', description: 'Show all skills with their eval status (has evals/evals.json or not)' },
    run() {
      if (!fs.existsSync(SKILLS_ROOT)) { outputError('No skills/ directory found'); return; }

      const skills = [];
      function walk(dir, prefix = '') {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const skillDir = path.join(dir, entry.name);
          const skillMd = path.join(skillDir, 'SKILL.md');
          if (!fs.existsSync(skillMd)) {
            walk(skillDir, prefix ? `${prefix}/${entry.name}` : entry.name);
            continue;
          }
          const id = prefix ? `${prefix}/${entry.name}` : entry.name;
          const evalsJson = path.join(skillDir, 'evals', 'evals.json');
          const hasEvals = fs.existsSync(evalsJson);
          let testCount = 0;
          let benchmarkExists = false;
          if (hasEvals) {
            try {
              const parsed = JSON.parse(fs.readFileSync(evalsJson, 'utf8'));
              testCount = parsed.evals?.length ?? 0;
            } catch {}
            const evalsDir = path.join(skillDir, 'evals');
            for (const f of fs.readdirSync(evalsDir)) {
              if (f.startsWith('benchmark') && f.endsWith('.json')) { benchmarkExists = true; break; }
            }
          }

          const content = fs.readFileSync(skillMd, 'utf8');
          const statusMatch = content.match(/^status:\s*(.+)$/m);
          const originMatch = content.match(/^origin:\s*(.+)$/m);
          const status = statusMatch ? statusMatch[1].trim() : 'experimental';
          const origin = originMatch ? originMatch[1].trim() : 'human-authored';

          skills.push({ id, status, origin, hasEvals, testCount, benchmarkExists });
        }
      }

      walk(SKILLS_ROOT);

      console.log(`\n  Per-skill evaluation status (${skills.length} skills)\n`);
      console.log(`  ${'Skill'.padEnd(35)} ${'Status'.padEnd(15)} ${'Origin'.padEnd(16)} ${'Evals'.padEnd(8)} Tests  Benchmark`);
      console.log(`  ${'─'.repeat(35)} ${'─'.repeat(15)} ${'─'.repeat(16)} ${'─'.repeat(8)} ${'─'.repeat(6)} ${'─'.repeat(9)}`);

      for (const s of skills.sort((a, b) => a.id.localeCompare(b.id))) {
        const evalIcon = s.hasEvals ? '✓' : '✗';
        const benchIcon = s.benchmarkExists ? '✓' : '—';
        console.log(
          `  ${s.id.padEnd(35)} ${s.status.padEnd(15)} ${s.origin.padEnd(16)} ${evalIcon.padEnd(8)} ${String(s.testCount).padEnd(6)} ${benchIcon}`
        );
      }

      const withEvals = skills.filter((s) => s.hasEvals).length;
      const withBenchmark = skills.filter((s) => s.benchmarkExists).length;
      const canonical = skills.filter((s) => s.status === 'canonical').length;
      console.log(`\n  Summary: ${withEvals}/${skills.length} have evals/evals.json, ${withBenchmark} have benchmarks, ${canonical} canonical`);
      console.log(`  Per gad-86: skills without evaluation = experimental. Run \`gad eval skill init <name>\` to create test cases.\n`);
    },
  });

  function resolveSkillDir(name) {
    const skillDir = path.join(SKILLS_ROOT, name);
    const emergentDir = path.join(SKILLS_ROOT, 'emergent', name);
    if (fs.existsSync(path.join(skillDir, 'SKILL.md'))) return skillDir;
    if (fs.existsSync(path.join(emergentDir, 'SKILL.md'))) return emergentDir;
    return null;
  }

  const evalSkillInit = defineCommand({
    meta: { name: 'init', description: 'Generate evals/evals.json template for a skill based on its description' },
    args: { name: { type: 'positional', description: 'Skill name (e.g. create-skill, merge-skill)', required: true } },
    run({ args }) {
      const resolvedDir = resolveSkillDir(args.name);
      if (!resolvedDir) {
        outputError(`Skill "${args.name}" not found at skills/${args.name}/SKILL.md or skills/emergent/${args.name}/SKILL.md`);
        return;
      }

      const evalsDir = path.join(resolvedDir, 'evals');
      const evalsJson = path.join(evalsDir, 'evals.json');

      if (fs.existsSync(evalsJson)) {
        console.log(`  evals/evals.json already exists for ${args.name}`);
        const parsed = JSON.parse(fs.readFileSync(evalsJson, 'utf8'));
        console.log(`  ${parsed.evals?.length ?? 0} test case(s) defined`);
        console.log(`  Edit ${evalsJson} to add or modify test cases.`);
        return;
      }

      const skillContent = fs.readFileSync(path.join(resolvedDir, 'SKILL.md'), 'utf8');
      const nameMatch = skillContent.match(/^name:\s*(.+)$/m);
      const descMatch = skillContent.match(/^description:\s*>-?\s*\n([\s\S]*?)(?=\n---|\n\w+:)/m)
        || skillContent.match(/^description:\s*(.+)$/m);
      const skillName = nameMatch ? nameMatch[1].trim() : args.name;
      const description = descMatch ? descMatch[1].trim().replace(/\n\s+/g, ' ') : '';

      const template = {
        skill_name: skillName,
        format_version: 'agentskills-v1',
        generated_by: 'gad eval skill init',
        generated_on: new Date().toISOString().split('T')[0],
        description: `Test cases for the ${skillName} skill. Per gad-87, grading uses trace events + file mutations + commit log — not LLM self-report.`,
        evals: [
          {
            id: 1,
            prompt: `[TODO: Write a realistic user prompt that should trigger the ${skillName} skill]`,
            expected_output: `[TODO: Describe what success looks like when this skill is used]`,
            files: [],
            assertions: [
              `[TODO: Write a verifiable assertion about the expected output — e.g. "A new file was created at <path>"]`,
              `[TODO: Write a second assertion]`,
            ],
            grading_strategy: 'trace-based',
            trace_assertions: [
              {
                type: 'file_mutation',
                description: `[TODO: What file should be created/modified when this skill runs?]`,
                pattern: '[TODO: glob or path pattern]',
              },
            ],
          },
          {
            id: 2,
            prompt: `[TODO: Write a DIFFERENT prompt that should also trigger ${skillName} — different phrasing, different context]`,
            expected_output: `[TODO: Describe what success looks like]`,
            files: [],
            assertions: [`[TODO: Verifiable assertion]`],
            grading_strategy: 'trace-based',
            trace_assertions: [],
          },
          {
            id: 3,
            prompt: `[TODO: Write a prompt that should NOT trigger ${skillName} — negative test case]`,
            expected_output: `The skill should NOT activate for this prompt.`,
            files: [],
            assertions: [`The skill was not invoked (no skill_invocation event in trace for ${skillName})`],
            grading_strategy: 'trace-based',
            trace_assertions: [
              {
                type: 'skill_invocation_absent',
                description: `${skillName} should NOT have been invoked`,
                skill_name: skillName,
              },
            ],
          },
        ],
      };

      fs.mkdirSync(evalsDir, { recursive: true });
      fs.writeFileSync(evalsJson, JSON.stringify(template, null, 2), 'utf8');

      console.log(`\n  ✓ Created ${path.relative(SKILLS_ROOT, evalsJson)}`);
      console.log(`    ${template.evals.length} test cases generated (2 positive + 1 negative)`);
      console.log(`    Skill: ${skillName}`);
      if (description) console.log(`    Description: ${description.slice(0, 120)}...`);
      console.log(`\n  Next steps:`);
      console.log(`    1. Edit the [TODO] placeholders in evals.json with real prompts + assertions`);
      console.log(`    2. Run: gad eval skill run ${args.name} --iteration 1`);
      console.log(`    3. After running with_skill + without_skill: gad eval skill grade ${args.name} --iteration 1`);
      console.log(`    4. View results: gad eval skill benchmark ${args.name}\n`);
    },
  });

  const evalSkillRun = defineCommand({
    meta: { name: 'run', description: 'Generate prompts for a skill eval run (with_skill + without_skill)' },
    args: {
      name: { type: 'positional', description: 'Skill name', required: true },
      iteration: { type: 'string', description: 'Iteration number', default: '1' },
    },
    run({ args }) {
      const resolvedDir = resolveSkillDir(args.name);
      if (!resolvedDir) { outputError(`Skill "${args.name}" not found`); return; }

      const evalsJson = path.join(resolvedDir, 'evals', 'evals.json');
      if (!fs.existsSync(evalsJson)) {
        outputError(`No evals/evals.json for ${args.name}. Run: gad eval skill init ${args.name}`);
        return;
      }

      const evals = JSON.parse(fs.readFileSync(evalsJson, 'utf8'));
      const iterNum = parseInt(args.iteration, 10);

      const workspaceDir = path.join(resolvedDir, `${args.name}-workspace`, `iteration-${iterNum}`);
      fs.mkdirSync(workspaceDir, { recursive: true });

      console.log(`\n  Skill eval: ${args.name} — iteration ${iterNum}`);
      console.log(`  ${evals.evals.length} test case(s) × 2 conditions (with_skill + without_skill)`);
      console.log(`  Workspace: ${path.relative(SKILLS_ROOT, workspaceDir)}\n`);

      for (const tc of evals.evals) {
        const evalDir = path.join(workspaceDir, `eval-${tc.id}`);
        fs.mkdirSync(path.join(evalDir, 'with_skill', 'outputs'), { recursive: true });
        fs.mkdirSync(path.join(evalDir, 'without_skill', 'outputs'), { recursive: true });

        const withSkillPrompt = `Execute this task WITH the ${args.name} skill loaded:
- Skill path: ${path.relative(process.cwd(), resolvedDir)}
- Task: ${tc.prompt}
${tc.files?.length ? `- Input files: ${tc.files.join(', ')}` : ''}
- Save outputs to: ${path.relative(process.cwd(), path.join(evalDir, 'with_skill', 'outputs'))}/

After completing, record timing:
- total_tokens: (from task completion notification)
- duration_ms: (from task completion notification)
Save as ${path.relative(process.cwd(), path.join(evalDir, 'with_skill', 'timing.json'))}
`;

        const withoutSkillPrompt = `Execute this task WITHOUT any skill guidance:
- Task: ${tc.prompt}
${tc.files?.length ? `- Input files: ${tc.files.join(', ')}` : ''}
- Save outputs to: ${path.relative(process.cwd(), path.join(evalDir, 'without_skill', 'outputs'))}/
- Do NOT load or reference the ${args.name} skill

After completing, record timing:
- total_tokens: (from task completion notification)
- duration_ms: (from task completion notification)
Save as ${path.relative(process.cwd(), path.join(evalDir, 'without_skill', 'timing.json'))}
`;

        fs.writeFileSync(path.join(evalDir, 'with_skill', 'PROMPT.md'), withSkillPrompt, 'utf8');
        fs.writeFileSync(path.join(evalDir, 'without_skill', 'PROMPT.md'), withoutSkillPrompt, 'utf8');

        fs.writeFileSync(path.join(evalDir, 'assertions.json'), JSON.stringify({
          eval_id: tc.id,
          prompt: tc.prompt,
          expected_output: tc.expected_output,
          assertions: tc.assertions,
          trace_assertions: tc.trace_assertions ?? [],
        }, null, 2), 'utf8');

        console.log(`  ✓ eval-${tc.id}: prompts + assertions generated`);
      }

      console.log(`\n  Next: run each PROMPT.md as a subagent task (with_skill first, then without_skill).`);
      console.log(`  After both complete: gad eval skill grade ${args.name} --iteration ${iterNum}\n`);
    },
  });

  const evalSkillGrade = defineCommand({
    meta: { name: 'grade', description: 'Grade a skill eval iteration by checking assertions against outputs' },
    args: {
      name: { type: 'positional', description: 'Skill name', required: true },
      iteration: { type: 'string', description: 'Iteration number', default: '1' },
    },
    run({ args }) {
      const resolvedDir = resolveSkillDir(args.name);
      if (!resolvedDir) { outputError(`Skill not found`); return; }

      const workspaceDir = path.join(resolvedDir, `${args.name}-workspace`, `iteration-${args.iteration}`);
      if (!fs.existsSync(workspaceDir)) {
        outputError(`No workspace at iteration-${args.iteration}. Run: gad eval skill run ${args.name} --iteration ${args.iteration}`);
        return;
      }

      console.log(`\n  Grading: ${args.name} — iteration ${args.iteration}\n`);

      const evalDirs = fs.readdirSync(workspaceDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.startsWith('eval-'))
        .sort((a, b) => a.name.localeCompare(b.name));

      const results = [];

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
              assertion_results: assertions.map((a) => ({
                text: a,
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
              assertion_results: assertions.map((a) => ({
                text: a,
                passed: null,
                evidence: withoutHasOutput ? 'PENDING MANUAL REVIEW' : 'NO OUTPUT',
              })),
              summary: { passed: 0, failed: 0, pending: assertions.length, total: assertions.length },
            },
          },
        };

        fs.writeFileSync(path.join(evalDir, 'with_skill', 'grading.json'), JSON.stringify(gradingResult.with_skill.grading, null, 2), 'utf8');
        fs.writeFileSync(path.join(evalDir, 'without_skill', 'grading.json'), JSON.stringify(gradingResult.without_skill.grading, null, 2), 'utf8');

        results.push(gradingResult);

        const withStatus = withHasOutput ? '✓ has output' : '✗ no output';
        const withoutStatus = withoutHasOutput ? '✓ has output' : '✗ no output';
        console.log(`  eval-${eval_id}: with_skill ${withStatus} | without_skill ${withoutStatus}`);
        if (!withHasOutput || !withoutHasOutput) {
          console.log(`    → Run the PROMPT.md files before grading`);
        } else {
          console.log(`    → ${assertions.length} assertion(s) pending manual review`);
          console.log(`    → Edit grading.json files: set "passed" to true/false + add evidence`);
        }
      }

      console.log(`\n  After reviewing grading.json files: gad eval skill benchmark ${args.name}\n`);
    },
  });

  const evalSkillBenchmark = defineCommand({
    meta: { name: 'benchmark', description: 'Aggregate grading results into benchmark.json for a skill' },
    args: { name: { type: 'positional', description: 'Skill name', required: true } },
    run({ args }) {
      const resolvedDir = resolveSkillDir(args.name);
      if (!resolvedDir) { outputError(`Skill not found`); return; }

      const workspaceBase = path.join(resolvedDir, `${args.name}-workspace`);
      if (!fs.existsSync(workspaceBase)) {
        outputError(`No workspace found. Run: gad eval skill run ${args.name}`);
        return;
      }

      const iterations = fs.readdirSync(workspaceBase, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.startsWith('iteration-'))
        .sort((a, b) => {
          const na = parseInt(a.name.replace('iteration-', ''), 10);
          const nb = parseInt(b.name.replace('iteration-', ''), 10);
          return nb - na;
        });

      if (iterations.length === 0) { outputError(`No iterations found in workspace`); return; }

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
        .filter((d) => d.isDirectory() && d.name.startsWith('eval-'));

      for (const evalEntry of evalDirs) {
        const evalDir = path.join(iterDir, evalEntry.name);

        for (const condition of ['with_skill', 'without_skill']) {
          const gradingFile = path.join(evalDir, condition, 'grading.json');
          const timingFile = path.join(evalDir, condition, 'timing.json');

          if (fs.existsSync(gradingFile)) {
            const grading = JSON.parse(fs.readFileSync(gradingFile, 'utf8'));
            const results = grading.assertion_results ?? [];
            const passed = results.filter((r) => r.passed === true).length;
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

      function avg(arr) { return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
      function stddev(arr) {
        if (arr.length < 2) return 0;
        const m = avg(arr);
        return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
      }

      const benchmark = {
        skill_name: args.name,
        iteration: latestIter,
        generated_on: new Date().toISOString(),
        eval_count: evalDirs.length,
        run_summary: {
          with_skill: {
            pass_rate: { mean: avg(withSkillPassRates), stddev: stddev(withSkillPassRates) },
            time_seconds: { mean: avg(withSkillTimes), stddev: stddev(withSkillTimes) },
            tokens: { mean: avg(withSkillTokens), stddev: stddev(withSkillTokens) },
          },
          without_skill: {
            pass_rate: { mean: avg(withoutSkillPassRates), stddev: stddev(withoutSkillPassRates) },
            time_seconds: { mean: avg(withoutSkillTimes), stddev: stddev(withoutSkillTimes) },
            tokens: { mean: avg(withoutSkillTokens), stddev: stddev(withoutSkillTokens) },
          },
          delta: {
            pass_rate: avg(withSkillPassRates) - avg(withoutSkillPassRates),
            time_seconds: avg(withSkillTimes) - avg(withoutSkillTimes),
            tokens: avg(withSkillTokens) - avg(withoutSkillTokens),
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
        console.log(`\n  ✓ Skill improves over baseline (delta.pass_rate > 0)`);
        console.log(`    Per gad-86: this skill is a GRADUATION CANDIDATE`);
        console.log(`    To graduate: update SKILL.md frontmatter to status: canonical`);
      } else if (withSkillPassRates.every((r) => r === 0) && withoutSkillPassRates.every((r) => r === 0)) {
        console.log(`\n  ⚠ No grading data — all assertions are pending manual review`);
        console.log(`    Edit the grading.json files in each eval dir, then re-run this command`);
      } else {
        console.log(`\n  ✗ Skill does NOT improve over baseline`);
        console.log(`    Status stays: experimental`);
      }

      console.log(`\n  Benchmark written to: ${path.relative(process.cwd(), benchmarkPath)}\n`);
    },
  });

  const evalSkillDraftCandidates = defineCommand({
    meta: {
      name: 'draft-candidates',
      description: 'Invoke claude CLI to rewrite auto-drafted skill candidate stubs into real bodies (GAD-D-145)',
    },
    args: {
      'dry-run': { type: 'boolean', description: 'Print prompts without spawning claude CLI', default: false },
      force: { type: 'boolean', description: 'Redraft candidates that already have drafted: true', default: false },
      only: { type: 'string', description: 'Only draft a single candidate (matches by name substring)' },
    },
    run({ args }) {
      const { draftAllCandidates } = require('../../lib/skill-draft.cjs');
      const repoRoot = path.resolve(__dirname, '..', '..');
      const stats = draftAllCandidates(repoRoot, {
        dryRun: args['dry-run'],
        force: args.force,
        only: args.only,
      });
      if (stats.failed > 0) process.exit(1);
    },
  });

  const evalSkillCmd = defineCommand({
    meta: { name: 'skill', description: 'Per-skill evaluation harness (gad-87) — list, init, run, grade, benchmark, draft-candidates' },
    subCommands: {
      list: evalSkillList,
      init: evalSkillInit,
      run: evalSkillRun,
      grade: evalSkillGrade,
      benchmark: evalSkillBenchmark,
      'draft-candidates': evalSkillDraftCandidates,
    },
  });

  return { evalSkillCmd };
}

module.exports = { createEvalSkillCommands };
