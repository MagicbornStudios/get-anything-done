'use strict';
/**
 * gad discipline — framework discipline scoring.
 *
 * Subcommands:
 *   gad discipline score [--projectid X] [--since 7d|YYYY-MM-DD] [--scope worker|team|global] [--json]
 *   gad discipline rules [--json]
 *   gad discipline explain <rule_id>
 *
 * Auto-loaded by bin/commands/_loader.cjs via the register() export.
 * No edits to bin/gad.cjs required.
 *
 * Phase 123, task 123-01.
 */

const path = require('path');
const { defineCommand } = require('citty');

const { scoreDiscipline, RULE_META } = require('../../lib/discipline/runner.cjs');

// ---------------------------------------------------------------------------
// Pretty-print helpers
// ---------------------------------------------------------------------------

const ANSI = process.stdout.isTTY
  ? { bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', reset: '\x1b[0m' }
  : { bold: '', dim: '', green: '', yellow: '', red: '', reset: '' };

function scoreColor(score) {
  if (score === null) return ANSI.dim;
  if (score >= 0.8) return ANSI.green;
  if (score >= 0.5) return ANSI.yellow;
  return ANSI.red;
}

function fmtScore(score) {
  if (score === null) return 'N/A';
  return (score * 100).toFixed(1) + '%';
}

function scoreBar(score, width = 20) {
  if (score === null) return '[' + '?'.repeat(width) + ']';
  const filled = Math.round(score * width);
  return '[' + '#'.repeat(filled) + '-'.repeat(width - filled) + ']';
}

function printScoreTable(items) {
  // Header
  const cols = ['ID', 'SCORE', 'BAR', 'APPLIED RULES'];
  const widths = [24, 8, 22, 14];
  const pad = (s, w) => String(s == null ? '' : s).slice(0, w).padEnd(w);

  console.log('');
  console.log(ANSI.bold + cols.map((c, i) => pad(c, widths[i])).join('  ') + ANSI.reset);
  console.log(ANSI.dim + widths.map((w) => '─'.repeat(w)).join('  ') + ANSI.reset);

  for (const item of items) {
    const sc = item.score;
    const applied = (item.rules || []).filter((r) => r.applies).length;
    const total = (item.rules || []).length;
    const color = scoreColor(sc);
    console.log(
      pad(item.id, widths[0]) + '  ' +
      color + pad(fmtScore(sc), widths[1]) + ANSI.reset + '  ' +
      color + pad(scoreBar(sc), widths[2]) + ANSI.reset + '  ' +
      pad(`${applied}/${total}`, widths[3])
    );
  }
  console.log('');
}

function printRuleBreakdown(items) {
  for (const item of items) {
    console.log(ANSI.bold + `\n── ${item.id} ──────────────────────────────` + ANSI.reset);
    console.log(`  Overall: ${scoreColor(item.score)}${fmtScore(item.score)}${ANSI.reset}`);
    console.log('');

    const applied = (item.rules || []).filter((r) => r.applies);
    const skipped = (item.rules || []).filter((r) => !r.applies);

    if (applied.length) {
      console.log(ANSI.dim + '  Applied rules:' + ANSI.reset);
      for (const r of applied) {
        const c = scoreColor(r.score);
        const bar = scoreBar(r.score, 12);
        console.log(`    ${pad22(r.rule_id)}  ${c}${fmtScore(r.score)} ${bar}${ANSI.reset}  w=${r.weight}`);
        if (r.evidence) {
          console.log(ANSI.dim + `      evidence: ${r.evidence}` + ANSI.reset);
        }
        if (r.notes) {
          console.log(ANSI.dim + `      notes   : ${r.notes}` + ANSI.reset);
        }
      }
    }

    if (skipped.length) {
      console.log(ANSI.dim + `\n  Skipped (not applicable): ${skipped.map((r) => r.rule_id).join(', ')}` + ANSI.reset);
    }
  }
  console.log('');
}

function pad22(s) { return String(s).padEnd(22); }

// ---------------------------------------------------------------------------
// Subcommand: score
// ---------------------------------------------------------------------------

const disciplineScoreCmd = defineCommand({
  meta: { name: 'score', description: 'Compute discipline score for workers, teams, or global scope' },
  args: {
    projectid: { type: 'string', description: 'Project ID (default: auto-detect)', default: '' },
    since: { type: 'string', description: 'Since date: 7d|14d|YYYY-MM-DD (default: 7d)', default: '7d' },
    scope: { type: 'string', description: 'Score scope: worker|team|global (default: global)', default: 'global' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const scope = args.scope || 'global';
    const result = scoreDiscipline({
      projectid: args.projectid || undefined,
      sinceIso: args.since || '7d',
      scope,
    });

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Pretty output
    console.log('');
    console.log(ANSI.bold + 'GAD Discipline Score' + ANSI.reset);
    console.log(ANSI.dim + `Scope: ${result.scope}  |  Since: ${result.since}` + ANSI.reset);

    printScoreTable(result.items);

    const overall = result.overall_score;
    console.log(
      ANSI.bold + 'Overall: ' + scoreColor(overall) + fmtScore(overall) + ANSI.reset + '  ' +
      scoreColor(overall) + scoreBar(overall, 30) + ANSI.reset
    );
    console.log('');

    // Rule summary table
    console.log(ANSI.bold + 'Rule Summary' + ANSI.reset);
    const summaryRows = Object.entries(result.rule_summary).map(([id, rs]) => ({
      rule_id: id,
      applied: rs.applied_count,
      avg_score: fmtScore(rs.avg_score),
    }));
    if (summaryRows.length) {
      const hdr = ['RULE_ID', 'APPLIED', 'AVG_SCORE'];
      const w = [28, 8, 12];
      const pad = (s, len) => String(s == null ? '' : s).padEnd(len);
      console.log(ANSI.bold + hdr.map((h, i) => pad(h, w[i])).join('  ') + ANSI.reset);
      console.log(ANSI.dim + w.map((n) => '─'.repeat(n)).join('  ') + ANSI.reset);
      for (const row of summaryRows) {
        console.log(
          pad(row.rule_id, w[0]) + '  ' + pad(row.applied, w[1]) + '  ' + pad(row.avg_score, w[2])
        );
      }
    }
    console.log('');

    // Detailed breakdown if more than one item
    if (result.items.length > 1 || result.scope !== 'global') {
      printRuleBreakdown(result.items);
    }
  },
});

// ---------------------------------------------------------------------------
// Subcommand: rules
// ---------------------------------------------------------------------------

const disciplineRulesCmd = defineCommand({
  meta: { name: 'rules', description: 'List available discipline rules with weights and descriptions' },
  args: {
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const rules = RULE_META.map(({ fn: _fn, ...rest }) => rest);

    if (args.json) {
      console.log(JSON.stringify(rules, null, 2));
      return;
    }

    console.log('');
    console.log(ANSI.bold + 'GAD Discipline Rules' + ANSI.reset);
    console.log(ANSI.dim + `${rules.length} rules registered` + ANSI.reset);
    console.log('');

    const w = [28, 6, 55];
    const pad = (s, len) => String(s == null ? '' : s).padEnd(len);
    const hdr = ['RULE_ID', 'WEIGHT', 'DESCRIPTION'];
    console.log(ANSI.bold + hdr.map((h, i) => pad(h, w[i])).join('  ') + ANSI.reset);
    console.log(ANSI.dim + w.map((n) => '─'.repeat(n)).join('  ') + ANSI.reset);

    for (const rule of rules) {
      const desc = rule.description || '';
      // Word-wrap description at w[2] chars
      const words = desc.split(' ');
      const lines = [];
      let cur = '';
      for (const word of words) {
        if ((cur + ' ' + word).trim().length > w[2]) {
          if (cur) lines.push(cur);
          cur = word;
        } else {
          cur = cur ? cur + ' ' + word : word;
        }
      }
      if (cur) lines.push(cur);

      console.log(pad(rule.rule_id, w[0]) + '  ' + pad(rule.weight, w[1]) + '  ' + (lines[0] || ''));
      for (let i = 1; i < lines.length; i++) {
        console.log(pad('', w[0]) + '  ' + pad('', w[1]) + '  ' + lines[i]);
      }
      console.log('');
    }
  },
});

// ---------------------------------------------------------------------------
// Subcommand: explain
// ---------------------------------------------------------------------------

const disciplineExplainCmd = defineCommand({
  meta: { name: 'explain', description: 'Print detailed explanation for a single rule' },
  args: {
    rule_id: { type: 'positional', description: 'Rule ID to explain (e.g. sitrep_format)', required: true },
  },
  run({ args }) {
    const ruleId = args.rule_id;
    const rule = RULE_META.find((r) => r.rule_id === ruleId);

    if (!rule) {
      console.error(`Unknown rule: "${ruleId}"`);
      console.error(`Available: ${RULE_META.map((r) => r.rule_id).join(', ')}`);
      process.exit(1);
      return;
    }

    console.log('');
    console.log(ANSI.bold + `Rule: ${rule.rule_id}` + ANSI.reset);
    console.log(ANSI.dim + '─'.repeat(60) + ANSI.reset);
    console.log('');
    console.log(`  Weight : ${rule.weight}`);
    console.log('');
    console.log('  Description:');
    console.log(`    ${rule.description}`);
    console.log('');
    console.log('  Input signature:');
    console.log(`    ${rule.input}`);
    console.log('');

    // Score table from function source
    console.log('  Scoring:');
    switch (rule.rule_id) {
      case 'sitrep_format':
        console.log('    1.0  SITREP header + Gaps/Open section both present');
        console.log('    0.5  Only one of the two present');
        console.log('    0.0  Neither present');
        break;
      case 'standing_skills':
        console.log('    1.0  All 3 skills loaded before first UI edit');
        console.log('    0.5  2 of 3 loaded');
        console.log('    0.25 1 of 3 loaded');
        console.log('    0.0  None loaded (or no log available with UI edits)');
        break;
      case 'token_economy':
        console.log('    1.0  actual ≤ 1× tier baseline');
        console.log('    0.75 actual ≤ 1.5× baseline');
        console.log('    0.5  actual ≤ 2× baseline');
        console.log('    0.0  actual > 2× baseline');
        console.log('');
        console.log('    Tier baselines (tokens):');
        console.log('      quick=8k  light=32k  medium=64k  heavy=128k  reasoning=200k  deep=400k');
        break;
      case 'commit_attribution':
        console.log('    1.0  agent_id + runtime + skill all populated (non-unknown)');
        console.log('    0.5  1 field missing/unknown');
        console.log('    0.25 2 fields missing/unknown');
        console.log('    0.0  All 3 missing');
        break;
      case 'one_file_per_concern':
        console.log('    1.0  All diff files in ≤1 domain');
        console.log('    0.5  Files in exactly 2 domains');
        console.log('    0.0  Files in 3+ domains');
        break;
      case 'free_tier_verification':
        console.log('    N/A  Runtime is not free-tier (rule skipped)');
        console.log('    1.0  Free-tier runtime + paid-lane follow-up commit within 24h on same files');
        console.log('    0.0  Free-tier runtime + no paid-lane review found');
        break;
      default:
        console.log('    See lib/discipline/index.cjs for scoring logic.');
    }
    console.log('');
  },
});

// ---------------------------------------------------------------------------
// Top-level command
// ---------------------------------------------------------------------------

function register(_ctx) {
  const disciplineCmd = defineCommand({
    meta: { name: 'discipline', description: 'GAD framework discipline scoring (SITREP, skills, attribution, token economy, etc.)' },
    subCommands: {
      score: disciplineScoreCmd,
      rules: disciplineRulesCmd,
      explain: disciplineExplainCmd,
    },
  });

  return { discipline: disciplineCmd };
}

module.exports = { register };
