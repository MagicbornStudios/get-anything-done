'use strict';
/**
 * lib/xp-math.cjs — deterministic XP computation from task-stamp history.
 *
 * Phase 127: skill-weighted XP accumulation and level thresholds.
 * Reference: references/xp-math.md
 *
 * Core formula: xp = sum(skill_weight[task.skill]) for task in done_tasks_with_stamp
 * Level threshold: xp_to_next(L) = 100 * L^1.5
 */

/**
 * Skill weight tiers (per references/xp-math.md).
 * Maps skill slug -> weight. Unrecognized skills default to 1 (atomic floor).
 */
const SKILL_WEIGHTS = {
  // Atomic (weight 1) — single-purpose, low-complexity
  'find-skills': 1,
  'gad-add-todo': 1,
  'gad:add-todo': 1,
  'gad-note': 1,
  'gad:note': 1,
  'gad-settings': 1,
  'gad:settings': 1,
  'gad-help': 1,
  'gad:help': 1,
  'gad-stats': 1,
  'gad:stats': 1,
  'gad-update': 1,
  'gad:update': 1,
  'gad-health': 1,
  'gad:health': 1,
  'gad-check-todos': 1,
  'gad:check-todos': 1,
  'gad-workspace-show': 1,
  'gad:workspace-show': 1,
  'gad-workspace-add': 1,
  'gad:workspace-add': 1,
  'gad-workspace-sync': 1,
  'gad:workspace-sync': 1,
  'gad-task-checkpoint': 1,
  'gad:task-checkpoint': 1,
  'gad-add-tests': 1,
  'gad:add-tests': 1,
  'default': 1,

  // Implementation (weight 3) — multi-step, non-trivial code/analysis
  'frontend-design': 3,
  'gad-debug': 3,
  'gad:debug': 3,
  'gad-plan-phase': 3,
  'gad:plan-phase': 3,
  'gad-discuss-phase': 3,
  'gad:discuss-phase': 3,
  'gad-verify-work': 3,
  'gad:verify-work': 3,
  'gad-verify-phase': 3,
  'gad:verify-phase': 3,
  'gad-validate-phase': 3,
  'gad:validate-phase': 3,
  'gad-docs-update': 3,
  'gad:docs-update': 3,
  'gad-write-feature-doc': 3,
  'gad:write-feature-doc': 3,
  'gad-write-tech-doc': 3,
  'gad:write-tech-doc': 3,
  'gad-write-intent': 3,
  'gad:write-intent': 3,
  'gad-research-phase': 3,
  'gad:research-phase': 3,
  'gad-review': 3,
  'gad:review': 3,
  'gad-forensics': 3,
  'gad:forensics': 3,
  'gad-map-codebase': 3,
  'gad:map-codebase': 3,
  'web-design-guidelines': 3,
  'shadcn': 3,
  'npm-package': 3,
  'self-eval': 3,
  'trace-analysis': 3,

  // Workflow (weight 5) — process-level orchestration
  'gad-execute-phase': 5,
  'gad:execute-phase': 5,
  'gad-cross-config-domain-change': 5,
  'gad:cross-config-domain-change': 5,
  'gad-autonomous': 5,
  'gad:autonomous': 5,
  'gad-progress': 5,
  'gad:progress': 5,
  'gad-next': 5,
  'gad:next': 5,
  'gad-do': 5,
  'gad:do': 5,
  'gad-reapply-patches': 5,
  'gad:reapply-patches': 5,
  'gad-review-backlog': 5,
  'gad:review-backlog': 5,
  'gad-session-report': 5,
  'gad:session-report': 5,
  'consolidate-cli-and-routes': 5,
  'framework-upgrade': 5,
  'monorepo-rename-and-relocate': 5,
  'move-route-with-deprecation-stub': 5,
  'scaffold-tauri-desktop-shell': 5,
  'scaffold-clerk-operator-attribution': 5,
  'scaffold-visual-context-surface': 5,
  'verify-clean-clone-site-build': 5,

  // Compound / Orchestration (weight 8) — meta-level, evolve/bootstrap systems
  'gad-evolution-evolve': 8,
  'gad-new-project': 8,
  'gad:new-project': 8,
  'gad-new-milestone': 8,
  'gad:new-milestone': 8,
  'gad-complete-milestone': 8,
  'gad:complete-milestone': 8,
  'gad-audit-milestone': 8,
  'gad:audit-milestone': 8,
  'gad-milestone-summary': 8,
  'gad:milestone-summary': 8,
  'gad-plan-milestone-gaps': 8,
  'gad:plan-milestone-gaps': 8,
  'gad-audit-uat': 8,
  'gad:audit-uat': 8,
  'gad-visual-context-system': 8,
  'gad:visual-context-system': 8,
  'gad-skill-creator': 8,
  'create-skill': 8,
  'create-proto-skill': 8,
  'merge-skill': 8,
  'eval-skill-install': 8,
  'objective-eval-design': 8,
  'portfolio-sync': 8,
  'gad-manuscript': 8,
  'gad:manuscript': 8,
  'gad-manager': 8,
  'gad:manager': 8,
  'gad-handoffs': 8,
  'gad:handoffs': 8,
  'gad-generation-spawn': 8,
  'gad:generation-spawn': 8,
  'tui-track-slice-coordination': 8,
  'wire-agents-md-context-bootstrap': 8,
  'wire-byok-encrypted-env': 8,
  'wire-skill-provenance-tracking': 8,
};

