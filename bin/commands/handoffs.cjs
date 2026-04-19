'use strict';
/**
 * gad handoffs — work-stealing queue (list / show / claim / claim-next /
 * complete / create / create-closeout).
 *
 * NOTE: gad.cjs still owns `buildHandoffsSection`, `printSection`, and
 * `resolveDetectedRuntimeId` because they're called from snapshot/sprint/
 * startup code paths in the monolith. Only the CLI command surface is
 * extracted here.
 *
 * Required deps:
 *   findRepoRoot, outputError, render, shouldUseJson, detectRuntimeIdentity
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

const {
  HandoffError,
  listHandoffs,
  readHandoff,
  claimHandoff,
  completeHandoff,
  createHandoff,
} = require('../../lib/handoffs.cjs');

function createHandoffsCommand(deps) {
  const { findRepoRoot, outputError, render, shouldUseJson, detectRuntimeIdentity } = deps;

  const handoffsListCmd = defineCommand({
    meta: { name: 'list', description: 'List handoffs (default: open bucket)' },
    args: {
      projectid: { type: 'string', description: 'Filter by project id', default: '' },
      unclaimed: { type: 'boolean', description: 'Show only open/unclaimed (default)', default: false },
      claimed: { type: 'boolean', description: 'Show claimed handoffs', default: false },
      closed: { type: 'boolean', description: 'Show closed handoffs', default: false },
      all: { type: 'boolean', description: 'Show all buckets', default: false },
      'mine-first': { type: 'boolean', description: 'Sort by runtime_preference match', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      let bucket = 'open';
      if (args.all) bucket = 'all';
      else if (args.claimed) bucket = 'claimed';
      else if (args.closed) bucket = 'closed';

      const results = listHandoffs({
        baseDir,
        bucket,
        projectid: args.projectid || undefined,
        mineFirst: args['mine-first'],
        runtime: process.env.GAD_AGENT || undefined,
      });

      const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
      if (results.length === 0) {
        if (fmt === 'json') {
          console.log('[]');
        } else {
          console.log(`No handoffs in '${bucket}' bucket${args.projectid ? ` for ${args.projectid}` : ''}.`);
        }
        return;
      }

      if (fmt === 'json') {
        console.log(JSON.stringify(results.map(r => ({ ...r.frontmatter, bucket: r.bucket, filePath: r.filePath })), null, 2));
      } else {
        const rows = results.map(r => ({
          bucket: r.bucket,
          id: r.id,
          project: r.frontmatter.projectid || '',
          phase: r.frontmatter.phase || '',
          priority: r.frontmatter.priority || '',
          context: r.frontmatter.estimated_context || '',
          claimed_by: r.frontmatter.claimed_by || '',
          runtime: r.frontmatter.runtime_preference || '',
        }));
        console.log(render(rows, { format: 'table', title: `Handoffs — ${bucket} (${rows.length})` }));
      }
    },
  });

  const handoffsShowCmd = defineCommand({
    meta: { name: 'show', description: 'Print full content of a handoff file' },
    args: {
      id: { type: 'positional', description: 'Handoff id (e.g. h-2026-04-18-claude-orchestration-handoff)', required: true },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      try {
        const { frontmatter, body, bucket, filePath } = readHandoff({ baseDir, id: String(args.id) });
        console.log(`-- ${args.id} [${bucket}] ----`);
        console.log(`File: ${path.relative(baseDir, filePath)}`);
        console.log('');
        for (const [k, v] of Object.entries(frontmatter)) {
          console.log(`  ${k}: ${v}`);
        }
        console.log('');
        console.log(body);
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  const handoffsClaimCmd = defineCommand({
    meta: { name: 'claim', description: 'Claim an open handoff (moves open→claimed)' },
    args: {
      id: { type: 'positional', description: 'Handoff id', required: true },
      agent: { type: 'string', description: 'Agent name to record as claimer', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      try {
        const destPath = claimHandoff({
          baseDir,
          id: String(args.id),
          agent: args.agent || process.env.GAD_AGENT || 'unknown',
        });
        console.log(`Claimed: ${args.id}`);
        console.log(`Path:    ${path.relative(baseDir, destPath)}`);
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  const handoffsCompleteCmd = defineCommand({
    meta: { name: 'complete', description: 'Mark a claimed handoff complete (moves claimed→closed)' },
    args: {
      id: { type: 'positional', description: 'Handoff id', required: true },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      try {
        const destPath = completeHandoff({ baseDir, id: String(args.id) });
        console.log(`Completed: ${args.id}`);
        console.log(`Path:      ${path.relative(baseDir, destPath)}`);
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  const handoffsClaimNextCmd = defineCommand({
    meta: {
      name: 'claim-next',
      description: 'Claim the best-matching open handoff for the current runtime. Respects runtime_preference + priority, then FIFO. Prints the handoff body so the caller can dispatch it.',
    },
    args: {
      runtime: { type: 'string', description: 'Override runtime detection (e.g. claude-code, codex, cursor). Defaults to detected runtime.', default: '' },
      agent: { type: 'string', description: 'Agent name to record as claimer (default: env GAD_AGENT or detected runtime)', default: '' },
      projectid: { type: 'string', description: 'Restrict to a single project id', default: '' },
      'max-priority': { type: 'string', description: 'Ignore handoffs above this priority (low|normal|high|critical)', default: 'critical' },
      'dry-run': { type: 'boolean', description: 'Show what would be claimed; do not claim', default: false },
      json: { type: 'boolean', description: 'Emit JSON { id, frontmatter, body, bucket }; no stdout chrome', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { sortHandoffsForPickup, isHandoffCompatible, priorityRank } = require('../../lib/agent-detect.cjs');
      const runtime = (args.runtime || detectRuntimeIdentity().id || process.env.GAD_AGENT || '').trim();
      if (!runtime || runtime === 'unknown') {
        outputError('Could not detect runtime. Pass --runtime <id> or set GAD_RUNTIME.');
        process.exit(1);
      }
      const maxRank = priorityRank(args['max-priority']);
      const all = listHandoffs({
        baseDir,
        bucket: 'open',
        projectid: args.projectid || undefined,
      });
      const compatible = all.filter((h) =>
        isHandoffCompatible(h.frontmatter && h.frontmatter.runtime_preference, runtime)
        && priorityRank(h.frontmatter && h.frontmatter.priority) <= maxRank,
      );
      if (compatible.length === 0) {
        if (args.json) {
          console.log(JSON.stringify({ claimed: false, reason: 'no-match', runtime, total: all.length }));
        } else {
          console.log(`No open handoffs match runtime=${runtime} (total open: ${all.length}).`);
        }
        process.exit(all.length === 0 ? 0 : 2);
      }
      const sorted = sortHandoffsForPickup(compatible, runtime);
      const pick = sorted[0];
      if (args['dry-run']) {
        if (args.json) {
          console.log(JSON.stringify({ claimed: false, dryRun: true, pick: { id: pick.id, frontmatter: pick.frontmatter } }));
        } else {
          console.log(`Would claim: ${pick.id} (priority=${pick.frontmatter.priority}, runtime_preference=${pick.frontmatter.runtime_preference || 'any'})`);
        }
        return;
      }
      try {
        const destPath = claimHandoff({
          baseDir,
          id: pick.id,
          agent: args.agent || process.env.GAD_AGENT || runtime,
          runtime,
        });
        const { body, frontmatter } = readHandoff({ baseDir, id: pick.id });
        if (args.json) {
          console.log(JSON.stringify({ claimed: true, id: pick.id, frontmatter, body, path: path.relative(baseDir, destPath) }));
          return;
        }
        console.log(`Claimed: ${pick.id}`);
        console.log(`Runtime: ${runtime} · priority: ${frontmatter.priority} · project: ${frontmatter.projectid}`);
        console.log(`Path:    ${path.relative(baseDir, destPath)}`);
        console.log('');
        console.log('-- handoff body --');
        console.log(body.trim());
        console.log('-- end --');
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  const handoffsCreateCmd = defineCommand({
    meta: { name: 'create', description: 'Create a new handoff in open/' },
    args: {
      projectid: { type: 'string', description: 'Project id', required: true },
      phase: { type: 'string', description: 'Phase id (e.g. 60)', required: true },
      'task-id': { type: 'string', description: 'Task id (optional)', default: '' },
      priority: { type: 'string', description: 'low | normal | high', default: 'normal' },
      context: { type: 'string', description: 'mechanical | reasoning', default: 'mechanical' },
      body: { type: 'string', description: 'Handoff body (markdown)', required: true },
      'runtime-preference': { type: 'string', description: 'Runtime hint (e.g. claude-code)', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      try {
        const result = createHandoff({
          baseDir,
          projectid: String(args.projectid),
          phase: String(args.phase),
          taskId: args['task-id'] || undefined,
          priority: String(args.priority || 'normal'),
          estimatedContext: String(args.context || 'mechanical'),
          body: String(args.body),
          createdBy: process.env.GAD_AGENT || 'unknown',
          runtimePreference: args['runtime-preference'] || undefined,
        });
        console.log(`Created: ${result.id}`);
        console.log(`Path:    ${path.relative(baseDir, result.filePath)}`);
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  const handoffsCreateCloseoutCmd = defineCommand({
    meta: {
      name: 'create-closeout',
      description:
        'Create a closeout handoff: evidence that a task in another lane was completed by you. Receiving lane sweeps + marks the task done in TASK-REGISTRY.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id owning the task', required: true },
      phase: { type: 'string', description: 'Phase id (e.g. 44)', required: true },
      'task-id': { type: 'string', description: 'Task id being closed', required: true },
      commit: { type: 'string', description: 'Commit sha landing the work', required: true },
      files: { type: 'string', description: 'Comma-separated list of files touched', default: '' },
      resolution: { type: 'string', description: 'One-line human resolution', required: true },
      'runtime-preference': { type: 'string', description: 'Receiving lane runtime (the one that owns the task)', default: '' },
      priority: { type: 'string', description: 'low | normal | high', default: 'normal' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const files = String(args.files || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const body = [
        '## Closeout evidence',
        '',
        `- **Task:** \`${args['task-id']}\` (project: ${args.projectid}, phase: ${args.phase})`,
        `- **Commit:** \`${args.commit}\``,
        files.length > 0 ? `- **Files:**\n${files.map((f) => `  - \`${f}\``).join('\n')}` : '- **Files:** (none listed)',
        `- **Resolution:** ${args.resolution}`,
        '',
        '## Receiving-lane action',
        '',
        `Verify the commit exists and touches the listed files, then update \`${args.projectid}/.planning/TASK-REGISTRY.xml\` for task \`${args['task-id']}\`:`,
        '- `status="done"`',
        `- add/update attribution attributes pointing to commit \`${args.commit}\``,
        '',
        `Then complete this handoff: \`gad handoffs complete <this-id>\`.`,
      ].join('\n');

      try {
        const result = createHandoff({
          baseDir,
          projectid: String(args.projectid),
          phase: String(args.phase),
          taskId: String(args['task-id']),
          priority: String(args.priority || 'normal'),
          estimatedContext: 'mechanical',
          body,
          createdBy: process.env.GAD_AGENT || detectRuntimeIdentity().id || 'unknown',
          runtimePreference: args['runtime-preference'] || undefined,
        });

        try {
          const text = fs.readFileSync(result.filePath, 'utf8');
          const headerMatch = text.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/);
          if (headerMatch) {
            const header = headerMatch[1];
            const rest = headerMatch[2];
            const extra = `type: closeout\ncloseout_commit: ${args.commit}\ncloseout_files: ${files.join(';')}\n`;
            const updated = header.replace(/\r?\n---\r?\n$/, (m) => `\n${extra.trimEnd()}\n---\n`) + rest;
            fs.writeFileSync(result.filePath, updated);
          }
        } catch (e) { /* non-fatal; body already has the evidence */ }

        console.log(`Created closeout: ${result.id}`);
        console.log(`Task:    ${args['task-id']} (${args.projectid}:${args.phase})`);
        console.log(`Commit:  ${args.commit}`);
        console.log(`Path:    ${path.relative(baseDir, result.filePath)}`);
        console.log('');
        console.log(`Receiving lane sweep: \`gad handoffs list --projectid ${args.projectid}\``);
      } catch (e) {
        if (e instanceof HandoffError) {
          outputError(e.message);
          process.exit(1);
        }
        throw e;
      }
    },
  });

  return defineCommand({
    meta: { name: 'handoffs', description: 'Work-stealing handoff queue — list, show, claim, claim-next, complete, create, create-closeout' },
    subCommands: {
      list: handoffsListCmd,
      show: handoffsShowCmd,
      claim: handoffsClaimCmd,
      'claim-next': handoffsClaimNextCmd,
      complete: handoffsCompleteCmd,
      create: handoffsCreateCmd,
      'create-closeout': handoffsCreateCloseoutCmd,
    },
  });
}

module.exports = { createHandoffsCommand };
