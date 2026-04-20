'use strict';

const { defineCommand } = require('citty');
const {
  discoverEvalProjects,
  fs,
  listRunVersions,
  parseSelectedProjects,
  path,
  readJsonIfExists,
} = require('./shared.cjs');

function createEvalReportCommand({ listAllEvalProjects, defaultEvalsDir, outputError, output }) {
  return defineCommand({
    meta: { name: 'report', description: 'Cross-project comparison from latest TRACE.json of each eval' },
    args: {
      projects: { type: 'string', description: 'Comma-separated project names (default: all with traces)', default: '' },
    },
    run({ args }) {
      const discovered = discoverEvalProjects(listAllEvalProjects, outputError);
      if (!discovered) return;

      const projectDirByName = new Map(discovered.map((d) => [d.name, d.projectDir]));
      const allProjects = discovered.map((d) => d.name);
      const selectedProjects = parseSelectedProjects(args.projects, allProjects);

      const rows = [];
      for (const project of selectedProjects) {
        const projectDir = projectDirByName.get(project);
        if (!projectDir || !fs.existsSync(projectDir)) continue;

        const versions = listRunVersions(projectDir);
        let trace = null;
        let version = null;
        let scoresData = null;

        for (let i = versions.length - 1; i >= 0; i--) {
          const scoresFile = path.join(projectDir, versions[i], 'scores.json');
          const traceFile = path.join(projectDir, versions[i], 'TRACE.json');
          if (fs.existsSync(scoresFile)) {
            scoresData = readJsonIfExists(scoresFile);
            trace = fs.existsSync(traceFile) ? readJsonIfExists(traceFile) || {} : {};
            version = versions[i];
            break;
          }
          if (fs.existsSync(traceFile)) {
            trace = readJsonIfExists(traceFile);
            version = versions[i];
            break;
          }
        }

        if (!trace) {
          rows.push({ project, version: '-', type: '', phases: '-', tasks: '-', discipline: '-', planning: '-', skill_acc: '-', human: '-', composite: '-' });
          continue;
        }

        const sc = scoresData?.dimensions || trace.scores || {};
        const compositeVal = scoresData?.composite || trace.scores?.composite || trace.scores?.tooling_composite || trace.scores?.mcp_composite;
        const evalType = scoresData?.eval_type || trace.eval_type || 'implementation';
        const humanScore = trace.human_review?.score ?? sc.human_review ?? null;
        const humanStr = humanScore != null ? humanScore.toFixed(2) : '-';
        const compositeStr = compositeVal != null ? compositeVal.toFixed(3) : '-';
        const compositeLabel = compositeVal != null && humanScore == null && evalType !== 'tooling' && evalType !== 'mcp'
          ? `${compositeStr}*`
          : compositeStr;

        if (evalType === 'tooling' || evalType === 'mcp') {
          const tl = trace.tooling || trace.mcp || {};
          rows.push({
            project, version, type: evalType, phases: '-',
            tasks: `${tl.tools_passed || tl.passes || 0}/${tl.tools_tested || tl.invocations || 0}`,
            discipline: '-', planning: '-',
            skill_acc: sc.correctness != null ? `${(sc.correctness * 100).toFixed(0)}%` : '-',
            human: '-', composite: compositeStr,
          });
        } else {
          const ga = trace.git_analysis || {};
          const pq = trace.planning_quality || {};
          rows.push({
            project, version, type: 'impl',
            phases: pq.phases_planned || ga.phases_completed || '-',
            tasks: `${pq.tasks_completed || 0}/${pq.tasks_planned || 0}`,
            discipline: ga.per_task_discipline != null ? ga.per_task_discipline.toFixed(2) : (sc.per_task_discipline != null ? sc.per_task_discipline.toFixed(2) : '-'),
            planning: sc.planning_quality != null ? sc.planning_quality.toFixed(3) : '-',
            skill_acc: sc.skill_accuracy != null ? `${(sc.skill_accuracy * 100).toFixed(0)}%` : '-',
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

      output(rows, { title: 'GAD Eval Report - Cross-Project Comparison' });

      const scored = rows.filter((r) => r.composite !== '-');
      if (scored.length > 0) {
        const composites = scored.map((r) => parseFloat(String(r.composite).replace('*', '')));
        const avg = composites.reduce((a, b) => a + b, 0) / composites.length;
        console.log(`\nAverage composite: ${avg.toFixed(3)} across ${scored.length} project(s)`);
      }

      const unreviewed = rows.filter((r) => r.human === '-' && r.type === 'impl');
      const noTrace = rows.filter((r) => r.version === '-');
      if (unreviewed.length > 0) {
        console.log('\n* = auto_composite (no human review). Run: gad generation review <project> <version> --score <0-1>');
      }
      if (noTrace.length > 0) {
        console.log(`\n${noTrace.length} project(s) without traces:`);
        for (const row of noTrace) console.log(`  ${row.project} - run eval and reconstruct trace`);
      }

      const skillsDir = path.join(defaultEvalsDir(), '..', 'skills');
      if (!fs.existsSync(skillsDir)) return;

      const allSkills = fs.readdirSync(skillsDir)
        .filter((n) => {
          try { return fs.statSync(path.join(skillsDir, n)).isDirectory(); } catch { return false; }
        })
        .map((n) => `gad:${n}`);
      const skillAliases = { 'gad:verify-work': 'gad:verify-phase' };
      const testedSkills = new Set();

      for (const project of allProjects) {
        const projectDir = projectDirByName.get(project);
        if (!projectDir || !fs.existsSync(projectDir)) continue;
        const versions = listRunVersions(projectDir);
        for (const version of versions) {
          const traceFile = path.join(projectDir, version, 'TRACE.json');
          const trace = readJsonIfExists(traceFile);
          if (!trace) continue;
          const triggers = trace.skill_accuracy?.expected_triggers || [];
          for (const trigger of triggers) {
            const rawName = String(trigger.skill || '').replace(/^\//, '');
            const name = skillAliases[rawName] || rawName;
            if (name.startsWith('gad:')) testedSkills.add(name);
          }
        }
      }

      const untestedSkills = allSkills.filter((skill) => !testedSkills.has(skill));
      const coverage = ((allSkills.length - untestedSkills.length) / allSkills.length * 100).toFixed(0);
      console.log(`\nSkill coverage: ${testedSkills.size}/${allSkills.length} skills tested (${coverage}%)`);
      if (untestedSkills.length > 0) {
        console.log(`Untested: ${untestedSkills.join(', ')}`);
      }
    },
  });
}

module.exports = { createEvalReportCommand };
