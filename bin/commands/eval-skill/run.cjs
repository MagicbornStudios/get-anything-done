'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvalSkillRunCommand(deps) {
  return defineCommand({
    meta: { name: 'run', description: 'Generate prompts for a skill eval run (with_skill + without_skill)' },
    args: {
      name: { type: 'positional', description: 'Skill name', required: true },
      iteration: { type: 'string', description: 'Iteration number', default: '1' },
    },
    run({ args }) {
      const resolvedDir = deps.resolveSkillDir(args.name);
      if (!resolvedDir) {
        deps.outputError(`Skill "${args.name}" not found`);
        return;
      }

      const evalsJson = path.join(resolvedDir, 'evals', 'evals.json');
      if (!fs.existsSync(evalsJson)) {
        deps.outputError(`No evals/evals.json for ${args.name}. Run: gad eval skill init ${args.name}`);
        return;
      }

      const evals = JSON.parse(fs.readFileSync(evalsJson, 'utf8'));
      const iterNum = parseInt(args.iteration, 10);
      const workspaceDir = path.join(resolvedDir, `${args.name}-workspace`, `iteration-${iterNum}`);
      fs.mkdirSync(workspaceDir, { recursive: true });

      console.log(`\n  Skill eval: ${args.name} — iteration ${iterNum}`);
      console.log(`  ${evals.evals.length} test case(s) × 2 conditions (with_skill + without_skill)`);
      console.log(`  Workspace: ${path.relative(deps.SKILLS_ROOT, workspaceDir)}\n`);

      for (const testCase of evals.evals) {
        const evalDir = path.join(workspaceDir, `eval-${testCase.id}`);
        fs.mkdirSync(path.join(evalDir, 'with_skill', 'outputs'), { recursive: true });
        fs.mkdirSync(path.join(evalDir, 'without_skill', 'outputs'), { recursive: true });

        const withSkillPrompt = `Execute this task WITH the ${args.name} skill loaded:
- Skill path: ${path.relative(process.cwd(), resolvedDir)}
- Task: ${testCase.prompt}
${testCase.files?.length ? `- Input files: ${testCase.files.join(', ')}` : ''}
- Save outputs to: ${path.relative(process.cwd(), path.join(evalDir, 'with_skill', 'outputs'))}/

After completing, record timing:
- total_tokens: (from task completion notification)
- duration_ms: (from task completion notification)
Save as ${path.relative(process.cwd(), path.join(evalDir, 'with_skill', 'timing.json'))}
`;

        const withoutSkillPrompt = `Execute this task WITHOUT any skill guidance:
- Task: ${testCase.prompt}
${testCase.files?.length ? `- Input files: ${testCase.files.join(', ')}` : ''}
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
          eval_id: testCase.id,
          prompt: testCase.prompt,
          expected_output: testCase.expected_output,
          assertions: testCase.assertions,
          trace_assertions: testCase.trace_assertions ?? [],
        }, null, 2), 'utf8');

        console.log(`  ✓ eval-${testCase.id}: prompts + assertions generated`);
      }

      console.log('\n  Next: run each PROMPT.md as a subagent task (with_skill first, then without_skill).');
      console.log(`  After both complete: gad eval skill grade ${args.name} --iteration ${iterNum}\n`);
    },
  });
}

module.exports = { createEvalSkillRunCommand };
