'use strict';
/**
 * `gad eval setup`, `gad eval suite`, `gad eval report`, `gad eval readme`,
 * `gad eval inherit-skills`. Extracted from bin/gad.cjs.
 *
 * Required deps:
 *   resolveOrDefaultEvalProjectDir, listAllEvalProjects, defaultEvalsDir,
 *   outputError, output, buildEvalPrompt, loadEvalProject, loadAllResolvedSpecies.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvalSuiteCommands(deps) {
  const {
    resolveOrDefaultEvalProjectDir,
    listAllEvalProjects,
    defaultEvalsDir,
    outputError,
    output,
    buildEvalPrompt,
    loadEvalProject,
    loadAllResolvedSpecies,
  } = deps;

  const evalSetup = defineCommand({
    meta: { name: 'setup', description: 'Scaffold a new eval project with planning template' },
    args: {
      project: { type: 'string', description: 'Eval project name (e.g. escape-the-dungeon)', default: '' },
      requirements: { type: 'string', description: 'Path to source requirements file to copy', default: '' },
    },
    run({ args }) {
      if (!args.project) {
        console.error('\nUsage: gad eval setup --project <name> [--requirements <path>]\n');
        process.exit(1);
      }
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);
      const templateDir = path.join(projectDir, 'template', '.planning');

      if (fs.existsSync(projectDir)) {
        console.log(`Eval project "${args.project}" already exists at ${projectDir}`);
        return;
      }

      fs.mkdirSync(templateDir, { recursive: true });

      const now = new Date().toISOString().split('T')[0];
      fs.writeFileSync(path.join(templateDir, 'STATE.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase></current-phase>
  <current-plan></current-plan>
  <milestone>${args.project}-eval</milestone>
  <status>not-started</status>
  <next-action>Read REQUIREMENTS.xml. Use /gad:discuss-phase to collect requirements and open questions before planning phases.</next-action>
  <last-updated>${now}</last-updated>
</state>
`);

      fs.writeFileSync(path.join(templateDir, 'ROADMAP.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <!-- Phases will be planned after discussion phase -->
</roadmap>
`);

      fs.writeFileSync(path.join(templateDir, 'TASK-REGISTRY.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<task-registry>
  <!-- Tasks will be planned after discussion phase -->
</task-registry>
`);

      fs.writeFileSync(path.join(templateDir, 'DECISIONS.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <!-- Decisions will be captured during discussion and implementation -->
</decisions>
`);

      if (args.requirements && fs.existsSync(args.requirements)) {
        const ext = path.extname(args.requirements);
        const dest = path.join(projectDir, `source-requirements${ext}`);
        fs.copyFileSync(args.requirements, dest);
        console.log(`  Copied ${args.requirements} → ${dest}`);
      }

      fs.writeFileSync(path.join(projectDir, 'REQUIREMENTS.md'), `# Eval: ${args.project}

## What this eval measures

1. **Skill trigger accuracy** — are /gad:* skills triggered at the right moments
2. **Planning quality** — coherent phases, tasks, decisions from requirements
3. **CLI context efficiency** — gad snapshot delivers what the agent needs
4. **End-to-end loop** — discuss → plan → execute → verify → score
5. **Time-to-completion** — wall clock and token counts

## Eval flow

1. Pre-planning: \`/gad:discuss-phase\` — collect open questions, clarify requirements
2. Planning: \`/gad:plan-phase\` — break into implementable phases with tasks
3. Execution: \`/gad:execute-phase\` — implement, update planning docs, commit
4. Verification: \`/gad:verify-work\` — check against definition of done
5. Scoring: TRACE.json + SCORE.md

## Human review

After eval agent completes, human reviews output quality.
Manual score added to SCORE.md.
`);

      console.log(`\n✓ Eval project created: ${projectDir}`);
      console.log(`\n  template/.planning/ — STATE.xml, ROADMAP.xml, TASK-REGISTRY.xml, DECISIONS.xml`);
      console.log(`  REQUIREMENTS.md — eval definition`);
      if (args.requirements) console.log(`  source-requirements${path.extname(args.requirements)} — copied source`);
      console.log(`\n  Next: add REQUIREMENTS.xml to template/.planning/ with structured requirements`);
      console.log(`  Then: gad species run --project ${args.project}`);
    },
  });

  const evalSuite = defineCommand({
    meta: { name: 'suite', description: 'Generate bootstrap prompts for all eval projects in parallel' },
    args: {
      projects: { type: 'string', description: 'Comma-separated project names (default: all with templates)', default: '' },
    },
    run({ args }) {
      let discovered;
      try { discovered = listAllEvalProjects(); }
      catch (err) { outputError(err.message); return; }

      if (discovered.length === 0) outputError('No eval projects found.');

      const runnable = discovered.filter((d) => fs.existsSync(path.join(d.projectDir, 'template')));
      const projectDirByName = new Map(discovered.map((d) => [d.name, d.projectDir]));
      const allProjects = runnable.map((d) => d.name);

      const selectedProjects = args.projects
        ? args.projects.split(',').map((s) => s.trim()).filter(Boolean)
        : allProjects;

      if (selectedProjects.length === 0) {
        outputError('No runnable eval projects found (need template/ directory).');
      }

      const suiteDir = path.join(defaultEvalsDir(), '.suite-runs', new Date().toISOString().replace(/[:.]/g, '-'));
      fs.mkdirSync(suiteDir, { recursive: true });

      console.log(`\nEval Suite: ${selectedProjects.length} project(s)\n`);

      const results = [];
      for (const project of selectedProjects) {
        const projectDir = projectDirByName.get(project) || path.join(defaultEvalsDir(), project);
        if (!fs.existsSync(projectDir)) {
          console.log(`  ✗ ${project} — not found, skipping`);
          continue;
        }

        const runs = fs.readdirSync(projectDir).filter((n) => /^v\d+$/.test(n)).map((n) => parseInt(n.slice(1), 10));
        const runNum = runs.length > 0 ? Math.max(...runs) + 1 : 1;

        const prompt = buildEvalPrompt(projectDir, project, runNum);
        const promptFile = path.join(suiteDir, `${project}-v${runNum}.md`);
        fs.writeFileSync(promptFile, prompt);

        const tokens = Math.ceil(prompt.length / 4);
        results.push({ project, version: `v${runNum}`, chars: prompt.length, tokens, file: `${project}-v${runNum}.md` });
        console.log(`  ✓ ${project} v${runNum} — ${tokens} tokens → ${project}-v${runNum}.md`);
      }

      fs.writeFileSync(path.join(suiteDir, 'SUITE.json'), JSON.stringify({
        created: new Date().toISOString(),
        projects: results,
      }, null, 2));

      console.log(`\n✓ Suite prepared: ${results.length} prompt(s) in:`);
      console.log(`  ${path.relative(process.cwd(), suiteDir)}/`);
      console.log(`\nTo run: launch each prompt as a separate agent with worktree isolation.`);
      console.log(`After all complete: gad generation report`);
    },
  });

  const evalReport = defineCommand({
    meta: { name: 'report', description: 'Cross-project comparison from latest TRACE.json of each eval' },
    args: {
      projects: { type: 'string', description: 'Comma-separated project names (default: all with traces)', default: '' },
    },
    run({ args }) {
      let discovered;
      try { discovered = listAllEvalProjects(); }
      catch (err) { outputError(err.message); return; }
      if (discovered.length === 0) outputError('No eval projects found.');

      const projectDirByName = new Map(discovered.map((d) => [d.name, d.projectDir]));
      const allProjects = discovered.map((d) => d.name);

      const selectedProjects = args.projects
        ? args.projects.split(',').map((s) => s.trim()).filter(Boolean)
        : allProjects;

      const rows = [];
      for (const project of selectedProjects) {
        const projectDir = projectDirByName.get(project);
        if (!projectDir || !fs.existsSync(projectDir)) continue;

        const versions = fs.readdirSync(projectDir)
          .filter((n) => /^v\d+$/.test(n))
          .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

        let trace = null, version = null, scoresData = null;
        for (let i = versions.length - 1; i >= 0; i--) {
          const scoresFile = path.join(projectDir, versions[i], 'scores.json');
          const traceFile = path.join(projectDir, versions[i], 'TRACE.json');
          if (fs.existsSync(scoresFile)) {
            try {
              scoresData = JSON.parse(fs.readFileSync(scoresFile, 'utf8'));
              trace = fs.existsSync(traceFile) ? JSON.parse(fs.readFileSync(traceFile, 'utf8')) : {};
              version = versions[i];
              break;
            } catch {}
          }
          if (fs.existsSync(traceFile)) {
            try {
              trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
              version = versions[i];
              break;
            } catch {}
          }
        }

        if (!trace) {
          rows.push({ project, version: '—', type: '', phases: '—', tasks: '—', discipline: '—', planning: '—', skill_acc: '—', human: '—', composite: '—' });
          continue;
        }

        const sc = scoresData?.dimensions || trace.scores || {};
        const compositeVal = scoresData?.composite || trace.scores?.composite || trace.scores?.tooling_composite || trace.scores?.mcp_composite;
        const evalType = scoresData?.eval_type || trace.eval_type || 'implementation';
        const humanScore = trace.human_review?.score ?? sc.human_review ?? null;
        const humanStr = humanScore != null ? humanScore.toFixed(2) : '—';
        const compositeStr = compositeVal != null ? compositeVal.toFixed(3) : '—';
        const compositeLabel = compositeVal != null && humanScore == null && (evalType !== 'tooling' && evalType !== 'mcp') ? compositeStr + '*' : compositeStr;

        if (evalType === 'tooling' || evalType === 'mcp') {
          const tl = trace.tooling || trace.mcp || {};
          rows.push({
            project, version, type: evalType, phases: '—',
            tasks: `${tl.tools_passed || tl.passes || 0}/${tl.tools_tested || tl.invocations || 0}`,
            discipline: '—', planning: '—',
            skill_acc: sc.correctness != null ? (sc.correctness * 100).toFixed(0) + '%' : '—',
            human: '—', composite: compositeStr,
          });
        } else {
          const ga = trace.git_analysis || {};
          const pq = trace.planning_quality || {};
          rows.push({
            project, version, type: 'impl',
            phases: pq.phases_planned || ga.phases_completed || '—',
            tasks: `${pq.tasks_completed || 0}/${pq.tasks_planned || 0}`,
            discipline: ga.per_task_discipline != null ? ga.per_task_discipline.toFixed(2) : (sc.per_task_discipline != null ? sc.per_task_discipline.toFixed(2) : '—'),
            planning: sc.planning_quality != null ? sc.planning_quality.toFixed(3) : '—',
            skill_acc: sc.skill_accuracy != null ? (sc.skill_accuracy * 100).toFixed(0) + '%' : '—',
            human: humanStr,
            composite: compositeLabel,
          });
        }
      }

      if (rows.length === 0) {
        console.log('\nNo eval projects with TRACE.json found.');
        console.log('Run evals first, then: gad eval trace reconstruct --project <name>');
        return;
      }

      output(rows, { title: 'GAD Eval Report — Cross-Project Comparison' });

      const scored = rows.filter((r) => r.composite !== '—');
      if (scored.length > 0) {
        const composites = scored.map((r) => parseFloat(r.composite));
        const avg = composites.reduce((a, b) => a + b, 0) / composites.length;
        console.log(`\nAverage composite: ${avg.toFixed(3)} across ${scored.length} project(s)`);
      }

      const unreviewed = rows.filter((r) => r.human === '—' && r.type === 'impl');
      const noTrace = rows.filter((r) => r.version === '—');
      if (unreviewed.length > 0) {
        console.log(`\n* = auto_composite (no human review). Run: gad generation review <project> <version> --score <0-1>`);
      }
      if (noTrace.length > 0) {
        console.log(`\n${noTrace.length} project(s) without traces:`);
        for (const r of noTrace) console.log(`  ${r.project} — run eval and reconstruct trace`);
      }

      const skillsDir = path.join(defaultEvalsDir(), '..', 'skills');
      if (fs.existsSync(skillsDir)) {
        const allSkills = fs.readdirSync(skillsDir)
          .filter((n) => { try { return fs.statSync(path.join(skillsDir, n)).isDirectory(); } catch { return false; } })
          .map((n) => `gad:${n}`);

        const skillAliases = { 'gad:verify-work': 'gad:verify-phase' };

        const testedSkills = new Set();
        for (const project of allProjects) {
          const projectDir = projectDirByName.get(project);
          if (!projectDir || !fs.existsSync(projectDir)) continue;
          const versions = fs.readdirSync(projectDir).filter((n) => /^v\d+$/.test(n));
          for (const v of versions) {
            const traceFile = path.join(projectDir, v, 'TRACE.json');
            if (!fs.existsSync(traceFile)) continue;
            try {
              const t = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
              const triggers = t.skill_accuracy?.expected_triggers || [];
              for (const tr of triggers) {
                const rawName = (tr.skill || '').replace(/^\//, '');
                const name = skillAliases[rawName] || rawName;
                if (name.startsWith('gad:')) testedSkills.add(name);
              }
            } catch {}
          }
        }

        const untestedSkills = allSkills.filter((s) => !testedSkills.has(s));
        const coverage = ((allSkills.length - untestedSkills.length) / allSkills.length * 100).toFixed(0);

        console.log(`\nSkill coverage: ${testedSkills.size}/${allSkills.length} skills tested (${coverage}%)`);
        if (untestedSkills.length > 0) {
          console.log(`Untested: ${untestedSkills.join(', ')}`);
        }
      }
    },
  });

  const evalReadme = defineCommand({
    meta: { name: 'readme', description: 'Inject scores, timestamps, and discipline metrics into eval project README (decision gad-118)' },
    args: { project: { type: 'string', description: 'Eval project name', required: true } },
    run({ args }) {
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projectDir)) {
        outputError(`Eval project '${args.project}' not found.`);
        return;
      }

      const runs = fs.readdirSync(projectDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && r.name.startsWith('v'))
        .map((r) => r.name)
        .sort();

      let projectCfg = {};
      let firstSpecies = {};
      try { projectCfg = loadEvalProject(projectDir); } catch {}
      try {
        const resolved = loadAllResolvedSpecies(projectDir);
        if (resolved.length > 0) firstSpecies = resolved[0] || {};
      } catch {}
      const pick = (...vals) => {
        for (const v of vals) if (v != null && v !== '') return v;
        return null;
      };
      const description = pick(projectCfg.description, firstSpecies.description);
      const domain = pick(projectCfg.domain, firstSpecies.domain);
      const evalMode = pick(firstSpecies.eval_mode, firstSpecies.evalMode);
      const workflow = pick(firstSpecies.workflow);
      const techStackVal = pick(projectCfg.techStack, firstSpecies.techStack);
      const buildReqVal = pick(firstSpecies.buildRequirement, projectCfg.buildRequirement);

      const lines = [
        `# ${args.project}`, '',
        description || '', '',
        `| Field | Value |`,
        `|---|---|`,
        `| Domain | ${domain || '—'} |`,
        `| Mode | ${evalMode || '—'} |`,
        `| Workflow | ${workflow || '—'} |`,
        `| Tech stack | ${techStackVal || '—'} |`,
        `| Build requirement | ${buildReqVal || '—'} |`,
        `| Runs | ${runs.length} |`, '',
      ];

      if (runs.length > 0) {
        lines.push('## Runs', '', '| Version | Date | Human | Composite | Status |', '|---|---|---|---|---|');
        for (const v of runs) {
          const tracePath = path.join(projectDir, v, 'TRACE.json');
          let date = '—', human = '—', composite = '—', status = '—';
          if (fs.existsSync(tracePath)) {
            try {
              const t = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
              date = t.date || '—';
              human = t.human_review?.score != null ? String(t.human_review.score) : '—';
              composite = t.scores?.composite != null ? t.scores.composite.toFixed(3) : '—';
              status = t.timing?.ended ? 'complete' : 'in-progress';
            } catch {}
          }
          lines.push(`| ${v} | ${date} | ${human} | ${composite} | ${status} |`);
        }
        lines.push('');
      }

      lines.push(`*Generated by \`gad eval readme\` on ${new Date().toISOString().split('T')[0]}*`);

      const readmePath = path.join(projectDir, 'README.md');
      fs.writeFileSync(readmePath, lines.join('\n') + '\n');
      console.log(`✓ Written ${readmePath}`);
    },
  });

  const evalInheritSkills = defineCommand({
    meta: { name: 'inherit-skills', description: 'Copy agent-authored skills from a completed eval into another eval template (decision gad-112)' },
    args: {
      from: { type: 'string', description: 'Source eval project (or project/vN for a specific run)', required: true },
      to: { type: 'string', description: 'Target eval project name', required: true },
      'latest-only': { type: 'boolean', description: 'Only inherit skills from the latest run (not accumulated)', default: false },
    },
    run({ args }) {
      const parts = (args.from || '').split('/');
      const srcProject = parts[0];
      let srcVersion = parts[1] || null;

      if (!srcProject) {
        outputError('Usage: gad eval inherit-skills --from eval-project --to target-project');
        return;
      }

      const srcProjectDir = resolveOrDefaultEvalProjectDir(srcProject);

      if (!srcVersion) {
        if (!fs.existsSync(srcProjectDir)) {
          outputError(`Eval project '${srcProject}' not found.`);
          return;
        }
        const runs = fs.readdirSync(srcProjectDir, { withFileTypes: true })
          .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
          .map((r) => ({ name: r.name, num: parseInt(r.name.slice(1), 10) }))
          .sort((a, b) => b.num - a.num);
        if (runs.length === 0) {
          outputError(`No runs found for ${srcProject}. Run an eval first.`);
          return;
        }
        srcVersion = runs[0].name;
        console.log(`  Using latest run: ${srcProject}/${srcVersion}`);
      }

      const srcRunDir = path.join(srcProjectDir, srcVersion, 'run');
      if (!fs.existsSync(srcRunDir)) {
        outputError(`Source run not found: ${srcRunDir}`);
        return;
      }
      const targetProjectDir = resolveOrDefaultEvalProjectDir(args.to);

      const skillsDirs = [
        path.join(srcRunDir, 'game', '.planning', 'skills'),
        path.join(srcRunDir, '.planning', 'skills'),
        path.join(srcRunDir, 'game', 'skills'),
      ];
      let srcSkillsDir = null;
      for (const d of skillsDirs) {
        if (fs.existsSync(d)) { srcSkillsDir = d; break; }
      }

      if (!srcSkillsDir) {
        console.log(`No agent-authored skills found in ${srcProject}/${srcVersion}`);
        console.log('Checked: game/.planning/skills/, .planning/skills/, game/skills/');
        return;
      }

      const skills = fs.readdirSync(srcSkillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);

      if (skills.length === 0) {
        console.log('No skills found in source directory.');
        return;
      }

      const targetDir = path.join(targetProjectDir, 'template', 'skills');
      fs.mkdirSync(targetDir, { recursive: true });

      for (const skill of skills) {
        const src = path.join(srcSkillsDir, skill);
        const dest = path.join(targetDir, skill);
        fs.cpSync(src, dest, { recursive: true });
        console.log(`  ✓ Inherited: ${skill} (from ${srcProject}/${srcVersion})`);
      }

      const agentsMd = path.join(targetProjectDir, 'template', 'AGENTS.md');
      if (fs.existsSync(agentsMd)) {
        let content = fs.readFileSync(agentsMd, 'utf8');
        const section = `\n\n## Inherited Skills (from ${srcProject}/${srcVersion})\n\n${skills.map((s) => '- `skills/' + s + '/SKILL.md`').join('\n')}\n`;
        if (!content.includes('## Inherited Skills')) {
          content += section;
          fs.writeFileSync(agentsMd, content);
        }
      }

      const metaFile = path.join(targetProjectDir, 'template', '.inherited-skills.json');
      const meta = {
        inherited_at: new Date().toISOString(),
        source: `${srcProject}/${srcVersion}`,
        skills: skills.map((s) => ({ name: s, source_path: path.join(srcSkillsDir, s) })),
      };
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

      console.log(`\n✓ Inherited ${skills.length} skill(s) from ${srcProject}/${srcVersion} → ${args.to}`);
    },
  });

  return { evalSetup, evalSuite, evalReport, evalReadme, evalInheritSkills };
}

module.exports = { createEvalSuiteCommands };
module.exports.provides = (ctx) =>
  createEvalSuiteCommands({ ...ctx.common, ...ctx.extras.eval });
