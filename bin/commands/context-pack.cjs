'use strict';
/**
 * gad context-pack — injectable agent context builder.
 *
 * Decision GLOBAL-D-446. Phase 284, task 284-01.
 *
 * Usage:
 *   gad context-pack <cid-or-task-id> [--projectid <id>]
 *
 * Examples:
 *   gad context-pack desk.teams.machine-capacity
 *   gad context-pack 281-05 --projectid global
 *
 * The target is treated as a task-id when it matches /^\d+-\d+[a-z]?$/.
 * Otherwise it is treated as a cid.
 *
 * Output: a markdown context block printed to stdout — ready to paste into
 * a handoff body, an agent prompt, or a system message.
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

/** Heuristic: task-ids look like "281-05" or "80-04a" */
function looksLikeTaskId(target) {
  return /^\d+[-_.]\d+[a-z]?$/.test(target);
}

function createContextPackCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError } = deps;

  return defineCommand({
    meta: {
      name: 'context-pack',
      description:
        'Build an injectable context block for a cid or task-id so agents start with zero questions. (D-446)',
    },
    args: {
      target: {
        type: 'positional',
        description: 'A cid (e.g. desk.teams.machine-capacity) or task-id (e.g. 281-05)',
        required: true,
      },
      projectid: {
        type: 'string',
        description: 'Project id to resolve planning dirs from (default: auto-detect)',
        default: '',
      },
    },
    run({ args }) {
      const { buildContextPack } = require('../../lib/context-pack/index.cjs');

      const baseDir = findRepoRoot();
      if (!baseDir) {
        outputError('context-pack: could not locate repo root.');
        process.exit(1);
        return;
      }

      // Resolve planning dirs from project roots
      let planningDirs = [];
      try {
        const config = gadConfig.load(baseDir);
        const roots = resolveRoots({ projectid: args.projectid || '' }, baseDir, config.roots);
        planningDirs = roots.map(r => {
          // roots from registry have an absolute path; local roots are relative
          const rootPath = path.isAbsolute(r.path)
            ? r.path
            : path.resolve(baseDir, r.path);
          return path.join(rootPath, r.planningDir || '.planning');
        });
      } catch {
        // Fallback: just use the repo root .planning/
      }
      if (planningDirs.length === 0) {
        planningDirs = [path.join(baseDir, '.planning')];
      }

      const target = String(args.target);
      const isTaskId = looksLikeTaskId(target);

      const pack = buildContextPack({
        cid: isTaskId ? undefined : target,
        taskId: isTaskId ? target : undefined,
        repoRoot: baseDir,
        planningDirs,
      });

      process.stdout.write(pack + '\n');
    },
  });
}

module.exports = { createContextPackCommand };
module.exports.register = (ctx) => {
  const cmd = createContextPackCommand(ctx.common);
  return { 'context-pack': cmd };
};
