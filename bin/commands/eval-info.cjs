'use strict';
/**
 * Read-only eval/generation surfaces:
 *   gad eval list / status / runs / show / scores / score / diff / version
 *
 * Required deps: listAllEvalProjects, listEvalProjectsHint,
 *   resolveOrDefaultEvalProjectDir, outputError, output, evalDataAccess,
 *   loadEvalProject, loadAllResolvedSpecies, findRepoRoot, gadConfig, pkg.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvalInfoCommands(deps) {
  const {
    listAllEvalProjects,
    listEvalProjectsHint,
    resolveOrDefaultEvalProjectDir,
    outputError,
    output,
    evalDataAccess,
    loadEvalProject,
    loadAllResolvedSpecies,
    findRepoRoot,
    gadConfig,
    pkg,
  } = deps;

  const evalList = defineCommand({
    meta: { name: 'list', description: '[DEPRECATED] List projects with species counts and generation history' },
    run() {
      let discovered;
      try { discovered = listAllEvalProjects(); }
      catch (err) { outputError(err.message); return; }

      if (discovered.length === 0) {
        console.log('No projects found. Create evals/<project>/species/<species>/species.json to get started.');
        return;
      }

      const da = evalDataAccess();
      const projects = discovered.map(({ name, projectDir }) => {
        let speciesCount = 0;
        let totalGenerations = 0;
        let latestGeneration = '—';
        let latestStatus = '—';
        // Project ⊇ species merge-at-read-time loader (task 42.4-15, decision gad-184).
        let mode = '—', workflow = '—', domain = '—', techStack = '';
        try {
          const summary = da.getProjectSummary(name);
          const projectCfg = loadEvalProject(projectDir);
          speciesCount = summary?.speciesCount || 0;
          totalGenerations = summary?.totalGenerations || 0;
          if (projectCfg.domain) domain = projectCfg.domain;
          if (projectCfg.techStack) techStack = projectCfg.techStack;
          const allResolved = Array.isArray(summary?.species) && summary.species.length > 0
            ? summary.species
            : loadAllResolvedSpecies(projectDir);
          if (allResolved.length > 0) {
            const first = allResolved[0];
            if (first.workflow) workflow = first.workflow;
            if (first.eval_mode) mode = first.eval_mode;
            if (!domain && first.domain) domain = first.domain;
            if (!techStack && first.techStack) techStack = first.techStack;
          }
          const latestCandidate = allResolved
            .filter((species) => species && species.latestGeneration)
            .map((species) => {
              const versionLabel = String(
                species.latestGeneration?.version
                || species.latestGeneration?.id
                || species.latestGeneration?.name
                || species.latestGeneration
              );
              const match = versionLabel.match(/^v(\d+)$/i);
              const versionNumber = match ? Number.parseInt(match[1], 10) : -1;
              return { species: species.species || species.id || '', versionLabel, versionNumber };
            })
            .sort((a, b) => b.versionNumber - a.versionNumber || a.species.localeCompare(b.species))[0] || null;
          if (latestCandidate) {
            latestGeneration = `${latestCandidate.species}/${latestCandidate.versionLabel}`;
            const runMd = path.join(projectDir, 'species', latestCandidate.species, latestCandidate.versionLabel, 'RUN.md');
            if (fs.existsSync(runMd)) {
              const m = fs.readFileSync(runMd, 'utf8').match(/status:\s*([\w-]+)/);
              if (m) latestStatus = m[1];
            }
          }
        } catch (err) {
          // sparse/malformed metadata is non-fatal for `eval list`
          void err;
        }
        void latestStatus;
        return {
          project: name,
          domain,
          mode,
          workflow,
          species: speciesCount,
          generations: totalGenerations,
          'latest-generation': latestGeneration,
          'latest-status': latestStatus,
        };
      });

      output(projects, { title: 'GAD Projects / Species / Generations' });
      console.log(`\n${projects.length} project(s), ${projects.reduce((s, p) => s + p.species, 0)} species, ${projects.reduce((s, p) => s + p.generations, 0)} total generations`);
    },
  });

  const evalScore = defineCommand({
    meta: { name: 'score', description: 'Compute SCORE.md for latest (or specified) eval run' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      version: { type: 'string', description: 'Version to score (default: latest)', default: '' },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const { generateScore } = require('../../lib/score-generator.cjs');
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);

      if (!fs.existsSync(projectDir)) {
        outputError(`Eval project '${args.project}' not found.`);
      }

      const versions = fs.readdirSync(projectDir)
        .filter((n) => /^v\d+$/.test(n))
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

      if (versions.length === 0) {
        outputError(`No runs found for project '${args.project}'. Run \`gad species run --project ${args.project}\` first.`);
      }

      const version = args.version || versions[versions.length - 1];
      if (!versions.includes(version)) {
        outputError(`Version '${version}' not found. Available: ${versions.join(', ')}`);
      }

      try {
        const scorePath = generateScore(projectDir, version);
        console.log(`\n✓ SCORE.md written: ${path.relative(process.cwd(), scorePath)}`);
      } catch (e) {
        outputError(e.message);
      }
    },
  });

  const evalDiff = defineCommand({
    meta: { name: 'diff', description: 'Diff two eval run score files' },
    args: {
      v1: { type: 'positional', description: 'First version (e.g. v1)', required: false },
      v2: { type: 'positional', description: 'Second version (e.g. v2)', required: false },
      project: { type: 'string', description: 'Eval project name', default: '' },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      if (!args.v1 || !args.v2) {
        console.error(`\nUsage: gad eval diff v1 v2 --project ${args.project}\n`);
        process.exit(1);
      }
      const { diffVersions } = require('../../lib/score-generator.cjs');
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);

      if (!fs.existsSync(projectDir)) outputError(`Eval project '${args.project}' not found.`);

      // Framework version mismatch check (decisions gad-51, gad-54).
      try {
        const t1Path = path.join(projectDir, args.v1, 'TRACE.json');
        const t2Path = path.join(projectDir, args.v2, 'TRACE.json');
        if (fs.existsSync(t1Path) && fs.existsSync(t2Path)) {
          const t1 = JSON.parse(fs.readFileSync(t1Path, 'utf8'));
          const t2 = JSON.parse(fs.readFileSync(t2Path, 'utf8'));
          const c1 = t1.framework_commit || null;
          const c2 = t2.framework_commit || null;
          const v1Stamp = t1.framework_stamp || t1.framework_version || '(unstamped)';
          const v2Stamp = t2.framework_stamp || t2.framework_version || '(unstamped)';
          if (c1 && c2 && c1 !== c2) {
            console.log('\n⚠  FRAMEWORK MISMATCH');
            console.log(`   ${args.v1} ran against ${v1Stamp}`);
            console.log(`   ${args.v2} ran against ${v2Stamp}`);
            console.log('   Score deltas below may reflect framework changes, not agent changes.');
            console.log('   See skills/framework-upgrade/SKILL.md for the re-run procedure.');
          } else if (!c1 || !c2) {
            console.log('\n⚠  At least one run has no framework_commit stamp.');
            console.log('   Pre-v4 TRACE.json files predate framework versioning (decision gad-51).');
            console.log('   Cross-version comparisons against unstamped runs are unreliable.');
          }
        }
      } catch (err) {
        process.stderr.write(`framework-check: ${err.message}\n`);
      }

      try {
        const table = diffVersions(projectDir, args.v1, args.v2);
        console.log('\n' + table);
      } catch (e) {
        outputError(e.message);
      }
    },
  });

  const evalStatus = defineCommand({
    meta: { name: 'status', description: 'Show all projects and eval coverage gaps' },
    run() {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);

      let discovered;
      try { discovered = listAllEvalProjects(); }
      catch (err) { outputError(err.message); return; }
      const evalProjects = discovered.map((d) => d.name);
      const evalProjectDirByName = new Map(discovered.map((d) => [d.name, d.projectDir]));

      const rows = config.roots.map((root) => {
        const evalMatches = evalProjects.filter((ep) => ep.includes(root.id) || root.id.includes(ep));
        const evalName = evalMatches[0] || null;
        let runs = 0, latest = '—', status = '—';
        if (evalName) {
          const projectDir = evalProjectDirByName.get(evalName);
          const runDirs = fs.readdirSync(projectDir, { withFileTypes: true })
            .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name)).map((r) => r.name).sort();
          runs = runDirs.length;
          latest = runs > 0 ? runDirs[runDirs.length - 1] : '—';
          if (latest !== '—') {
            const runMd = path.join(projectDir, latest, 'RUN.md');
            if (fs.existsSync(runMd)) {
              const m = fs.readFileSync(runMd, 'utf8').match(/status:\s*([\w-]+)/);
              if (m) status = m[1];
            }
          }
        }
        const gap = !evalName ? 'NO EVAL' : runs === 0 ? 'NO RUNS' : status === 'completed' ? 'ok' : status;
        return { project: root.id, eval: evalName || '—', runs, latest, status: status === '—' && !evalName ? '—' : status, gap };
      });

      output(rows, { title: 'GAD Eval Coverage' });
      const gaps = rows.filter((r) => r.gap !== 'ok');
      if (gaps.length > 0) {
        console.log(`\n${gaps.length} project(s) with gaps:`);
        for (const g of gaps) console.log(`  ${g.project}  →  ${g.gap}`);
      } else {
        console.log('\n✓ All projects have eval coverage.');
      }
    },
  });

  const evalRuns = defineCommand({
    meta: { name: 'runs', description: 'List runs for an eval project' },
    args: { project: { type: 'string', description: 'Eval project name', default: '' } },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projectDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

      const runDirs = fs.readdirSync(projectDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .map((r) => r.name)
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

      if (runDirs.length === 0) {
        console.log(`No runs yet for '${args.project}'. Run: gad species run --project ${args.project}`);
        return;
      }

      const rows = runDirs.map((v) => {
        const runMd = path.join(projectDir, v, 'RUN.md');
        let started = '—', status = '—', baseline = '—';
        if (fs.existsSync(runMd)) {
          const content = fs.readFileSync(runMd, 'utf8');
          const ms = content.match(/started:\s*(.+)/); if (ms) started = ms[1].trim().slice(0, 16).replace('T', ' ');
          const mv = content.match(/status:\s*([\w-]+)/); if (mv) status = mv[1];
          const mb = content.match(/baseline:\s*(.+)/); if (mb) baseline = mb[1].trim();
        }
        const scoreFile = path.join(projectDir, v, 'SCORE.md');
        const scored = fs.existsSync(scoreFile) ? 'yes' : 'no';
        return { version: v, status, baseline, started, scored };
      });

      output(rows, { title: `Eval Runs: ${args.project} (${rows.length} runs)` });
    },
  });

  const evalShow = defineCommand({
    meta: { name: 'show', description: 'Show output of an eval run' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      version: { type: 'string', description: 'Version to show (default: latest)', default: '' },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projectDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

      const runDirs = fs.readdirSync(projectDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .map((r) => r.name)
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

      if (runDirs.length === 0) { outputError(`No runs found for '${args.project}'.`); return; }

      const version = args.version || runDirs[runDirs.length - 1];
      if (!runDirs.includes(version)) { outputError(`Version '${version}' not found. Available: ${runDirs.join(', ')}`); return; }

      const runDir = path.join(projectDir, version);
      const filesToShow = ['RUN.md', 'SCORE.md', 'eval-output.txt', 'RESULTS.md'];
      console.log(`\nEval: ${args.project}  ${version}\n`);
      for (const f of filesToShow) {
        const p = path.join(runDir, f);
        if (!fs.existsSync(p)) continue;
        console.log(`${'─'.repeat(60)}`);
        console.log(`# ${f}`);
        console.log(`${'─'.repeat(60)}`);
        console.log(fs.readFileSync(p, 'utf8'));
      }
    },
  });

  const evalScores = defineCommand({
    meta: { name: 'scores', description: 'Compare SCORE.md across runs for a project' },
    args: { project: { type: 'string', description: 'Eval project name', default: '' } },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projectDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

      const runDirs = fs.readdirSync(projectDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .map((r) => r.name)
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

      const rows = [];
      for (const v of runDirs) {
        const scoreFile = path.join(projectDir, v, 'SCORE.md');
        if (!fs.existsSync(scoreFile)) { rows.push({ version: v, score: '—', note: 'no SCORE.md' }); continue; }
        const content = fs.readFileSync(scoreFile, 'utf8');
        const m = content.match(/total[:\s]+\**(\d+\/\d+)\**/i) || content.match(/(\d+)\/(\d+)/);
        const score = m ? (m[1] || `${m[1]}/${m[2]}`) : '?';
        const note = content.split('\n').slice(0, 5).join(' ').slice(0, 60);
        rows.push({ version: v, score, note });
      }

      if (rows.length === 0) { console.log(`No runs found for '${args.project}'.`); return; }
      output(rows, { title: `Scores: ${args.project}` });
      console.log(`\nTo see a run: gad eval show --project ${args.project} --version <v>`);
      console.log(`To diff:      gad eval diff v1 v2 --project ${args.project}`);
    },
  });

  const evalVersion = defineCommand({
    meta: { name: 'version', description: 'Print GAD methodology version' },
    run() {
      const methodologyVersion = pkg.gadMethodologyVersion || '1.0.0';
      const cliVersion = pkg.version;
      console.log(`\nGAD methodology: ${methodologyVersion}`);
      console.log(`CLI version:     ${cliVersion}`);
      console.log(`\nDefined in: vendor/get-anything-done/package.json`);
      console.log(`Reference:  vendor/get-anything-done/evals/DEFINITIONS.md\n`);
    },
  });

  return { evalList, evalScore, evalDiff, evalStatus, evalRuns, evalShow, evalScores, evalVersion };
}

module.exports = { createEvalInfoCommands };
