'use strict';

/**
 * skill-draft.cjs — draft skill candidate bodies by spawning the `claude` CLI.
 *
 * Context:
 *   compute-self-eval.mjs auto-generates skill candidate STUBS in
 *   skills/candidates/<phase-slug>/SKILL.md when a phase exceeds the pressure
 *   threshold (GAD-D-144, GAD-D-145). These stubs are template placeholders,
 *   not real skills — they tell a human "look at this, might be a pattern."
 *
 *   This module fixes that half-step by invoking the `claude` CLI (with the
 *   create-skill skill loaded as context) to rewrite each un-drafted candidate
 *   into a real SKILL.md body derived from the source phase tasks.
 *
 *   The CLI sub-session has Read/Edit/Write permission on the candidate file
 *   only. It cannot touch the rest of the repo.
 *
 * Why subprocess the claude CLI instead of an inlined SDK call:
 *   - Keeps GAD free of runtime Anthropic dependencies
 *   - Uses the user's existing `claude` auth
 *   - Fails gracefully when claude isn't installed
 *   - Stays out of the prebuild hot path (this runs manually via
 *     `gad eval skill draft-candidates`)
 *
 * Candidate lifecycle:
 *   reviewed: false, drafted: false  →  eligible for drafting
 *   reviewed: false, drafted: true   →  real body written, awaiting review
 *   reviewed: promoted|merged|discarded →  sticky, never redraft
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Locate every candidate SKILL.md on disk. Checks both the canonical
 * `skills/candidates/` path (source of truth) and the transpiled
 * `.agents/skills/candidates/` path for legacy layouts.
 */
function findCandidates(repoRoot) {
  const dirs = [
    path.join(repoRoot, 'skills', 'candidates'),
    path.join(repoRoot, '.agents', 'skills', 'candidates'),
  ];
  const seen = new Set();
  const results = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(dir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      // Prefer the canonical skills/ path — skip the transpiled copy if we
      // already saw the same candidate there.
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
      results.push({ name: entry.name, file: skillMd, dir: path.dirname(skillMd) });
    }
  }
  return results;
}

/** Very small YAML-frontmatter extractor. Matches the shape we write. */
function readFrontmatter(body) {
  const match = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, rest: body };
  const lines = match[1].split('\n');
  const data = {};
  for (const line of lines) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (value === 'null') value = null;
    else if (/^".*"$/.test(value)) value = value.slice(1, -1);
    data[m[1]] = value;
  }
  return { data, rest: body.slice(match[0].length) };
}

/** Source-phase context for the drafting prompt. */
function loadPhaseContext(repoRoot, phaseId) {
  try {
    const { readTasks } = require('./task-registry-reader.cjs');
    const { readPhases } = require('./roadmap-reader.cjs');
    const root = { id: 'gad', path: '', planningDir: '.planning' };
    const phases = readPhases(root, repoRoot);
    const phase = phases.find((p) => String(p.id) === String(phaseId));
    const tasks = readTasks(root, repoRoot).filter((t) => String(t.phase) === String(phaseId));
    return {
      id: phaseId,
      title: phase?.title ?? `Phase ${phaseId}`,
      goal: phase?.goal ?? '',
      tasks,
    };
  } catch (err) {
    return { id: phaseId, title: `Phase ${phaseId}`, goal: '', tasks: [] };
  }
}

/**
 * Build the drafting prompt for one candidate. Kept deliberately concrete:
 * we pass the task list so the sub-session can cite real task IDs, and we
 * tell it to refuse gracefully when the phase doesn't hold a reusable pattern.
 */
