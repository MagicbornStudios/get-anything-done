'use strict';
/**
 * `gad eval run` (a.k.a. `gad species run`). Extracted from bin/gad.cjs.
 *
 * Required deps:
 *   listEvalProjectsHint, resolveEvalProject, outputError, normalizeEvalRuntime,
 *   ensureEvalRuntimeHooks, buildEvalPrompt, summarizeAgentLineage,
 *   buildSkillsProvenance, formatGenerationPreserveCommand.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvalRunCommand(deps) {
  const {
    listEvalProjectsHint,
    resolveEvalProject,
    outputError,
    normalizeEvalRuntime,
    ensureEvalRuntimeHooks,
    buildEvalPrompt,
    summarizeAgentLineage,
    buildSkillsProvenance,
    formatGenerationPreserveCommand,
  } = deps;

  const gadDir = path.join(__dirname, '..', '..');

  const evalRun = defineCommand({
    meta: { name: 'run', description: 'Run eval project — generates prompt, creates worktree, optionally spawns agent' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      baseline: { type: 'string', description: 'Git baseline (default: HEAD)', default: 'HEAD' },
      runtime: { type: 'string', description: 'Runtime driving the eval (claude-code, codex, cursor, etc.)', default: '' },
      'prompt-only': { type: 'boolean', description: 'Only generate the bootstrap prompt, do not create worktree', default: false },
      execute: { type: 'boolean', description: 'Output JSON for the orchestrating agent to spawn a worktree agent with full tracing', default: false },
      'install-skills': { type: 'string', description: 'Comma-separated paths to skills to install into the eval template before running', default: '' },
    },
    async run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const resolvedProject = resolveEvalProject(args.project);
      if (!resolvedProject) {
        outputError(`Eval project '${args.project}' not found. Run \`gad species list\` to see available projects.`);
        return;
      }
      const projectDir = resolvedProject.projectDir;

      // Install skills into template if requested (decision gad-107)
      if (args['install-skills']) {
        const templateDir = path.join(projectDir, 'template');
        const skillsDir = path.join(templateDir, 'skills');
        fs.mkdirSync(skillsDir, { recursive: true });

        const skillPaths = args['install-skills'].split(',').map((s) => s.trim()).filter(Boolean);
        const installed = [];
        for (const skillPath of skillPaths) {
          const resolved = path.resolve(skillPath);
          if (!fs.existsSync(resolved)) {
            console.warn(`  [warn] Skill not found: ${skillPath}`);
            continue;
          }
          const skillName = path.basename(resolved);
          const dest = path.join(skillsDir, skillName);
          fs.cpSync(resolved, dest, { recursive: true });
          installed.push(skillName);
          console.log(`  ✓ Installed skill: ${skillName} → template/skills/${skillName}`);
        }

        const agentsMd = path.join(templateDir, 'AGENTS.md');
        if (fs.existsSync(agentsMd) && installed.length > 0) {
          let content = fs.readFileSync(agentsMd, 'utf8');
          const skillsSection = `\n\n## Installed Skills\n\n${installed.map((s) => `- \`skills/${s}/SKILL.md\``).join('\n')}\n`;
          if (!content.includes('## Installed Skills')) {
            content += skillsSection;
            fs.writeFileSync(agentsMd, content);
            console.log(`  ✓ Updated AGENTS.md with ${installed.length} skill reference(s)`);
          }
        }

        const metaFile = path.join(templateDir, '.installed-skills.json');
        const meta = { installed_at: new Date().toISOString(), skills: installed.map((s) => ({ name: s, source: skillPaths[installed.indexOf(s)] })) };
        fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
      }

      const runs = fs.existsSync(projectDir)
        ? fs.readdirSync(projectDir).filter((n) => /^v\d+$/.test(n)).map((n) => parseInt(n.slice(1), 10))
        : [];
      const runNum = runs.length > 0 ? Math.max(...runs) + 1 : 1;
      const runDir = path.join(projectDir, `v${runNum}`);
      fs.mkdirSync(runDir, { recursive: true });
      const evalRuntime = normalizeEvalRuntime(args.runtime);
      const hookSetup = ensureEvalRuntimeHooks(evalRuntime);

      const now = new Date().toISOString();

      const prompt = buildEvalPrompt(projectDir, args.project, runNum, evalRuntime, runDir);
      fs.writeFileSync(path.join(runDir, 'PROMPT.md'), prompt);

      const traceScaffold = {
        project: args.project,
        version: `v${runNum}`,
        date: now.split('T')[0],
        gad_version: require(path.join(gadDir, 'package.json')).version || 'unknown',
        framework_version: require(path.join(gadDir, 'package.json')).version || 'unknown',
        trace_schema_version: 5,
        runtime_identity: evalRuntime,
        agent_lineage: summarizeAgentLineage({
          runtimeIdentity: evalRuntime,
          runtimesInvolved: evalRuntime?.id ? [{ id: evalRuntime.id, count: 1 }] : [],
        }),
        runtime_install: hookSetup,
        eval_type: 'greenfield',
        workflow: 'unknown',
        domain: null,
        tech_stack: null,
        build_requirement: null,
        requirements_version: 'v5',
        context_mode: 'fresh',
        human_estimate_hours: null,
        timing: {
          started: now,
          ended: null,
          duration_minutes: null,
          phases_completed: null,
          tasks_completed: null,
        },
        source_size_bytes: null,
        build_size_bytes: null,
        token_usage: { total_tokens: null, tool_uses: null },
        scores: { requirement_coverage: null, human_review: null, composite: null },
        human_review: null,
        git_analysis: null,
        planning_quality: null,
        requirement_coverage: null,
        workflow_emergence: null,
        gad_commands: [],
        skill_triggers: [],
        skills_provenance: buildSkillsProvenance(projectDir),
        trace_events_file: path.join(runDir, '.trace-events.jsonl'),
      };

      fs.writeFileSync(path.join(runDir, 'TRACE.json'), JSON.stringify(traceScaffold, null, 2));

      fs.writeFileSync(path.join(runDir, 'RUN.md'), [
        `# Eval Run v${runNum}`, '',
        `project: ${args.project}`,
        `baseline: ${args.baseline}`,
        `started: ${now}`,
        `status: ${args['prompt-only'] ? 'prompt-generated' : args.execute ? 'execute-ready' : 'running'}`,
        `eval_type: ${traceScaffold.eval_type}`,
        `workflow: ${traceScaffold.workflow}`,
        `runtime: ${evalRuntime.id}`,
        `runtime_hooks: ${hookSetup.ok ? 'ensured' : hookSetup.attempted ? 'attempted' : 'manual-required'}`,
        `trace_dir: ${runDir}`,
      ].join('\n') + '\n');

      if (args['prompt-only']) {
        console.log(`\nEval run: ${args.project} v${runNum} (prompt only)`);
        console.log(`\n✓ Bootstrap prompt written: evals/${args.project}/v${runNum}/PROMPT.md`);
        console.log(`  ${prompt.length} chars, ~${Math.ceil(prompt.length / 4)} tokens`);
        console.log(`  runtime: ${evalRuntime.id}`);
        console.log(`  hooks: ${hookSetup.note}`);
        console.log(`\nTo run: copy the prompt into your AI agent with worktree isolation.`);
        return;
      }

      if (args.execute) {
        const execPayload = {
          command: 'eval-execute',
          project: args.project,
          version: `v${runNum}`,
          runDir,
          traceDir: runDir,
          prompt,
          promptFile: path.join(runDir, 'PROMPT.md'),
          traceJsonFile: path.join(runDir, 'TRACE.json'),
          envVars: {
            GAD_RUNTIME: evalRuntime.id,
            GAD_EVAL_TRACE_DIR: runDir,
            GAD_LOG_DIR: path.join(runDir, '.gad-log'),
            GAD_EVAL_PROJECT: args.project,
            GAD_EVAL_VERSION: `v${runNum}`,
          },
          agentDescription: `Eval: ${args.project} v${runNum}`,
          postSteps: [
            `After the agent completes:`,
            `1. Update TRACE.json timing.ended + timing.duration_minutes + token_usage from agent result`,
            `1b. Verify runtime identity / trace files were captured for ${evalRuntime.id}`,
            `2. Run: ${formatGenerationPreserveCommand(args.project, `v${runNum}`)} --from <worktree-path>`,
            `3. Regenerate site data: cd site && node scripts/build-site-data.mjs`,
            `4. Build + commit + push`,
          ],
        };

        fs.writeFileSync(path.join(runDir, 'EXEC.json'), JSON.stringify(execPayload, null, 2));

        console.log(`\nEval run: ${args.project} v${runNum} (execute mode)`);
        console.log(`\n✓ TRACE.json scaffold: evals/${args.project}/v${runNum}/TRACE.json`);
        console.log(`✓ EXEC.json: evals/${args.project}/v${runNum}/EXEC.json`);
        console.log(`✓ Bootstrap prompt: ${prompt.length} chars, ~${Math.ceil(prompt.length / 4)} tokens`);
        console.log(`✓ Runtime hooks: ${hookSetup.note}`);
        console.log(`\nThe orchestrating agent should:`);
        console.log(`  1. Read EXEC.json for the spawn configuration`);
        console.log(`  2. Set env: GAD_RUNTIME=${evalRuntime.id}`);
        console.log(`  3. Set env: GAD_EVAL_TRACE_DIR=${runDir}`);
        console.log(`  4. Set env: GAD_LOG_DIR=${path.join(runDir, '.gad-log')}`);
        console.log(`  5. Spawn an Agent with isolation: "worktree" using the prompt`);
        console.log(`  6. On completion: update TRACE.json with timing + tokens`);
        console.log(`  7. Run: ${formatGenerationPreserveCommand(args.project, `v${runNum}`)} --from <worktree>`);
        console.log(`  8. Regenerate site data + push`);

        console.log('\n--- EXEC_JSON_START ---');
        console.log(JSON.stringify(execPayload));
        console.log('--- EXEC_JSON_END ---');
        return;
      }

      console.log(`\nEval run: ${args.project} v${runNum}`);
      console.log(`Baseline: ${args.baseline}`);

      const { execSync } = require('child_process');
      const worktreePath = path.join(require('os').tmpdir(), `gad-eval-${args.project}-${Date.now()}`);

      try {
        execSync(`git worktree add "${worktreePath}" "${args.baseline}"`, { stdio: 'pipe' });
        console.log(`✓ Worktree created: ${worktreePath}`);
        console.log(`✓ Bootstrap prompt: evals/${args.project}/v${runNum}/PROMPT.md`);
        console.log(`  ${prompt.length} chars, ~${Math.ceil(prompt.length / 4)} tokens`);
        console.log(`\nAgent should work in: ${worktreePath}`);
        console.log(`After agent completes, run:`);
        console.log(`  ${formatGenerationPreserveCommand(args.project, `v${runNum}`)} --from ${worktreePath}`);
      } finally {
        try {
          execSync(`git worktree remove --force "${worktreePath}"`, { stdio: 'pipe' });
          console.log(`✓ Worktree removed`);
        } catch {}
      }

      const endTime = new Date().toISOString();
      const runMd = fs.readFileSync(path.join(runDir, 'RUN.md'), 'utf8');
      fs.writeFileSync(path.join(runDir, 'RUN.md'),
        runMd.replace('status: running', `status: prompt-ready\nended: ${endTime}`));

      console.log(`\n✓ Eval run prepared`);
      console.log(`  Output: evals/${args.project}/v${runNum}/`);
    },
  });

  return { evalRun };
}

module.exports = { createEvalRunCommand };
