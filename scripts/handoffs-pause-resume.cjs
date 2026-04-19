#!/usr/bin/env node
'use strict';

/**
 * Standalone pause/resume CLI for self-resume handoffs.
 *
 * Lives in `scripts/` rather than `bin/commands/` because `bin/gad.cjs`
 * dispatcher + `bin/commands/handoffs.cjs` are mid-sweep by another
 * agent 2026-04-19. This script is invocable today; CLI wiring into
 * `gad handoffs pause/resume` is a later addition.
 *
 * Usage:
 *   node scripts/handoffs-pause-resume.cjs pause \
 *     --projectid <id> --phase <id> --task-id <id> \
 *     [--last-commit <sha>] [--done <text>] [--left <text>] [--blockers <text>] \
 *     [--runtime <id>]
 *
 *   node scripts/handoffs-pause-resume.cjs resume \
 *     [--projectid <id>] [--task-id <id>] [--agent <name>] [--runtime <id>]
 *
 *   node scripts/handoffs-pause-resume.cjs list \
 *     [--projectid <id>] [--task-id <id>]
 *
 * Env defaults:
 *   GAD_AGENT_NAME — used as `created_by` on pause + filter on resume
 *   GAD_RUNTIME    — used as `runtime_preference` on pause if --runtime absent
 */

const path = require('path');
const fs = require('fs');

const {
  createSelfResumeHandoff,
  findSelfResumeHandoffs,
  claimHandoff,
  readHandoff,
  HandoffError,
} = require('../lib/handoffs.cjs');

function findBaseDir(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir || process.cwd();
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const nextIsValue = i + 1 < argv.length && !argv[i + 1].startsWith('--');
      out[key] = nextIsValue ? argv[++i] : true;
    }
  }
  return out;
}

const [, , action, ...rest] = process.argv;
const opts = parseFlags(rest);
const baseDir = findBaseDir(process.cwd());
const agent = opts.agent || process.env.GAD_AGENT_NAME || process.env.GAD_AGENT || null;
const runtime = opts.runtime || process.env.GAD_RUNTIME || null;

function printHelp() {
  console.log(`self-resume handoffs — pause/resume for same-agent context-break recovery

Actions:
  pause     Create a self-resume handoff for a task you were working on
  resume    Find + claim the most-recent self-resume handoff
  list      Show self-resume handoffs (open bucket by default)
  help      Show this message

pause flags:
  --projectid <id>      required
  --phase <id>          required
  --task-id <id>        required
  --last-commit <sha>   optional
  --done <text>         what's done so far
  --left <text>         what's left to do
  --blockers <text>     known blockers
  --runtime <id>        runtime preference (defaults to $GAD_RUNTIME)

resume flags:
  --projectid <id>      filter by project
  --task-id <id>        filter to a specific task
  --agent <name>        filter to a specific agent's pauses (defaults to $GAD_AGENT_NAME)
  --runtime <id>        claim-as runtime (defaults to $GAD_RUNTIME)

list flags:
  --projectid <id>      filter by project
  --task-id <id>        filter to a specific task`);
}

if (!action || action === 'help' || action === '--help' || action === '-h') {
  printHelp();
  process.exit(0);
}

try {
  if (action === 'pause') {
    if (!opts.projectid || !opts.phase || !opts['task-id']) {
      console.error('pause: --projectid, --phase, --task-id all required');
      process.exit(1);
    }
    const result = createSelfResumeHandoff({
      baseDir,
      projectid: opts.projectid,
      phase: opts.phase,
      taskId: opts['task-id'],
      createdBy: agent,
      runtimePreference: runtime,
      lastCommit: opts['last-commit'] || null,
      whatDone: opts.done || '',
      whatLeft: opts.left || '',
      blockers: opts.blockers || '',
    });
    console.log(`Paused: ${result.id}`);
    console.log(`Path:   ${path.relative(baseDir, result.filePath)}`);
    console.log(`Resume later: node scripts/handoffs-pause-resume.cjs resume --task-id ${opts['task-id']}`);
    process.exit(0);
  }

  if (action === 'list') {
    const matches = findSelfResumeHandoffs({
      baseDir,
      projectid: opts.projectid,
      taskId: opts['task-id'],
    });
    if (matches.length === 0) {
      console.log('No open self-resume handoffs.');
      process.exit(0);
    }
    for (const m of matches) {
      const fm = m.frontmatter || {};
      console.log(`  ${m.id}`);
      console.log(`    task:   ${fm.resume_task || fm.task_id || '-'} (project: ${fm.projectid}, phase: ${fm.phase})`);
      console.log(`    by:     ${fm.created_by || '?'} @ ${fm.created_at || '?'}`);
      console.log(`    runtime_preference: ${fm.runtime_preference || 'any'}`);
    }
    process.exit(0);
  }

  if (action === 'resume') {
    const matches = findSelfResumeHandoffs({
      baseDir,
      projectid: opts.projectid,
      taskId: opts['task-id'],
      agent,
    });
    if (matches.length === 0) {
      console.log(`No open self-resume handoffs${opts['task-id'] ? ` for task ${opts['task-id']}` : agent ? ` by ${agent}` : ''}.`);
      process.exit(1);
    }
    // Most-recent wins if multiple
    matches.sort((a, b) => {
      const aT = (a.frontmatter && a.frontmatter.created_at) || a.id;
      const bT = (b.frontmatter && b.frontmatter.created_at) || b.id;
      return bT.localeCompare(aT);
    });
    const pick = matches[0];
    const destPath = claimHandoff({
      baseDir,
      id: pick.id,
      agent: agent || 'unknown',
      runtime: runtime || undefined,
    });
    const { body, frontmatter } = readHandoff({ baseDir, id: pick.id });
    console.log(`Resumed: ${pick.id}`);
    console.log(`Task:    ${frontmatter.resume_task || frontmatter.task_id || '-'}`);
    console.log(`Path:    ${path.relative(baseDir, destPath)}`);
    console.log('');
    console.log('-- resume context --');
    console.log(body.trim());
    console.log('-- end --');
    process.exit(0);
  }

  console.error(`Unknown action: ${action}`);
  printHelp();
  process.exit(1);
} catch (e) {
  if (e instanceof HandoffError) {
    console.error(`HandoffError [${e.code}]: ${e.message}`);
    process.exit(1);
  }
  throw e;
}
