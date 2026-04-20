'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvalSkillInitCommand(deps) {
  return defineCommand({
    meta: { name: 'init', description: 'Generate evals/evals.json template for a skill based on its description' },
    args: { name: { type: 'positional', description: 'Skill name (e.g. create-skill, merge-skill)', required: true } },
    run({ args }) {
      const resolvedDir = deps.resolveSkillDir(args.name);
      if (!resolvedDir) {
        deps.outputError(`Skill "${args.name}" not found at skills/${args.name}/SKILL.md or skills/emergent/${args.name}/SKILL.md`);
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
            expected_output: '[TODO: Describe what success looks like when this skill is used]',
            files: [],
            assertions: [
              '[TODO: Write a verifiable assertion about the expected output — e.g. "A new file was created at <path>"]',
              '[TODO: Write a second assertion]',
            ],
            grading_strategy: 'trace-based',
            trace_assertions: [
              {
                type: 'file_mutation',
                description: '[TODO: What file should be created/modified when this skill runs?]',
                pattern: '[TODO: glob or path pattern]',
              },
            ],
          },
          {
            id: 2,
            prompt: `[TODO: Write a DIFFERENT prompt that should also trigger ${skillName} skill — different phrasing, different context]`,
            expected_output: '[TODO: Describe what success looks like]',
            files: [],
            assertions: ['[TODO: Verifiable assertion]'],
            grading_strategy: 'trace-based',
            trace_assertions: [],
          },
          {
            id: 3,
            prompt: `[TODO: Write a prompt that should NOT trigger ${skillName} skill — negative test case]`,
            expected_output: 'The skill should NOT activate for this prompt.',
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

      console.log(`\n  ✓ Created ${path.relative(deps.SKILLS_ROOT, evalsJson)}`);
      console.log(`    ${template.evals.length} test cases generated (2 positive + 1 negative)`);
      console.log(`    Skill: ${skillName}`);
      if (description) console.log(`    Description: ${description.slice(0, 120)}...`);
      console.log('\n  Next steps:');
      console.log('    1. Edit the [TODO] placeholders in evals.json with real prompts + assertions');
      console.log(`    2. Run: gad eval skill run ${args.name} --iteration 1`);
      console.log(`    3. After running with_skill + without_skill: gad eval skill grade ${args.name} --iteration 1`);
      console.log(`    4. View results: gad eval skill benchmark ${args.name}\n`);
    },
  });
}

module.exports = { createEvalSkillInitCommand };
