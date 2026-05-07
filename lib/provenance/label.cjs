'use strict';
/**
 * lib/provenance/label.cjs — quality labeler.
 *
 * Applies the operator's heuristic (decision GLOBAL-D-302) to classify
 * each enriched event as one of:
 *   - good          — survived ≥ K% blame, untouched ≥ N days
 *   - churn         — many edits in short window AND poor survival
 *   - in_progress   — recent + active task, too early to judge
 *   - neutral       — none of the above; needs more time
 *
 * Output: adds `label` field in place. Idempotent (overwrites any prior label).
 */

const fs = require('node:fs');
const path = require('node:path');
const { readJsonl, provenanceDir, loadHeuristic, DEFAULT_HEURISTIC } = require('./index.cjs');

function classify(evt, heuristic) {
  const survival = evt.survival || {};
  const freq = evt.frequency || {};

  const inHead = survival.in_head === true;
  const presentPct = survival.content_present_pct || 0;
  const untouchedDays = (survival.untouched_seconds != null)
    ? survival.untouched_seconds / 86400
    : null;

  const eventAgeHours = (Date.now() - new Date(evt.ts).getTime()) / (60 * 60 * 1000);

  // in_progress: very recent edit (< N hours)
  if (eventAgeHours < heuristic.in_progress_recent_hours) {
    return {
      verdict: 'in_progress',
      reason: `recent edit (${eventAgeHours.toFixed(1)}h ago, threshold ${heuristic.in_progress_recent_hours}h)`,
      confidence: 1.0,
    };
  }

  // churn: high frequency + poor survival
  if (freq.edits_prev_1h >= heuristic.churn_edits_per_hour && presentPct < heuristic.churn_survival_pct) {
    return {
      verdict: 'churn',
      reason: `${freq.edits_prev_1h} edits/hr (≥${heuristic.churn_edits_per_hour}) AND survival ${presentPct}% (<${heuristic.churn_survival_pct}%)`,
      confidence: 0.9,
    };
  }

  // good: high survival + untouched window
  if (inHead && presentPct >= heuristic.good_survival_pct && untouchedDays != null && untouchedDays >= heuristic.good_untouched_days) {
    return {
      verdict: 'good',
      reason: `survival ${presentPct}% (≥${heuristic.good_survival_pct}%) AND untouched ${untouchedDays.toFixed(1)}d (≥${heuristic.good_untouched_days}d)`,
      confidence: 0.95,
    };
  }

  return {
    verdict: 'neutral',
    reason: `survival=${presentPct}% untouched_days=${untouchedDays != null ? untouchedDays.toFixed(1) : 'n/a'} edits_prev_1h=${freq.edits_prev_1h || 0}`,
    confidence: 0.5,
  };
}

function annotateLabels({ planningDir, config }) {
  const heuristic = loadHeuristic(config);
  const dir = provenanceDir(planningDir);
  if (!fs.existsSync(dir)) return { files_processed: 0, by_label: {} };

  const counts = { good: 0, churn: 0, in_progress: 0, neutral: 0 };
  let filesProcessed = 0;

  for (const f of fs.readdirSync(dir)) {
    if (!/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) continue;
    const filePath = path.join(dir, f);
    const events = [];
    for (const evt of readJsonl(filePath)) {
      evt.label = classify(evt, heuristic);
      counts[evt.label.verdict]++;
      events.push(evt);
    }
    fs.writeFileSync(filePath, events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''), 'utf8');
    filesProcessed++;
  }

  return {
    files_processed: filesProcessed,
    by_label: counts,
    heuristic_used: heuristic,
  };
}

module.exports = { annotateLabels, classify, DEFAULT_HEURISTIC };
