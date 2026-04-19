'use strict';
/**
 * gad worktree — manage git worktrees for eval agents and normal project work
 *
 * Required deps:
 *   outputError, listAllWorktrees, worktreeInfo, findWorktreeByPartial,
 *   listAllEvalProjects
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createWorktreeCommand(deps) {
  const { outputError, listAllWorktrees, worktreeInfo, findWorktreeByPartial, listAllEvalProjects } = deps;

  const newCmd = defineCommand({
    meta: { name: 'new', description: 'Create a git worktree for eval or normal project work' },
    args: {
      path: { type: 'positional', description: 'Destination path for the worktree', required: true },
      branch: { type: 'string', description: 'Branch name to create/use (default: derived from path)', default: '' },
      base: { type: 'string', description: 'Base ref/branch to branch from (default: HEAD)', default: 'HEAD' },
      detach: { type: 'boolean', description: 'Create a detached worktree at the base ref', default: false },
    },
    run({ args }) {
      const targetPath = path.resolve(process.cwd(), args.path);
      if (fs.existsSync(targetPath)) {
        outputError(`Worktree path already exists: ${targetPath}`);
        return;
      }
      const branchName = args.detach
        ? ''
        : (args.branch || path.basename(targetPath).replace(/[^A-Za-z0-9._/-]+/g, '-'));
      const { execSync } = require('child_process');
      try {
        if (args.detach) {
          execSync(`git worktree add --detach "${targetPath}" "${args.base}"`, { stdio: 'pipe' });
        } else {
          execSync(`git worktree add -b "${branchName}" "${targetPath}" "${args.base}"`, { stdio: 'pipe' });
        }
        console.log(`✓ Worktree created: ${targetPath}`);
        if (branchName) console.log(`  Branch: ${branchName}`);
        console.log(`  Base:   ${args.base}`);
      } catch (e) {
        outputError(`Failed to create worktree: ${e.message}`);
      }
    },
  });

  const list = defineCommand({
    meta: { name: 'list', description: 'List all git worktrees with status (eval + project worktrees, stale/orphan detection)' },
    args: {
      'agent-only': { type: 'boolean', description: 'Only show agent worktrees', default: false },
      json: { type: 'boolean', description: 'Output JSON', default: false },
    },
    run({ args }) {
      const worktrees = listAllWorktrees().map(worktreeInfo);
      const filtered = args['agent-only'] ? worktrees.filter(w => w.isAgent) : worktrees;

      if (args.json) { console.log(JSON.stringify(filtered, null, 2)); return; }

      if (filtered.length === 0) { console.log('No worktrees found.'); return; }

      console.log('Git Worktrees\n');
      console.log('ID/BRANCH                            AGE   GAME  BUILD  PLAN  FLAGS           PATH');
      console.log('───────────────────────────────────  ────  ────  ─────  ────  ──────────────  ─────────────────────────────');
      for (const w of filtered) {
        const id = (w.branch || w.head || '').slice(0, 35).padEnd(35);
        const age = (w.age || '?').padEnd(4);
        const game = w.hasGame ? ' ✓ ' : ' - ';
        const build = w.hasBuild ? '  ✓  ' : '  -  ';
        const plan = w.hasPlanning ? ' ✓ ' : ' - ';
        const flags = [
          w.isAgent ? 'agent' : null,
          w.isOrphaned ? 'orphan' : null,
          w.prunable ? 'prunable' : null,
          w.unregistered ? 'unregistered' : null,
        ].filter(Boolean).join(',');
        const flagsText = (flags || '-').padEnd(13);
        const relPath = path.relative(process.cwd(), w.path).replace(/\\/g, '/');
        console.log(`${id}  ${age}  ${game}  ${build}  ${plan}  ${flagsText}  ${relPath}`);
      }
      console.log(`\n${filtered.length} worktree(s)`);
      const agentCount = filtered.filter(w => w.isAgent).length;
      if (!args['agent-only'] && agentCount > 0) {
        console.log(`${agentCount} agent worktree(s) — use --agent-only to filter`);
      }
    },
  });

  const show = defineCommand({
    meta: { name: 'show', description: 'Show details of a specific worktree' },
    args: { id: { type: 'positional', description: 'Worktree id, branch name, or path fragment', required: true } },
    run({ args }) {
      const matches = findWorktreeByPartial(args.id);
      if (matches.length === 0) { outputError(`No worktree found matching "${args.id}"`); return; }
      if (matches.length > 1) {
        console.log(`Multiple worktrees match "${args.id}":`);
        for (const m of matches) console.log(`  ${m.path}`);
        return;
      }
      const w = worktreeInfo(matches[0]);
      console.log('Worktree details\n');
      console.log(`  Path:       ${w.path}`);
      console.log(`  Branch:     ${w.branch || '(detached)'}`);
      console.log(`  HEAD:       ${w.head || '?'}`);
      console.log(`  Age:        ${w.age || '?'}`);
      console.log(`  Is agent:   ${w.isAgent ? 'yes' : 'no'}`);
      console.log(`  Exists:     ${w.exists ? 'yes' : 'no'}`);
      console.log(`  Orphaned:   ${w.isOrphaned ? 'yes' : 'no'}`);
      console.log(`  Prunable:   ${w.prunable ? `yes${w.prunableReason ? ` (${w.prunableReason})` : ''}` : 'no'}`);
      console.log(`  Has game/:  ${w.hasGame ? 'yes' : 'no'}`);
      console.log(`  Has build:  ${w.hasBuild ? 'yes' : 'no'}`);
      console.log(`  Has .planning/: ${w.hasPlanning ? 'yes' : 'no'}`);

      try {
        const { execSync } = require('child_process');
        const status = execSync(`git -C "${w.path}" status --short`, { encoding: 'utf8' }).trim();
        const commits = execSync(`git -C "${w.path}" log --oneline -5`, { encoding: 'utf8' }).trim();
        console.log(`\n  Recent commits:`);
        for (const line of commits.split('\n')) console.log(`    ${line}`);
        if (status) {
          console.log(`\n  Uncommitted changes (first 10 lines):`);
          for (const line of status.split('\n').slice(0, 10)) console.log(`    ${line}`);
        } else {
          console.log(`\n  Working tree: clean`);
        }
      } catch {}
    },
  });

  const clean = defineCommand({
    meta: { name: 'clean', description: 'Remove a specific worktree (force)' },
    args: {
      id: { type: 'positional', description: 'Worktree id, branch name, or path fragment', required: true },
      force: { type: 'boolean', description: 'Skip confirmation', default: false },
    },
    run({ args }) {
      const matches = findWorktreeByPartial(args.id);
      if (matches.length === 0) { outputError(`No worktree found matching "${args.id}"`); return; }
      if (matches.length > 1) {
        console.log(`Multiple worktrees match "${args.id}":`);
        for (const m of matches) console.log(`  ${m.path}`);
        console.log('Be more specific.');
        return;
      }
      const w = matches[0];
      if (w.path === process.cwd() || w.path === path.resolve(__dirname, '..', '..', '..', '..')) {
        outputError(`Refusing to remove the main working directory: ${w.path}`);
        return;
      }
      const { execSync } = require('child_process');
      try {
        execSync(`git worktree remove --force "${w.path}"`, { stdio: 'pipe' });
        console.log(`✓ Removed worktree: ${w.path}`);
        if (w.branch) {
          try {
            execSync(`git branch -D "${w.branch}"`, { stdio: 'pipe' });
            console.log(`✓ Deleted branch: ${w.branch}`);
          } catch {}
        }
      } catch (e) {
        outputError(`Failed to remove worktree: ${e.message}`);
      }
    },
  });

  const prune = defineCommand({
    meta: { name: 'prune', description: 'Prune stale agent worktrees older than a threshold' },
    args: {
      'older-than': { type: 'string', description: 'Age threshold (e.g. 1d, 12h, 3d) — default 3d', default: '3d' },
      'agent-only': { type: 'boolean', description: 'Only prune agent worktrees (default true)', default: true },
      'dry-run': { type: 'boolean', description: 'Show what would be removed without removing', default: false },
      'preserved-only': { type: 'boolean', description: 'Only prune worktrees whose evals have been preserved', default: true },
    },
    run({ args }) {
      const match = args['older-than'].match(/^(\d+)([hdm])$/);
      if (!match) { outputError(`Invalid --older-than: ${args['older-than']}. Use e.g. 12h, 3d, 60m`); return; }
      const value = parseInt(match[1]);
      const unit = match[2];
      const thresholdMs = unit === 'h' ? value * 3600e3 : unit === 'm' ? value * 60e3 : value * 86400e3;

      const worktrees = listAllWorktrees().map(worktreeInfo);
      const candidates = worktrees.filter(w => {
        if (args['agent-only'] && !w.isAgent) return false;
        if (w.ageMs < thresholdMs) return false;
        return true;
      });

      if (candidates.length === 0) { console.log(`No worktrees older than ${args['older-than']}.`); return; }

      const preservedRunDirs = new Set();
      let allEvalProjects = [];
      try { allEvalProjects = listAllEvalProjects(); } catch {}
      for (const { name, projectDir } of allEvalProjects) {
        for (const version of fs.readdirSync(projectDir, { withFileTypes: true }).filter(e => e.isDirectory() && /^v\d+$/.test(e.name))) {
          const runDir = path.join(projectDir, version.name, 'run');
          if (fs.existsSync(runDir) && fs.readdirSync(runDir).length > 0) {
            preservedRunDirs.add(`${name}/${version.name}`);
          }
        }
      }

      console.log(`Prune candidates (older than ${args['older-than']}):\n`);
      const willRemove = [];
      for (const w of candidates) {
        const safe = true;
        console.log(`  ${w.age.padEnd(5)}  ${path.relative(process.cwd(), w.path).replace(/\\/g, '/')}  ${w.branch || ''}`);
        if (safe) willRemove.push(w);
      }

      console.log(`\n${willRemove.length} worktree(s) would be removed.`);
      if (args['dry-run']) { console.log('Dry run — nothing removed. Re-run without --dry-run to proceed.'); return; }

      const { execSync } = require('child_process');
      let removed = 0;
      for (const w of willRemove) {
        try {
          if (w.unregistered) {
            fs.rmSync(w.path, { recursive: true, force: true });
          } else {
            execSync(`git worktree remove --force "${w.path}"`, { stdio: 'pipe' });
            if (w.branch) {
              try { execSync(`git branch -D "${w.branch}"`, { stdio: 'pipe' }); } catch {}
            }
          }
          removed++;
        } catch (e) {
          console.log(`  ✗ Failed to remove ${w.path}: ${e.message}`);
        }
      }
      console.log(`\n✓ Removed ${removed}/${willRemove.length} worktree(s)`);
    },
  });

  return defineCommand({
    meta: { name: 'worktree', description: 'Manage git worktrees for eval agents and normal project work' },
    subCommands: { new: newCmd, list, show, clean, prune },
  });
}

module.exports = { createWorktreeCommand };