/**
 * Look up the XP weight for a skill slug.
 * Returns 1 (atomic floor) for unrecognized skills.
 */
function getSkillWeight(skillId) {
  if (!skillId) return 0;
  return SKILL_WEIGHTS[skillId] ?? SKILL_WEIGHTS['default'] ?? 1;
}

/**
 * Compute XP needed to reach the next level.
 * xp_to_next(L) = 100 * L^1.5
 */
function xpToNextLevel(level) {
  return Math.round(100 * Math.pow(level, 1.5));
}

/**
 * Phase 136 — pressure-source resolver path to level-up.
 * Schedule (off-by-one corrected triangular):
 *   level 1->2: 3 resolved signal types
 *   level 2->3: 6
 *   level 3->4: 10
 *   level 4->5: 15
 * Formula: T(L) = L * (L + 3) / 2 + 1, with L=1 anchored at 3 explicitly.
 * Either this OR the legacy XP threshold unlocks a level.
 */
function resolvedSignalsToNextLevel(level) {
  const L = Math.max(1, Math.floor(level));
  return Math.round((L * (L + 3)) / 2) + 1;
}

function meetsResolvedSignalThreshold(level, resolvedSignals) {
  return resolvedSignals >= resolvedSignalsToNextLevel(level);
}

/**
 * Compute total XP from an array of task objects.
 * Operator standing rule 2026-05-07: every done task counts. Missing
 * skill defaults to gad-execute-phase (workflow weight 5) — closing
 * the loop is the work, not the skill tag. The unknown=0.5 nudge was
 * causing audit-trail tax on every retro-stamp; a real default removes
 * the manual stamping ritual entirely.
 */
const DEFAULT_DONE_SKILL = 'gad-execute-phase';

function computeXpFromTasks(tasks) {
  let total = 0;
  for (const task of tasks) {
    if (task.status === 'done') {
      total += getSkillWeight(task.skill || DEFAULT_DONE_SKILL);
    }
  }
  return total;
}

/**
 * Compute level snapshot from a list of tasks. Single source of truth
 * for statusline + snapshot. STATE.xml <level> may shadow this as a
 * cache but should never override it (operator 2026-05-07: "state
 * being manually updated... is just not real time enough").
 */
function computeLevel(tasks) {
  const totalXp = computeXpFromTasks(tasks);
  let level = 1;
  let cumulative = 0;
  for (let i = 0; i < 99; i += 1) {
    const toNext = xpToNextLevel(level);
    if (cumulative + toNext > totalXp) {
      return {
        level,
        xpInLevel: totalXp - cumulative,
        xpToNext: toNext,
        totalXp,
      };
    }
    cumulative += toNext;
    level += 1;
  }
  return { level, xpInLevel: 0, xpToNext: 0, totalXp };
}