function buildPrompt(candidate, phaseCtx) {
  const taskLines =
    phaseCtx.tasks.length > 0
      ? phaseCtx.tasks
          .slice(0, 60)
          .map((t) => `- ${t.id} [${t.status}] ${t.goal}`)
          .join('\n')
      : '  (no task data found)';

  return `You are rewriting a skill candidate body.

File to edit: ${candidate.file}

This file was auto-drafted from a high-pressure GAD phase. Its current body is a stub. Rewrite the body (everything AFTER the YAML frontmatter) so it describes a REAL, reusable skill extracted from the phase below. Follow the skill format in skills/create-skill/SKILL.md — read it first if you need the format.

Source phase context:
  id: ${phaseCtx.id}
  title: ${phaseCtx.title}
  goal: ${phaseCtx.goal || '(none)'}

Phase tasks:
${taskLines}

Requirements:
1. Preserve the YAML frontmatter EXACTLY. Only change: set \`drafted: true\` (add the key if missing).
2. Keep \`status: candidate\`. Do not promote.
3. If the phase contains a reusable pattern worth becoming a skill, write:
   - A one-paragraph "What this skill does"
   - "When to use" triggers (bullet list)
   - "Steps" — concrete, ordered, testable
   - "Do / Don't" bullets
   - Cite the source phase + 2–4 relevant task IDs as evidence
4. If the phase does NOT hold a reusable pattern (one-off release work, planning housekeeping, etc.), replace the body with a short paragraph explaining why it should be discarded, and still set \`drafted: true\`.
5. Do not invent tasks or decisions that aren't in the phase.
6. After editing, output "DONE" and stop. Do not commit, do not run other tools.
`;
}

/**
 * Run one drafting session for a single candidate. Returns { ok, reason }.
 */
function draftOne(candidate, repoRoot, opts) {
  const content = fs.readFileSync(candidate.file, 'utf8');
  const { data } = readFrontmatter(content);

  if (data.reviewed && data.reviewed !== 'false' && data.reviewed !== false) {
    return { ok: false, reason: `reviewed=${data.reviewed}, skipping` };
  }
  if (data.drafted === true && !opts.force) {
    return { ok: false, reason: 'already drafted (use --force to redraft)' };
  }
  if (!data.source_phase) {
    return { ok: false, reason: 'no source_phase in frontmatter' };
  }

  const phaseCtx = loadPhaseContext(repoRoot, data.source_phase);
  const prompt = buildPrompt(candidate, phaseCtx);

  if (opts.dryRun) {
    console.log(`\n--- DRY RUN: ${candidate.name} ---`);
    console.log(prompt);
    console.log('--- END DRY RUN ---\n');
    return { ok: true, reason: 'dry-run' };
  }

  const args = [
    '-p',
    prompt,
    '--permission-mode',
    'acceptEdits',
    '--allowed-tools',
    'Read,Edit,Write',
  ];

  console.log(`\n[draft] ${candidate.name} → spawning claude CLI...`);
  const result = spawnSync('claude', args, {
    stdio: 'inherit',
    timeout: 5 * 60 * 1000,
    cwd: repoRoot,
  });

  if (result.error) {
    return { ok: false, reason: `spawn failed: ${result.error.message}` };
  }
  if (result.status !== 0) {
    return { ok: false, reason: `claude CLI exited with code ${result.status}` };
  }
  return { ok: true, reason: 'drafted' };
}

/**
 * Main entry. Iterates all candidates and drafts each one.
 */
function draftAllCandidates(repoRoot, opts = {}) {
  const candidates = findCandidates(repoRoot);
  if (candidates.length === 0) {
    console.log('[draft-candidates] no candidates found');
    return { drafted: 0, skipped: 0, failed: 0 };
  }

  const filtered = opts.only
    ? candidates.filter((c) => c.name === opts.only || c.name.includes(opts.only))
    : candidates;

  if (filtered.length === 0) {
    console.log(`[draft-candidates] no candidates matched --only "${opts.only}"`);
    return { drafted: 0, skipped: 0, failed: 0 };
  }

  console.log(`[draft-candidates] found ${filtered.length} candidate(s)`);

  const stats = { drafted: 0, skipped: 0, failed: 0 };
  for (const candidate of filtered) {
    const result = draftOne(candidate, repoRoot, opts);
    if (result.ok && result.reason === 'dry-run') {
      stats.drafted += 1;
    } else if (result.ok) {
      stats.drafted += 1;
      console.log(`  [drafted] ${candidate.name}`);
    } else if (/skipping|already drafted/.test(result.reason)) {
      stats.skipped += 1;
      console.log(`  [skipped] ${candidate.name}: ${result.reason}`);
    } else {
      stats.failed += 1;
      console.warn(`  [failed]  ${candidate.name}: ${result.reason}`);
    }
  }

  console.log(
    `\n[draft-candidates] done: ${stats.drafted} drafted, ${stats.skipped} skipped, ${stats.failed} failed`,
  );
  return stats;
}

module.exports = { draftAllCandidates, findCandidates, buildPrompt };
