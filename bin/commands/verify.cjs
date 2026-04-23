'use strict';
/**
 * gad verify — verify a phase achieved its goals
 *
 * Required deps: findRepoRoot, gadConfig, resolveRoots, outputError,
 *   readPhases, readXmlFile, readTasks
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function safeReadJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function detectProjectScriptRunner(projectDir) {
  if (
    fs.existsSync(path.join(projectDir, 'pnpm-workspace.yaml'))
    || fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))
  ) return 'pnpm run';
  return 'npm run';
}

function resolveVerifyBuildCommands({ config, root, projectDir, cliBuildCmd }) {
  const fromCli = String(cliBuildCmd || '').trim();
  if (fromCli) return { source: 'cli', commands: [fromCli] };

  const projectId = String(root?.id || '').trim();
  const projectScoped = config?.verify?.projects?.[projectId]?.buildCommands;
  if (Array.isArray(projectScoped) && projectScoped.length > 0) {
    return { source: `config:verify.projects.${projectId}`, commands: projectScoped };
  }

  const globalScoped = config?.verify?.buildCommands;
  if (Array.isArray(globalScoped) && globalScoped.length > 0) {
    return { source: 'config:verify', commands: globalScoped };
  }

  const runner = detectProjectScriptRunner(projectDir);
  const packageJsonPath = path.join(projectDir, 'package.json');
  const pkg = fs.existsSync(packageJsonPath) ? safeReadJson(packageJsonPath) : null;
  const scripts = pkg && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  const prioritizedScripts = ['build', 'build:cli', 'build:skills', 'build:hooks', 'build:release'];
  const commands = [];
  for (const scriptName of prioritizedScripts) {
    if (Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
      commands.push(`${runner} ${scriptName}`);
      break;
    }
  }
  if (fs.existsSync(path.join(projectDir, 'tsconfig.json'))) commands.push('npx tsc --noEmit');
  if (commands.length === 0) return { source: 'auto', commands: [] };
  return { source: 'auto', commands };
}

function createVerifyCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError, readPhases, readXmlFile, readTasks } = deps;

  return defineCommand({
    meta: { name: 'verify', description: 'Verify a phase achieved its goals — checks tasks, build, state, conventions' },
    args: {
      projectid: { type: 'string', description: 'Project ID', default: '' },
      phase: { type: 'string', description: 'Phase ID to verify', default: '' },
      'build-cmd': { type: 'string', description: 'Override build/typecheck command used by verify', default: '' },
    },
    run({ args }) {
      const { execSync } = require('child_process');
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;
      const root = roots[0];
      const planDir = path.join(baseDir, root.path, root.planningDir);

      const phases = readPhases(root, baseDir);
      let targetPhase = args.phase;
      if (!targetPhase) {
        const stateXml = readXmlFile(path.join(planDir, 'STATE.xml'));
        targetPhase = stateXml ? (stateXml.match(/<current-phase>([\s\S]*?)<\/current-phase>/) || [])[1]?.trim() : '';
      }
      if (!targetPhase) { outputError('No phase specified and no current phase found. Use --phase <id>'); return; }

      const padded = targetPhase.padStart(2, '0');
      const phase = phases.find(p => p.id === padded || p.id === targetPhase);
      if (!phase) { outputError(`Phase ${targetPhase} not found in ROADMAP.xml`); return; }

      console.log(`\nVerifying phase ${padded}: ${phase.title || ''}\n`);
      const checks = [];

      const allTasks = readTasks(root, baseDir, {});
      const phaseTasks = allTasks.filter(t => {
        const tp = t.id ? t.id.split('-')[0] : '';
        return tp === padded || tp === targetPhase;
      });
      const doneTasks = phaseTasks.filter(t => t.status === 'done');
      const openTasks = phaseTasks.filter(t => t.status !== 'done');
      checks.push({
        category: 'Tasks',
        check: `All tasks done (${doneTasks.length}/${phaseTasks.length})`,
        result: openTasks.length === 0 ? 'PASS' : 'FAIL',
        evidence: openTasks.length === 0 ? `${doneTasks.length} done` : `${openTasks.length} still open: ${openTasks.map(t => t.id).join(', ')}`,
      });

      const projectDir = path.join(baseDir, root.path);
      let buildResult = 'SKIP';
      let buildEvidence = 'no build/typecheck command resolved';
      const buildPlan = resolveVerifyBuildCommands({
        config, root, projectDir,
        cliBuildCmd: args['build-cmd'] || args.buildCmd,
      });
      const selectedBuildCommand = Array.isArray(buildPlan.commands) && buildPlan.commands.length > 0
        ? String(buildPlan.commands[0]).trim() : '';
      if (selectedBuildCommand) {
        try {
          execSync(selectedBuildCommand, { cwd: projectDir, encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] });
          buildResult = 'PASS';
          buildEvidence = `${selectedBuildCommand} exited 0 (${buildPlan.source})`;
        } catch (e) {
          buildResult = 'FAIL';
          buildEvidence = `${selectedBuildCommand} failed (${buildPlan.source}): ${(e.stderr || e.message || '').slice(0, 200)}`;
        }
      }
      checks.push({ category: 'Build', check: 'Build/typecheck passes', result: buildResult, evidence: buildEvidence });

      const stateXml = readXmlFile(path.join(planDir, 'STATE.xml'));
      if (stateXml) {
        const nextAction = (stateXml.match(/<next-action>([\s\S]*?)<\/next-action>/) || [])[1]?.trim() || '';
        const stateOk = nextAction.length > 10;
        checks.push({
          category: 'State',
          check: 'STATE.xml next-action is current',
          result: stateOk ? 'PASS' : 'FAIL',
          evidence: stateOk ? nextAction.slice(0, 100) : 'next-action is empty or too short',
        });
      }

      const decisionsXml = readXmlFile(path.join(planDir, 'DECISIONS.xml'));
      const decCount = decisionsXml ? (decisionsXml.match(/<decision\s/g) || []).length : 0;
      checks.push({
        category: 'Decisions',
        check: 'Decisions documented',
        result: decCount > 0 ? 'PASS' : 'SKIP',
        evidence: decCount > 0 ? `${decCount} decisions in DECISIONS.xml` : 'no decisions (may be ok for non-architectural phases)',
      });

      const conventionsExists = fs.existsSync(path.join(planDir, 'CONVENTIONS.md'));
      const isFirstPhase = padded === '01' || phases.filter(p => p.status === 'done').length <= 1;
      if (isFirstPhase) {
        checks.push({
          category: 'Conventions',
          check: 'CONVENTIONS.md exists (first implementation phase)',
          result: conventionsExists ? 'PASS' : 'FAIL',
          evidence: conventionsExists ? 'file exists' : 'missing — create with `/gad:map-codebase conventions`',
        });
      }

      const passed = checks.filter(c => c.result === 'PASS').length;
      const failed = checks.filter(c => c.result === 'FAIL').length;
      const skipped = checks.filter(c => c.result === 'SKIP').length;
      const overall = failed > 0 ? 'FAIL' : 'PASS';

      console.log(`  #  CATEGORY      CHECK                                    RESULT  EVIDENCE`);
      console.log(`  ─  ────────────  ───────────────────────────────────────  ──────  ────────`);
      for (let i = 0; i < checks.length; i++) {
        const c = checks[i];
        const icon = c.result === 'PASS' ? '✓' : c.result === 'FAIL' ? '✗' : '–';
        console.log(`  ${i + 1}  ${c.category.padEnd(12)}  ${c.check.slice(0, 39).padEnd(39)}  ${icon} ${c.result.padEnd(4)}  ${(c.evidence || '').slice(0, 50)}`);
      }
      console.log(`\n  Result: ${overall} (${passed} passed, ${failed} failed, ${skipped} skipped)\n`);

      if (failed > 0) process.exit(1);
    },
  });
}

module.exports = { createVerifyCommand };
module.exports.register = (ctx) => ({ verify: createVerifyCommand(ctx.common) });
