'use strict';
/**
 * `gad generation preserve` and `gad generation verify`. Extracted from bin/gad.cjs.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { normalizeGenerationReference } = require('../../lib/eval-helpers.cjs');

function copyRecursive(src, dst, flatten = false) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!flatten) fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === 'node_modules' || entry === '.git') continue;
      copyRecursive(path.join(src, entry), path.join(flatten ? dst : dst, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function dirSizeBytes(dirPath) {
  let total = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(fullPath);
    else if (entry.isFile()) total += fs.statSync(fullPath).size;
  }
  return total;
}

function createEvalArtifactsCommands(deps) {
  const {
    findRepoRoot,
    resolveOrDefaultEvalProjectDir,
    outputError,
    parseTraceEventsJsonl,
    summarizeAgentLineage,
    listAllEvalProjects,
    defaultEvalsDir,
  } = deps;

  const evalPreserve = defineCommand({
    meta: { name: 'preserve', description: 'Preserve generation outputs (code + build + logs) to canonical project/species/version paths — MANDATORY after every run' },
    args: {
      project: { type: 'positional', description: 'Project id', required: true },
      species: { type: 'positional', description: 'Species id (preferred generation syntax)', default: '' },
      version: { type: 'positional', description: 'Generation version (e.g. v5)', default: '' },
      from: { type: 'string', description: 'Source path (agent worktree root)', default: '' },
      'game-subdir': { type: 'string', description: 'Subdir containing the game (default: game)', default: 'game' },
    },
    run({ args }) {
      const repoRoot = findRepoRoot();
      const target = normalizeGenerationReference(args.project, args.species, args.version);
      if (!target.version) {
        outputError(
          'Usage: gad generation preserve <project> <species> <version> --from <worktree-path>\n' +
          'Legacy alias still accepted: gad eval preserve <project> <version> --from <worktree-path>'
        );
        return;
      }
      const projectBaseDir = resolveOrDefaultEvalProjectDir(target.project);
      const projectDir = target.species
        ? path.join(projectBaseDir, 'species', target.species)
        : projectBaseDir;
      const runDir = path.join(projectDir, target.version);
      const runPathLabel = target.species
        ? `evals/${target.project}/species/${target.species}/${target.version}`
        : `evals/${target.project}/${target.version}`;

      if (!args.from) { outputError('--from <worktree-path> is required'); return; }
      const from = path.resolve(args.from);
      if (!fs.existsSync(from)) {
        outputError(
          `Source path does not exist: ${from}\n` +
          `  The worktree may have been removed. Worktrees must be preserved IMMEDIATELY\n` +
          `  after the agent completes — before any cleanup. See gad:eval-run skill.`
        );
        return;
      }

      if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

      const gameSrc = path.join(from, args['game-subdir']);
      if (!fs.existsSync(gameSrc)) {
        outputError(`Game subdir not found: ${gameSrc}. Use --game-subdir to override.`);
        return;
      }

      const runTargetDir = path.join(runDir, 'run');
      if (fs.existsSync(runTargetDir)) fs.rmSync(runTargetDir, { recursive: true, force: true });
      fs.mkdirSync(runTargetDir, { recursive: true });

      // `out` and `.next` are Next.js build artifacts (gad task 44-03) —
      // excluded from the source copy and picked up separately as the build.
      const excludeTopLevel = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.next']);
      let copiedCount = 0;
      for (const entry of fs.readdirSync(gameSrc)) {
        if (excludeTopLevel.has(entry)) continue;
        copyRecursive(path.join(gameSrc, entry), path.join(runTargetDir, entry));
        copiedCount++;
      }

      const rootExtras = ['ARCHITECTURE.md', 'WORKFLOW.md', 'NOTES.md', 'CHANGELOG.md'];
      const extrasDir = path.join(runTargetDir, '_worktree_root_extras');
      let rootExtrasCopied = 0;
      for (const extra of rootExtras) {
        const srcPath = path.join(from, extra);
        if (!fs.existsSync(srcPath)) continue;
        const mainRepoPath = path.join(repoRoot, extra);
        if (fs.existsSync(mainRepoPath)) {
          try {
            const srcStat = fs.statSync(srcPath);
            const mainStat = fs.statSync(mainRepoPath);
            if (srcStat.isFile() && mainStat.isFile()) {
              const srcContent = fs.readFileSync(srcPath, 'utf8');
              const mainContent = fs.readFileSync(mainRepoPath, 'utf8');
              if (srcContent === mainContent) continue;
            } else { continue; }
          } catch { continue; }
        }
        if (rootExtrasCopied === 0) fs.mkdirSync(extrasDir, { recursive: true });
        copyRecursive(srcPath, path.join(extrasDir, extra));
        rootExtrasCopied++;
      }

      // `.next/` is intentionally NOT a candidate because it requires a running Node server.
      const buildDirCandidates = ['out', 'dist', 'build'];
      let distSrc = null;
      for (const candidate of buildDirCandidates) {
        const attempt = path.join(gameSrc, candidate);
        if (fs.existsSync(attempt)) { distSrc = attempt; break; }
      }
      let buildPreserved = false;
      if (distSrc) {
        const buildTarget = path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', target.projectRef, target.version);
        if (fs.existsSync(buildTarget)) fs.rmSync(buildTarget, { recursive: true, force: true });
        fs.mkdirSync(buildTarget, { recursive: true });
        copyRecursive(distSrc, buildTarget, true);
        buildPreserved = true;
      }

      const logCandidates = [
        path.join(from, '.planning', '.gad-log'),
        path.join(from, '.gad-log'),
        path.join(gameSrc, '.gad-log'),
        path.join(gameSrc, '.planning', '.gad-log'),
      ];
      let logsPreserved = false;
      for (const logSrc of logCandidates) {
        if (fs.existsSync(logSrc)) {
          const logDst = path.join(runDir, '.gad-log');
          if (fs.existsSync(logDst)) fs.rmSync(logDst, { recursive: true, force: true });
          copyRecursive(logSrc, logDst);
          logsPreserved = true;
          break;
        }
      }

      const workflowArtifactNames = ['WORKFLOW.md', 'ARCHITECTURE.md', 'DECISIONS.md', 'DECISIONS.xml', 'NOTES.md', 'CHANGELOG.md', 'ROADMAP.md', 'ROADMAP.xml', 'TASK-REGISTRY.md', 'TASK-REGISTRY.xml', 'STATE.md', 'STATE.xml', 'VERIFICATION.md'];
      const misplaced = [];
      const hasPlanningDir = fs.existsSync(path.join(runTargetDir, '.planning'));
      for (const entry of fs.readdirSync(runTargetDir)) {
        if (entry === '.planning' || entry === '_worktree_root_extras') continue;
        if (workflowArtifactNames.includes(entry)) misplaced.push(entry);
        if (entry === 'skills' && fs.statSync(path.join(runTargetDir, entry)).isDirectory()) misplaced.push('skills/');
      }

      console.log(`\n✓ Preserved ${target.projectRef} ${target.version}`);
      console.log(`  Project tree:    ${copiedCount} top-level entries → ${runPathLabel}/run/`);
      if (rootExtrasCopied > 0) {
        console.log(`  Root extras:     ${rootExtrasCopied} agent-created files → run/_worktree_root_extras/`);
      }
      console.log(`  Build:           ${buildPreserved ? 'preserved' : 'NOT FOUND (no dist/)'}`);
      console.log(`  CLI logs:        ${logsPreserved ? 'preserved' : 'NOT FOUND'}`);
      console.log(`  .planning/ home: ${hasPlanningDir ? 'present' : 'MISSING'}`);

      if (misplaced.length > 0) {
        console.log(`\n⚠  Workflow artifacts found OUTSIDE game/.planning/:`);
        for (const m of misplaced) console.log(`     ${m}`);
        console.log(`   Contract violation: all workflow artifacts should live under game/.planning/.`);
        console.log(`   See AGENTS.md layout requirements. Record this in the human review notes.`);
      }
      if (!hasPlanningDir) {
        console.log(`\n⚠  No game/.planning/ directory found. Agent did not create a planning home.`);
        console.log(`   This is a contract violation — all evals must put workflow artifacts in .planning/.`);
      }
      if (!buildPreserved) {
        console.log(`\n⚠  No build was preserved. Agent did not produce game/dist/.`);
        console.log(`    This may be a gate failure — verify and record.`);
      }

      // Skill provenance diffing (decision gad-120, phase 31)
      const traceJsonPath = path.join(runDir, 'TRACE.json');
      if (fs.existsSync(traceJsonPath)) {
        try {
          const trace = JSON.parse(fs.readFileSync(traceJsonPath, 'utf8'));
          const startSnapshot = new Set(
            (trace.skills_provenance?.start_snapshot || []).map((s) => String(s))
          );

          const endSkills = new Set();
          const skillCandidates = [
            path.join(runTargetDir, '.planning', 'skills'),
            path.join(runTargetDir, 'skills'),
          ];
          for (const skillDir of skillCandidates) {
            if (fs.existsSync(skillDir)) {
              for (const entry of fs.readdirSync(skillDir, { withFileTypes: true })) {
                if (entry.isDirectory()) endSkills.add(entry.name);
                else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
                  endSkills.add(entry.name.replace(/\.md$/, ''));
                }
              }
            }
          }

          const authored = [];
          for (const skill of endSkills) {
            if (!startSnapshot.has(skill)) authored.push(skill);
          }

          if (!trace.skills_provenance) trace.skills_provenance = {};
          trace.skills_provenance.end_snapshot = [...endSkills].sort();
          trace.skills_provenance.skills_authored = authored.sort();
          fs.writeFileSync(traceJsonPath, JSON.stringify(trace, null, 2));

          if (authored.length > 0) {
            console.log(`  Skills authored:  ${authored.length} (${authored.join(', ')})`);
          } else {
            console.log(`  Skills authored:  0 (no new skills created during run)`);
          }
        } catch (err) {
          console.warn(`  [warn] skill provenance diff failed: ${err.message}`);
        }
      }

      if (fs.existsSync(traceJsonPath)) {
        try {
          const trace = JSON.parse(fs.readFileSync(traceJsonPath, 'utf8'));
          let traceEvents = Array.isArray(trace.trace_events) ? trace.trace_events : null;
          if (!traceEvents && typeof trace.trace_events_file === 'string' && trace.trace_events_file.trim()) {
            const traceEventsPath = trace.trace_events_file;
            if (fs.existsSync(traceEventsPath)) {
              traceEvents = parseTraceEventsJsonl(fs.readFileSync(traceEventsPath, 'utf8'));
              trace.trace_events = traceEvents;
              trace.trace_schema_version = Math.max(Number(trace.trace_schema_version || 0), 5);
            }
          }
          trace.agent_lineage = summarizeAgentLineage({
            traceEvents,
            runtimeIdentity: trace.runtime_identity,
            runtimesInvolved: trace.runtimes_involved,
          });
          fs.writeFileSync(traceJsonPath, JSON.stringify(trace, null, 2));
          console.log(
            `  Agent lineage:   ${trace.agent_lineage.total_agents} lane(s) ` +
            `(${trace.agent_lineage.root_agent_count} root, ${trace.agent_lineage.subagent_count} subagent)`
          );
        } catch (err) {
          console.warn(`  [warn] agent lineage summary failed: ${err.message}`);
        }
      }

      if (fs.existsSync(traceJsonPath)) {
        try {
          const trace = JSON.parse(fs.readFileSync(traceJsonPath, 'utf8'));
          const srcDir = path.join(runTargetDir, 'src');
          const sourceSizeBytes = fs.existsSync(srcDir) ? dirSizeBytes(srcDir) : 0;
          const buildTarget = path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', target.projectRef, target.version);
          let buildSizeBytes = 0;
          if (buildPreserved && fs.existsSync(buildTarget)) {
            buildSizeBytes = dirSizeBytes(buildTarget);
          } else {
            const runDist = path.join(runTargetDir, 'dist');
            if (fs.existsSync(runDist)) buildSizeBytes = dirSizeBytes(runDist);
          }
          trace.source_size_bytes = sourceSizeBytes;
          trace.build_size_bytes = buildSizeBytes;
          fs.writeFileSync(traceJsonPath, JSON.stringify(trace, null, 2));
          console.log(`  Source size:      ${(sourceSizeBytes / 1024).toFixed(1)} KB`);
          console.log(`  Build size:       ${(buildSizeBytes / 1024).toFixed(1)} KB`);
        } catch (err) {
          console.warn(`  [warn] size computation failed: ${err.message}`);
        }
      }

      const runMdPath = path.join(runDir, 'RUN.md');
      const runMdLine = `preserved: ${new Date().toISOString()} (from ${from})\nproject_ref: ${target.projectRef}\n`;
      if (fs.existsSync(runMdPath)) {
        fs.appendFileSync(runMdPath, runMdLine);
      } else {
        fs.writeFileSync(runMdPath, `# Eval Run ${target.version}\n\nproject: ${target.project}\nspecies: ${target.species || ''}\n${runMdLine}`);
      }
    },
  });

  const evalVerify = defineCommand({
    meta: { name: 'verify', description: 'Audit all eval runs for preservation completeness (code, build, logs, trace)' },
    args: {
      project: { type: 'positional', description: 'Specific project to verify (default: all)', default: '' },
    },
    run({ args }) {
      const repoRoot = findRepoRoot();

      let discovered;
      try { discovered = listAllEvalProjects(); }
      catch (err) { outputError(err.message); return; }
      if (discovered.length === 0) { outputError('No eval projects found.'); return; }

      const projectDirByName = new Map(discovered.map((d) => [d.name, d.projectDir]));
      const projects = args.project ? [args.project] : discovered.map((d) => d.name);

      const issues = [];
      let totalRuns = 0;
      let cleanRuns = 0;

      console.log('GAD Eval Preservation Audit\n');
      console.log('PROJECT                         VERSION  TRACE  RUN   BUILD  LOGS  STATUS');
      console.log('──────────────────────────────  ───────  ─────  ────  ─────  ────  ──────');

      for (const project of projects) {
        const projectDir = projectDirByName.get(project) || path.join(defaultEvalsDir(), project);
        if (!fs.existsSync(projectDir)) continue;
        const versions = fs.readdirSync(projectDir)
          .filter((n) => /^v\d+$/.test(n))
          .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

        // tooling/mcp/cli-efficiency evals don't need run/ or build/
        const skipCodeCheck = ['tooling-watch', 'tooling-mcp', 'cli-efficiency', 'planning-migration', 'project-migration', 'portfolio-bare', 'reader-workspace', 'gad-planning-loop', 'subagent-utility'].includes(project);

        for (const v of versions) {
          totalRuns++;
          const vDir = path.join(projectDir, v);
          const tracePath = path.join(vDir, 'TRACE.json');
          const hasTrace = fs.existsSync(tracePath);
          const hasRun = fs.existsSync(path.join(vDir, 'run')) &&
                         fs.readdirSync(path.join(vDir, 'run')).length > 0;
          const hasBuild = fs.existsSync(path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', project, v, 'index.html'));
          const hasLogs = fs.existsSync(path.join(vDir, '.gad-log'));
          let hasRuntimeIdentity = false;
          if (hasTrace) {
            try {
              const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
              hasRuntimeIdentity = typeof trace?.runtime_identity?.id === 'string' && trace.runtime_identity.id.trim().length > 0;
            } catch {}
          }

          const problems = [];
          if (!hasTrace) problems.push('no TRACE.json');
          if (hasTrace && !hasRuntimeIdentity) problems.push('no runtime identity');
          if (!skipCodeCheck && !hasRun) problems.push('no run/ dir');
          if (!skipCodeCheck && !hasBuild) problems.push('no build');
          if (!skipCodeCheck && !hasLogs) problems.push('no CLI logs');

          const status = problems.length === 0 ? 'OK' : 'MISSING';
          if (problems.length === 0) cleanRuns++;
          else issues.push({ project, version: v, problems });

          const mark = (x, req) => req ? (x ? '  ✓  ' : '  ✗  ') : '  -  ';
          console.log(
            `${project.padEnd(30)}  ${v.padEnd(7)}  ${mark(hasTrace, true)}  ${mark(hasRun, !skipCodeCheck).trim().padStart(4)}  ${mark(hasBuild, !skipCodeCheck)}  ${mark(hasLogs, !skipCodeCheck).trim().padStart(4)}  ${status}`
          );
        }
      }

      console.log(`\n${cleanRuns}/${totalRuns} runs fully preserved`);

      if (issues.length > 0) {
        console.log('\nIssues:');
        for (const issue of issues) {
          console.log(`  ${issue.project} ${issue.version}: ${issue.problems.join(', ')}`);
        }
        process.exit(1);
      }
    },
  });

  return { evalPreserve, evalVerify };
}

module.exports = { createEvalArtifactsCommands };
module.exports.provides = (ctx) => createEvalArtifactsCommands(ctx.common);
