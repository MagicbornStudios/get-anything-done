#!/usr/bin/env node
'use strict';
/**
 * Regenerate the inline STATUSLINE_SKILL_WEIGHTS table in
 * hooks/gad-statusline.js from the canonical lib/xp-math.cjs source.
 *
 * The hook runs as a standalone Claude statusline command (no require
 * access to gad install paths), so the table is duplicated. Run this
 * after editing SKILL_WEIGHTS in lib/xp-math.cjs:
 *
 *   node vendor/get-anything-done/scripts/regen-statusline-weights.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks', 'gad-statusline.js');
const HOOK_DIST = path.join(ROOT, 'hooks', 'dist', 'gad-statusline.js');
const { SKILL_WEIGHTS } = require(path.join(ROOT, 'lib', 'xp-math.cjs'));

function buildBlock() {
  const entries = Object.entries(SKILL_WEIGHTS).filter(([k]) => k !== 'default');
  const tiers = { 1: [], 3: [], 5: [], 8: [] };
  for (const [k, v] of entries) {
    if (tiers[v]) tiers[v].push(k);
  }
  for (const t of Object.keys(tiers)) tiers[t].sort();
  const tierLabel = { 1: 'atomic', 3: 'implementation', 5: 'workflow', 8: 'compound' };
  const lines = [
    '// Auto-mirrored from lib/xp-math.cjs SKILL_WEIGHTS. Statusline runs as a',
    '// standalone Claude hook (no require access to the gad install path), so',
    '// we inline the table. To regenerate after editing lib/xp-math.cjs:',
    '//   node vendor/get-anything-done/scripts/regen-statusline-weights.cjs',
    'const STATUSLINE_SKILL_WEIGHTS = {',
  ];
  for (const t of [1, 3, 5, 8]) {
    if (!tiers[t].length) continue;
    lines.push(`  // ${tierLabel[t]} = ${t}${t === 1 ? ' (also default for unrecognized via ?? 1 fallback below)' : ''}`);
    for (let i = 0; i < tiers[t].length; i += 4) {
      const chunk = tiers[t].slice(i, i + 4).map(k => `'${k}': ${t}`).join(', ');
      lines.push(`  ${chunk},`);
    }
  }
  lines.push('};');
  return lines.join('\n');
}

function main() {
  const block = buildBlock();
  for (const target of [HOOK, HOOK_DIST]) {
    if (!fs.existsSync(target)) continue;
    const src = fs.readFileSync(target, 'utf8');
    const startMarker = '// Auto-mirrored from lib/xp-math.cjs SKILL_WEIGHTS';
    const endMarker = '};';
    const start = src.indexOf(startMarker);
    if (start === -1) {
      console.error(`Marker not found in ${target} — skipping`);
      continue;
    }
    const end = src.indexOf(endMarker, start);
    if (end === -1) {
      console.error(`End marker not found in ${target} — skipping`);
      continue;
    }
    const replaced = src.slice(0, start) + block + src.slice(end + endMarker.length);
    fs.writeFileSync(target, replaced);
    console.log(`Regenerated weights in ${path.relative(ROOT, target)}`);
  }
}

main();