/**
 * Read the <stamped-tasks> list from STATE.xml.
 * Returns an array of task IDs that have already contributed XP.
 */
function readStampedTasks(stateXmlPath, fs) {
  if (!fs.existsSync(stateXmlPath)) return [];
  const xml = fs.readFileSync(stateXmlPath, 'utf8');
  const match = xml.match(/<stamped-tasks[^>]*>([\s\S]*?)<\/stamped-tasks>/);
  if (!match) return [];
  return match[1].trim().split(/\s+/).filter(Boolean);
}

/**
 * Check if a task ID is already in the stamped-tasks list.
 */
function isTaskStamped(stampedTaskIds, taskId) {
  return stampedTaskIds.includes(taskId);
}

/**
 * Add a task ID to the stamped-tasks list in STATE.xml.
 * Creates the element if it doesn't exist.
 */
function addStampedTask(stateXmlPath, taskId, fs) {
  let xml = fs.readFileSync(stateXmlPath, 'utf8');
  const escaped = taskId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (/<stamped-tasks[^>]*>[\s\S]*?<\/stamped-tasks>/s.test(xml)) {
    // Element exists with content — insert before closing tag
    xml = xml.replace(/(<\/stamped-tasks>)/, `    ${escaped}\n  $1`);
  } else if (/<stamped-tasks\s*\/>/.test(xml)) {
    // Self-closing -> expand with content
    xml = xml.replace(/<stamped-tasks\s*\/>/, `<stamped-tasks>\n    ${escaped}\n  </stamped-tasks>`);
  } else if (/<stamped-tasks[^>]*>\s*<\/stamped-tasks>/s.test(xml)) {
    // Empty open+close -> add content
    xml = xml.replace(/(<stamped-tasks[^>]*>)\s*(<\/stamped-tasks>)/, `$1\n    ${escaped}\n  $2`);
  } else if (/<level\s/.test(xml)) {
    // No element yet — create as sibling after <level>
    xml = xml.replace(/(\s*<level\s[^>]*\/?>)/, `$1\n  <stamped-tasks>\n    ${escaped}\n  </stamped-tasks>`);
  } else {
    // No element, no level — create after <state>
    xml = xml.replace(/(<state[^>]*>)/, `$1\n  <stamped-tasks>\n    ${escaped}\n  </stamped-tasks>`);
  }
  fs.writeFileSync(stateXmlPath, xml);
}

/**
 * Write the full stamped-tasks list to STATE.xml (used by recalculate-xp).
 */
function writeStampedTasks(stateXmlPath, taskIds, fs) {
  let xml = fs.readFileSync(stateXmlPath, 'utf8');
  const content = taskIds.map(id => `    ${id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`).join('\n');
  const block = `  <stamped-tasks>\n${content}\n  </stamped-tasks>`;

  if (/<stamped-tasks[^>]*>[\s\S]*?<\/stamped-tasks>/s.test(xml)) {
    xml = xml.replace(/<stamped-tasks[^>]*>[\s\S]*?<\/stamped-tasks>/s, block);
  } else if (/<stamped-tasks[^>]*\/>/.test(xml)) {
    xml = xml.replace(/<stamped-tasks[^>]*\/>/, block);
  } else if (/<level\s/.test(xml)) {
    xml = xml.replace(/(\s*<level\s[^>]*\/?>)/, `$1\n${block}`);
  } else {
    xml = xml.replace(/(<state[^>]*>)/, `$1\n${block}`);
  }
  fs.writeFileSync(stateXmlPath, xml);
}

module.exports = {
  SKILL_WEIGHTS,
  DEFAULT_DONE_SKILL,
  getSkillWeight,
  xpToNextLevel,
  resolvedSignalsToNextLevel,
  meetsResolvedSignalThreshold,
  computeXpFromTasks,
  computeLevel,
  readStampedTasks,
  isTaskStamped,
  addStampedTask,
  writeStampedTasks,
};
