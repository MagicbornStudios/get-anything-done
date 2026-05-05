'use strict';
/**
 * lib/team/free-tier-review.cjs — auto-queue review handoffs for free-tier
 * worker completions.
 *
 * Free-tier OpenRouter models (currently w4 nemotron-3 reasoning, w5 gpt-oss)
 * underperform paid tiers. When they complete a handoff successfully we queue
 * a closeout-review handoff routed to claude-code (preferred) for second-pass
 * verification. See task GLOBAL-T-131-09.
 *
 * Trigger contract: caller invokes `maybeQueueReview` ONLY when the worker
 * loop has just observed a non-rate-limited, exit-code-0 work-complete for a
 * `kind === 'handoff'` work item. This module decides whether the lane needs
 * review and writes the new handoff via `createHandoff`.
 */

function isFreeTierLane(cfg, lane, spec) {
  if (spec && spec.requires_review === true) return true;
  const lanes = (cfg && Array.isArray(cfg.free_tier_lanes)) ? cfg.free_tier_lanes : [];
  if (lanes.length === 0) return false;
  return Boolean(lane && lanes.includes(lane));
}

function buildReviewBody({ originalRef, projectid, phase, taskId, workerId, lane, runtime, commit }) {
  const lines = [
    '## Free-tier review',
    '',
    `- **Original handoff:** \`${originalRef}\``,
    `- **Worker:** \`${workerId}\` (lane: \`${lane}\`, runtime: \`${runtime}\`)`,
    `- **Project / phase:** \`${projectid || 'unknown'}\` / \`${phase || 'unknown'}\``,
    taskId ? `- **Task:** \`${taskId}\`` : '- **Task:** (none)',
    commit ? `- **Commit:** \`${commit}\`` : '- **Commit:** (not recorded)',
    '',
    '## Action',
    '',
    'Verify this completion: confirm acceptance gate satisfied; flag any quality',
    'issues; if material, file a fix handoff. Mark this review handoff complete',
    'when done.',
    '',
    'Free-tier models (nemotron-3, gpt-oss) underperform paid tiers — assume',
    'the work needs a real second pass, not a rubber stamp.',
  ];
  return lines.join('\n');
}

/**
 * Decide-and-queue. Returns the queued handoff descriptor (or null if no
 * review was needed / write failed silently). Errors are caught and logged
 * via logWrite — never thrown into the worker loop.
 */
function maybeQueueReview({
  baseDir,
  cfg,
  spec,
  workerId,
  lane,
  runtime,
  work,
  result,
  handoffsLib,
  logWrite,
}) {
  if (!handoffsLib || typeof handoffsLib.createHandoff !== 'function') return null;
  if (!work || work.kind !== 'handoff') return null;
  if (!result || result.rate_limited || result.code !== 0) return null;
  if (!isFreeTierLane(cfg, lane, spec)) return null;

  const fm = work.frontmatter || {};
  const projectid = fm.projectid || work.projectid || null;
  const phase = fm.phase || null;
  if (!projectid || !phase) {
    logWrite({ kind: 'review-handoff-skip', ref: work.ref, reason: 'missing-projectid-or-phase' });
    return null;
  }

  const body = buildReviewBody({
    originalRef: work.ref,
    projectid,
    phase,
    taskId: fm.task_id || null,
    workerId,
    lane,
    runtime,
    commit: (result && result.commit_sha) || null,
  });

  try {
    const created = handoffsLib.createHandoff({
      baseDir,
      projectid: String(projectid),
      phase: String(phase),
      taskId: fm.task_id ? `${fm.task_id}-review` : null,
      priority: 'normal',
      estimatedContext: 'bounded',
      body,
      createdBy: `team-${workerId}-free-tier-review`,
      runtimePreference: 'claude-code',
    });
    logWrite({
      kind: 'review-handoff-queued',
      original_ref: work.ref,
      review_ref: created.id,
      worker: workerId,
      lane,
      runtime_preference: 'claude-code',
    });
    return created;
  } catch (err) {
    logWrite({ kind: 'review-handoff-error', ref: work.ref, error: err.message });
    return null;
  }
}

module.exports = { maybeQueueReview, isFreeTierLane, buildReviewBody };
