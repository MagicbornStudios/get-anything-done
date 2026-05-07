'use strict';
/**
 * gad tasks stamp — attribute a task without pre-claim. Idempotent write
 * to the per-task JSON file (and a best-effort nudge to the legacy XML).
 *
 * Decision 2026-04-20 D2: handoffs are the atomic lock. Pre-claim on tasks
 * was the wrong layer. `stamp` is what a worker (or operator) calls when
 * the work is done to record who did it, with what skill, on what runtime —
 * no pre-reservation, no race window.
 *
 * Shape:
 *   gad tasks stamp <id> --projectid <p> \
 *     [--agent <name>] [--role <r>] [--runtime <id>] [--skill <s>] \
 *     [--status done] [--resolution <text>]
 *
 * All fields optional except id + projectid. Absent fields leave the
 * existing value untouched (no blanking).
 *
 * Phase 127: when status=done with skill=, increments XP on STATE.xml <level>.
 * Idempotent via <stamped-tasks/> tracking — re-stamping the same task is a no-op.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { defineCommand } = require('citty');
const taskFiles = require('../../../lib/task-files.cjs');
const xpMath = require('../../../lib/xp-math.cjs');

function runGit(baseDir, command) {
  return execSync(command, {
    cwd: baseDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function normalizeGitPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function taskScopeFiles(task) {
  return Array.isArray(task.files)
    ? task.files.map(normalizeGitPath).filter(Boolean)
    : [];
}

function commitTouchesTaskScope(baseDir, commitSha, scopeFiles) {
  if (scopeFiles.length === 0) {
    return { ok: false, reason: 'Task has no known file scope. Add task files before stamping done.' };
  }
  const output = runGit(baseDir, `git diff-tree --no-commit-id --name-only -r ${commitSha}`);
  const changed = output.split(/\r?\n/).map(normalizeGitPath).filter(Boolean);
  const touches = changed.some((changedPath) => scopeFiles.includes(changedPath));
  if (!touches) {
    return {
      ok: false,
      reason: `Commit ${commitSha} does not touch any files in task scope: ${scopeFiles.join(', ')}`,
    };
  }
  return { ok: true };
}

function gitLogTouchesTaskScope(baseDir, task) {
  const scopeFiles = taskScopeFiles(task);
  if (!task.created_at) {
    return { ok: false, reason: 'Task has no created_at timestamp, so git history evidence cannot be checked.' };
  }
  if (scopeFiles.length === 0) {
    return { ok: false, reason: 'Task has no known file scope. Add task files before stamping done.' };
  }
  const quotedFiles = scopeFiles.map((file) => `"${file.replace(/"/g, '\\"')}"`).join(' ');
  const output = runGit(baseDir, `git log --since="${task.created_at}" --format=%H -- ${quotedFiles}`);
  if (!output) {
    return {
      ok: false,
      reason: `No commits found since ${task.created_at} touching task scope: ${scopeFiles.join(', ')}`,
    };
  }
  return { ok: true };
}

function evaluateDoneEvidence(baseDir, task, args) {
  const commitSha = String(args['commit-sha'] || '').trim();
  const evidence = String(args.evidence || '').trim();

  if (commitSha) {
    try {
      const commit = runGit(baseDir, `git rev-list --max-count=1 ${commitSha}`);
      if (!commit) {
        return { ok: false, reason: `Invalid --commit-sha: ${commitSha} not found in git history.` };
      }
      return commitTouchesTaskScope(baseDir, commitSha, taskScopeFiles(task));
    } catch {
      return { ok: false, reason: `Invalid --commit-sha: ${commitSha} not found in git history.` };
    }
  }

  if (evidence) {
    if (evidence.length <= 20) {
      return { ok: false, reason: '--evidence must be more than 20 characters.' };
    }
    return gitLogTouchesTaskScope(baseDir, task);
  }

  return {
    ok: false,
    reason: 'Stamping status=done requires --commit-sha <sha> or --evidence "<non-trivial text>".',
  };
}

function createTasksStampCommand(deps) {
  return defineCommand({
    meta: {
      name: 'stamp',
      description: 'Stamp attribution (agent / skill / runtime / status) onto a task. Idempotent. Prefer over `claim` for post-completion attribution — no pre-reservation, no race (D2).',
    },
    args: {
      id: { type: 'positional', description: 'Task id', required: true },
      projectid: { type: 'string', description: 'Project id', required: true },
      agent: { type: 'string', description: 'Agent name (e.g. team-w1)', default: '' },
      role: { type: 'string', description: 'Agent role (executor, reviewer, …)', default: '' },
      runtime: { type: 'string', description: 'Runtime id (claude-code, codex-cli, …)', default: '' },
      'skill-id': { type: 'string', description: 'Skill that did the work (arg renamed from --skill to avoid a citty collision with the root `gad skill` subcommand)', default: '' },
      status: { type: 'string', description: 'Final status (planned | in-progress | done | cancelled)', default: '' },
      resolution: { type: 'string', description: 'Free-form completion note', default: '' },
      'commit-sha': { type: 'string', description: 'Git commit hash that landed the work', default: '' },
      evidence: { type: 'string', description: 'Textual evidence for status=done (min 20 chars)', default: '' },
      enforce: { type: 'boolean', description: 'Enforce evidence rules (override config)', default: false },
    },
    run({ args }) {
      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root, config } = resolved;
      const planningDir = path.join(baseDir, root.path, root.planningDir);

      if (!taskFiles.hasTasksDir(planningDir)) {
        deps.outputError(`No per-task files yet at ${path.relative(baseDir, taskFiles.tasksDir(planningDir))}. Run \`gad tasks migrate --projectid ${args.projectid}\` first.`);
        process.exit(1);
        return;
      }
      const existing = taskFiles.readOne(planningDir, String(args.id));
      if (!existing) {
        deps.outputError(`Task not found: ${args.id} (looked at ${taskFiles.taskPath(planningDir, String(args.id))})`);
        process.exit(1);
        return;
      }

      const patch = {};
      if (args.agent)      patch.agent_id = String(args.agent);
      if (args.role)       patch.agent_role = String(args.role);
      if (args.runtime)    patch.runtime = String(args.runtime);
      if (args['skill-id']) patch.skill = String(args['skill-id']);
      if (args.status)     patch.status = String(args.status).toLowerCase();
      if (args.resolution) patch.resolution = String(args.resolution);

      if (Object.keys(patch).length === 0) {
        deps.outputError('Nothing to stamp — pass at least one of --agent / --role / --runtime / --skill-id / --status / --resolution.');
        process.exit(1);
        return;
      }

      // Agent-attributed done stamps need git-backed evidence.
      const newStatus = patch.status || '';
      if (newStatus === 'done' || (existing.status === 'done' && !args.status)) {
        const targetStatus = newStatus || existing.status;
        if (targetStatus === 'done') {
          const agentId = args.agent || existing.agent_id;
          const runtime = args.runtime || existing.runtime;
          // Human and non-attributed tasks are exempt.
          const isHuman = agentId === 'human' || (!agentId && !runtime);

          if (!isHuman) {
            const requireEvidence = (config.tasks && config.tasks.require_evidence_on_stamp) || args.enforce;
            const evidenceCheck = evaluateDoneEvidence(baseDir, existing, args);

            if (!evidenceCheck.ok) {
              const fullMsg = `${evidenceCheck.reason} Add --commit-sha <sha> for a landing commit or --evidence "<what changed and where>" once git history backs it.`;
              if (requireEvidence) {
                deps.outputError(fullMsg);
                process.exit(1);
              } else {
                console.warn(`\n[WARNING] ${fullMsg}\nSet [tasks].require_evidence_on_stamp = true to enforce now.\n`);
              }
            }
          }
        }
      }

      const updated = taskFiles.updateOne(planningDir, String(args.id), patch);

      // Phase 127 + operator-fix 2026-05-07: XP accumulation hook.
      // Originally required `effectiveSkill` to award XP — operator
      // identified that as a system-discipline failure: many real
      // closures arrive without a skill tag (forgotten flag, mass
      // stamps, work that doesn't fit existing skills). The fix:
      // award XP regardless. When skill is missing, treat it as the
      // emergent placeholder `unknown` (lower weight, but tracked so
      // recurring patterns become proto-skill candidates).
      const effectiveStatus = patch.status || existing.status;
      const effectiveSkill = patch.skill || existing.skill || 'unknown';
      if (effectiveStatus === 'done') {
        const stateXmlPath = path.join(baseDir, root.path, root.planningDir, 'STATE.xml');
        if (fs.existsSync(stateXmlPath)) {
          const stampedIds = xpMath.readStampedTasks(stateXmlPath, fs);
          if (!xpMath.isTaskStamped(stampedIds, updated.id)) {
            // unknown weight = 0.5 (half a regular stamp) — work still
            // counts but nudges operators to label it. Known skills
            // keep their full weight from xp-math's getSkillWeight.
            const weight = effectiveSkill === 'unknown' ? 0.5 : xpMath.getSkillWeight(effectiveSkill);

            // Read current level
            let xml = fs.readFileSync(stateXmlPath, 'utf8');
            const levelMatch = xml.match(/<level\s+value="(\d+)"\s+xp="(\d+)"\s+xp_to_next="(\d+)"\s+loaded_skills="(\d+)"\/?>/);
            if (levelMatch) {
              const curValue = parseInt(levelMatch[1], 10);
              const curXp = parseInt(levelMatch[2], 10);
              const curXpToNext = parseInt(levelMatch[3], 10);
              const curLoadedSkills = parseInt(levelMatch[4], 10);
              const newXp = curXp + weight;

              // Write updated level
              const levelTag = `  <level value="${curValue}" xp="${newXp}" xp_to_next="${curXpToNext}" loaded_skills="${curLoadedSkills}"/>`;
              xml = xml.replace(/(\s*<level\s[^>]*\/?>)/, levelTag);
              fs.writeFileSync(stateXmlPath, xml);

              // Add task to stamped-tasks list
              xpMath.addStampedTask(stateXmlPath, updated.id, fs);

              const nextLevel = xpMath.xpToNextLevel(curValue);
              const skillTag = effectiveSkill === 'unknown'
                ? 'skill: unknown — emergent (consider tagging or creating a proto-skill)'
                : `skill: ${effectiveSkill}`;
              if (newXp >= curXpToNext) {
                console.log(`  +${weight} XP (${skillTag}) — Level ${curValue + 1} unlocked! Run \`gad evolution level-up --projectid ${args.projectid}\` to advance.`);
              } else {
                console.log(`  +${weight} XP (${skillTag}) — ${newXp}/${curXpToNext} (${curXpToNext - newXp} to next level)`);
              }
            }
          } else {
            // Already stamped — idempotent no-op
            console.log(`  (XP already credited for ${updated.id} — idempotent no-op)`);
          }
        }
      }

      console.log(`Stamped ${updated.id}: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(' ')}`);
      deps.maybeRebuildGraph(baseDir, root);
    },
  });
}

module.exports = { createTasksStampCommand };
