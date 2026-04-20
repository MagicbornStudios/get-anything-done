'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { defineCommand } = require('citty');

function createEvalTraceReconstructCommand({
  listEvalProjectsHint,
  resolveOrDefaultEvalProjectDir,
  outputError,
  readXmlFile,
  findRepoRoot,
}) {
  return defineCommand({
    meta: { name: 'reconstruct', description: 'Reconstruct TRACE.json from git history - no agent cooperation needed' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      path: { type: 'string', description: 'Path to eval worktree or project dir', default: '' },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);

      const runs = fs.readdirSync(projDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .sort((a, b) => parseInt(b.name.slice(1)) - parseInt(a.name.slice(1)));
      if (runs.length === 0) { outputError('No runs found.'); return; }
      const version = runs[0].name;
      const traceFile = path.join(projDir, version, 'TRACE.json');

      let trace = {};
      if (fs.existsSync(traceFile)) trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));

      let gitLog = '';
      const gadRepoDir = path.join(__dirname, '..', '..', '..');
      const evalRelPath = path.relative(gadRepoDir, projDir);
      try {
        gitLog = execSync(`git log --all --format="%H|%aI|%s" --name-only -- "${evalRelPath}"`, {
          cwd: gadRepoDir, encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
      } catch {}
      if (!gitLog) {
        try {
          gitLog = execSync(`git log --all --format="%H|%aI|%s" --name-only -- "${path.relative(findRepoRoot(), projDir)}"`, {
            cwd: findRepoRoot(), encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
          }).trim();
        } catch {}
      }

      if (!gitLog) { console.log('No git history found for this eval project.'); return; }

      const commits = [];
      let currentCommit = null;
      for (const line of gitLog.split('\n')) {
        if (line.includes('|')) {
          const [hash, date, ...msgParts] = line.split('|');
          currentCommit = { hash, date, message: msgParts.join('|'), files: [] };
          commits.push(currentCommit);
        } else if (line.trim() && currentCommit) {
          currentCommit.files.push(line.trim());
        }
      }

      let phasesCompleted = 0;
      let tasksCompleted = 0;
      let stateUpdates = 0;
      let decisionsAdded = 0;
      const taskIds = [];

      const templatePlanDir = path.join(projDir, 'template', '.planning');
      const taskRegXml = readXmlFile(path.join(templatePlanDir, 'TASK-REGISTRY.xml'));
      if (taskRegXml) {
        const doneMatches = taskRegXml.match(/status="done"/g);
        tasksCompleted = doneMatches ? doneMatches.length : 0;
        const taskIdMatches = taskRegXml.match(/id="([^"]+)"/g);
        if (taskIdMatches) {
          for (const m of taskIdMatches) {
            const id = m.match(/id="([^"]+)"/)[1];
            if (id && !id.startsWith('0')) taskIds.push(id);
          }
        }
      }

      const roadmapXml = readXmlFile(path.join(templatePlanDir, 'ROADMAP.xml'));
      if (roadmapXml) {
        const donePhases = roadmapXml.match(/status="done"/g) || roadmapXml.match(/status="complete"/g);
        phasesCompleted = donePhases ? donePhases.length : 0;
      }

      const decisionsXml = readXmlFile(path.join(templatePlanDir, 'DECISIONS.xml'));
      if (decisionsXml) {
        const decMatches = decisionsXml.match(/<decision\s/g);
        decisionsAdded = decMatches ? decMatches.length : 0;
      }

      stateUpdates = commits.filter((c) => c.files.some((f) => f.includes('STATE.xml') || f.includes('STATE.md'))).length;

      const taskCommits = commits.filter((c) => /\d+-\d+/.test(c.message));
      const batchCommits = commits.filter((c) => !(/\d+-\d+/.test(c.message)) && c.files.length > 3);

      const timestamps = commits.map((c) => new Date(c.date).getTime()).filter((t) => !isNaN(t));
      const started = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : trace.timing?.started;
      const ended = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : trace.timing?.ended;
      const durationMin = started && ended ? Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 60000) : null;

      const sourceFiles = new Set();
      for (const c of commits) {
        for (const f of c.files) {
          if (f.includes('/src/') || f.includes('/game/')) sourceFiles.add(f);
        }
      }

      const reconstructed = {
        ...trace,
        eval: args.project,
        version,
        eval_type: 'implementation',
        reconstructed: true,
        reconstructed_at: new Date().toISOString(),
        timing: {
          started: started || trace.timing?.started,
          ended: ended || trace.timing?.ended,
          duration_minutes: durationMin,
          phases_completed: phasesCompleted,
          tasks_completed: tasksCompleted,
        },
        git_analysis: {
          total_commits: commits.length,
          task_id_commits: taskCommits.length,
          batch_commits: batchCommits.length,
          source_files_created: sourceFiles.size,
          state_updates: stateUpdates,
          decisions_added: decisionsAdded,
          per_task_discipline: taskCommits.length > 0 ? (taskCommits.length / Math.max(tasksCompleted, 1)) : 0,
        },
        planning_quality: {
          phases_planned: roadmapXml ? (roadmapXml.match(/<phase/g) || []).length : 0,
          tasks_planned: taskRegXml ? (taskRegXml.match(/<task/g) || []).length : 0,
          tasks_completed: tasksCompleted,
          tasks_blocked: 0,
          decisions_captured: decisionsAdded,
          state_updates: stateUpdates,
          state_stale_count: Math.max(0, tasksCompleted - stateUpdates),
        },
      };

      const hasPhaseGoals = roadmapXml && (roadmapXml.match(/<goal>/g) || []).length > 0;
      const hasDoneTasks = tasksCompleted > 0;
      const hasPerTaskCommits = taskCommits.length > 0;
      const conventionsExists = fs.existsSync(path.join(templatePlanDir, 'CONVENTIONS.md'));
      const verificationExists = fs.existsSync(path.join(templatePlanDir, 'VERIFICATION.md'));
      const verifyCommits = commits.filter((c) => /^verify:/i.test(c));
      const hasVerification = verificationExists || verifyCommits.length > 0;
      const evalDecisions = readXmlFile(path.join(templatePlanDir, 'DECISIONS.xml'));
      const hasDecisions = evalDecisions && (evalDecisions.match(/<decision /g) || []).length > 0;
      const hasMultiplePhases = roadmapXml && (roadmapXml.match(/<phase /g) || []).length > 1;
      const evalState = readXmlFile(path.join(templatePlanDir, 'STATE.xml'));
      const hasStateNextAction = evalState && /<next-action>[^<]+<\/next-action>/.test(evalState);
      const hasPhaseDoneInRoadmap = roadmapXml && /<status>done<\/status>/.test(roadmapXml);
      const evalTaskReg = readXmlFile(path.join(templatePlanDir, 'TASK-REGISTRY.xml'));
      const hasInProgressToDone = evalTaskReg && /status="done"/.test(evalTaskReg);
      const worktreeRoot = path.dirname(templatePlanDir);
      const hasBuildArtifact = ['dist', 'demo', 'game/dist', 'build', 'out'].some((d) =>
        fs.existsSync(path.join(worktreeRoot, d)) && fs.statSync(path.join(worktreeRoot, d)).isDirectory()
      );
      const hasArchDoc = fs.existsSync(path.join(templatePlanDir, 'ARCHITECTURE.md'));

      reconstructed.skill_accuracy = {
        expected_triggers: [
          { skill: '/gad:plan-phase', when: 'before implementation', triggered: hasPhaseGoals, evidence: 'ROADMAP.xml has <goal> elements' },
          { skill: '/gad:execute-phase', when: 'per phase', triggered: hasDoneTasks, evidence: 'tasks marked done in TASK-REGISTRY.xml' },
          { skill: '/gad:task-checkpoint', when: 'between tasks', triggered: hasPerTaskCommits, evidence: 'commits reference task IDs' },
          { skill: '/gad:verify-work', when: 'after phase completion', triggered: hasVerification, evidence: 'VERIFICATION.md exists or verify: commits found' },
          { skill: '/gad:auto-conventions', when: 'after first code phase', triggered: conventionsExists, evidence: 'CONVENTIONS.md exists' },
          { skill: '/gad:check-todos', when: 'session start or between phases', triggered: hasStateNextAction, evidence: 'STATE.xml has non-empty next-action' },
          { skill: 'decisions-captured', when: 'during implementation', triggered: hasDecisions, evidence: 'DECISIONS.xml has <decision> entries' },
          { skill: 'multi-phase-planning', when: 'before execution', triggered: hasMultiplePhases, evidence: 'ROADMAP.xml has >1 phase' },
          { skill: 'phase-completion', when: 'during execution', triggered: hasPhaseDoneInRoadmap, evidence: 'at least one phase marked done in ROADMAP.xml' },
          { skill: 'task-lifecycle', when: 'per task', triggered: hasInProgressToDone, evidence: 'tasks transition from planned to done in TASK-REGISTRY.xml' },
          { skill: 'build-artifact', when: 'final phase', triggered: hasBuildArtifact, evidence: 'dist/ or demo/ directory exists with build output' },
          { skill: 'architecture-doc', when: 'before final commit', triggered: hasArchDoc, evidence: 'ARCHITECTURE.md exists in .planning/' },
        ],
        accuracy: null,
      };
      const expectedCount = reconstructed.skill_accuracy.expected_triggers.length;
      const triggeredCount = reconstructed.skill_accuracy.expected_triggers.filter((e) => e.triggered).length;
      reconstructed.skill_accuracy.accuracy = expectedCount > 0 ? triggeredCount / expectedCount : null;

      const pq = reconstructed.planning_quality;
      if (pq.tasks_planned > 0) {
        const taskRatio = pq.tasks_completed / pq.tasks_planned;
        const stalePenalty = pq.state_updates > 0 ? (1 - pq.state_stale_count / Math.max(pq.state_updates + pq.state_stale_count, 1)) : 0;
        reconstructed.scores = reconstructed.scores || {};
        reconstructed.scores.planning_quality = taskRatio * stalePenalty;
      }

      if (durationMin != null) {
        reconstructed.scores = reconstructed.scores || {};
        reconstructed.scores.time_efficiency = Math.max(0, Math.min(1, 1 - (durationMin / 480)));
      }

      const scores = reconstructed.scores || {};
      scores.skill_accuracy = reconstructed.skill_accuracy.accuracy;
      scores.per_task_discipline = reconstructed.git_analysis.per_task_discipline;
      scores.requirement_coverage = reconstructed.requirement_coverage?.coverage_ratio ?? null;
      scores.human_review = null;
      if (scores.requirement_coverage != null && scores.planning_quality != null && scores.skill_accuracy != null && scores.time_efficiency != null && scores.per_task_discipline != null) {
        scores.auto_composite = (scores.requirement_coverage * 0.25) + (scores.planning_quality * 0.25) + (scores.per_task_discipline * 0.25) + (scores.skill_accuracy * 0.167) + (scores.time_efficiency * 0.083);
        scores.composite = scores.auto_composite;
      }
      reconstructed.scores = scores;
      reconstructed.trace_schema_version = 3;

      fs.writeFileSync(traceFile, JSON.stringify(reconstructed, null, 2));

      console.log(`\nTrace reconstructed: evals/${args.project}/${version}/TRACE.json`);
      console.log(`\n  Git commits analyzed:  ${commits.length}`);
      console.log(`  Phases completed:      ${phasesCompleted}`);
      console.log(`  Tasks completed:       ${tasksCompleted}`);
      console.log(`  Task-id commits:       ${taskCommits.length} / ${commits.length}`);
      console.log(`  State updates:         ${stateUpdates}`);
      console.log(`  Decisions captured:    ${decisionsAdded}`);
      console.log(`  Source files created:  ${sourceFiles.size}`);
      console.log(`  Per-task discipline:   ${reconstructed.git_analysis.per_task_discipline.toFixed(2)}`);
      console.log(`  Duration:              ${durationMin} min`);
      if (reconstructed.scores?.planning_quality != null) {
        console.log(`  Planning quality:      ${reconstructed.scores.planning_quality.toFixed(3)}`);
      }
    },
  });
}

module.exports = { createEvalTraceReconstructCommand };
