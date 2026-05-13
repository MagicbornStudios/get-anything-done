'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { classifyProtoSkillDraftingState } = require('../../../lib/proto-skill-state.cjs');
const { computePressure } = require('../../../lib/entropy/compute.cjs');
const { buildCompactStatusline } = require('../../../lib/agents/evolution-context.cjs');

/**
 * Try to find the project root by walking up from cwd.
 */
function findProjectRoot(start) {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

function createEvolutionStatusCommand({ repoRoot, evolutionPaths, protoSkillRelativePath }) {
  return defineCommand({
    meta: { name: 'status', description: 'Show evolution state - pending proto-skills + candidates + pressure dimensions' },
    run() {
      const { candidatesDir, protoSkillsDir, evolutionsDir } = evolutionPaths(repoRoot);
      const candidates = fs.existsSync(candidatesDir)
        ? fs.readdirSync(candidatesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
        : [];
      const protoSkills = fs.existsSync(protoSkillsDir)
        ? fs.readdirSync(protoSkillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
        : [];
      const evolutions = fs.existsSync(evolutionsDir)
        ? fs.readdirSync(evolutionsDir).filter((e) => !e.startsWith('.'))
        : [];

      const drafting = classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir);

      // Compute pressure
      const projectRoot = findProjectRoot(repoRoot || process.cwd());
      let pressureScore = 0;
      let pressureBreakdown = {};
      try {
        const p = computePressure(/*projectid*/ undefined, { baseDir: projectRoot });
        if (p && typeof p.score === 'number') {
          pressureScore = p.score;
          pressureBreakdown = p.breakdown || {};
        }
      } catch { /* pressure is optional */ }

      // ── Output ──────────────────────────────────────────────────────────
      console.log(`Active evolution: ${evolutions[evolutions.length - 1] || '(no marker found)'}`);
      console.log('');

      console.log('Drafting queue (create-proto-skill):');
      console.log(`  pending:     ${drafting.pending.length}   (candidate without proto-skill dir)`);
      console.log(`  in-progress: ${drafting.inProgress.length}   (PROVENANCE.md present, SKILL.md missing - resume target)`);
      console.log(`  complete:    ${drafting.complete.length}   (proto-skill bundle drafted)`);
      console.log('');

      // Pressure dimensions
      console.log('Pressure dimensions:');
      const pd = pressureBreakdown;
      console.log(`  skill-entropy:         ${(pressureScore * 100).toFixed(0)}% ${buildCompactStatusline(pressureScore)}`);
      console.log(`  handoff-context-budget: ${pd.rate_limits || 0} rate-limit events  |  ${pd.open_handoffs || 0} open handoffs`);
      console.log(`  worker-load:           ${pd.worker_failures || 0} recent worker failures  |  ${pd.handoffs_with_unclaims || 0} bouncy handoffs`);
      console.log(`  token-budget:          ${pd.errors_recent || 0} recent errors  |  ${pd.errors_open || 0} open errors`);
      if (pd.resolved_signals > 0) {
        console.log(`  resolved-signals:      ${pd.resolved_signals}  (${(pd.resolved_signal_list || []).join(', ')})`);
      }
      console.log(`  composite pressure:    ${pressureScore.toFixed(3)} (0.0–1.0)${pressureScore >= 0.7 ? '  ⚡ evolution recommended' : ''}`);
      console.log('');

      if (drafting.inProgress.length > 0) {
        console.log('Resume in-progress proto-skills (previous run crashed mid-draft):');
        for (const slug of drafting.inProgress) {
          console.log(`  - ${protoSkillRelativePath(slug)}/   [PROVENANCE.md only]`);
        }
        console.log('');
      }

      if (candidates.length > 0) {
        console.log(`Candidates (raw, awaiting drafting): ${candidates.length}`);
        for (const c of candidates) console.log(`  - .planning/candidates/${c}/`);
        console.log('');
      }
      if (protoSkills.length > 0) {
        console.log(`Proto-skills (drafted, awaiting human review): ${protoSkills.length}`);
        for (const p of protoSkills) {
          const hasValidation = fs.existsSync(path.join(protoSkillsDir, p, 'VALIDATION.md'));
          console.log(`  - ${protoSkillRelativePath(p)}/   ${hasValidation ? '[validated]' : '[no validation yet]'}`);
        }
        console.log('');
        console.log('Review then run:');
        console.log('  gad evolution install <slug> [--codex|--claude|...]   # test without promotion');
        console.log('  gad evolution promote <slug>   # joins species DNA');
        console.log('  gad evolution discard <slug>   # delete');
      }
    },
  });
}

module.exports = { createEvolutionStatusCommand };
