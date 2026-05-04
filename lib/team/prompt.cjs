'use strict';
/**
 * lib/team/prompt.cjs — compose the prompt text handed to the runtime CLI.
 *
 * Kept intentionally short. The subprocess is a full agentic runtime; it
 * can pull more context on its own. The prompt frames the work item,
 * notes the worker identity (so the agent attributes properly), and
 * reminds on discipline.
 */

const { resolveScopedSkills } = require('../skill-scope.cjs');

function composePrompt(work, { workerId, lane, runtime, skillsScope } = {}) {
  const lines = [];
  lines.push(`# gad team worker task`);
  lines.push('');
  lines.push(`You are a gad team worker (${workerId || 'unknown'}${lane ? `, lane=${lane}` : ''}).`);
  lines.push('');
  const frontmatter = work.frontmatter || {};
  if (work.kind === 'handoff') {
    lines.push(`Claim this handoff and execute it to completion:`);
    lines.push('');
    lines.push(`**Handoff ID:** ${work.ref}`);
    if (work.projectid) lines.push(`**Project:** ${work.projectid}`);
    lines.push('');
    lines.push('Body:');
    lines.push('');
    lines.push(work.body || '(body not loaded)');
    lines.push('');
    lines.push('This handoff is:');
    lines.push(`- context: ${frontmatter.estimated_context || 'prescribed'}${frontmatter.estimated_context === 'design' ? ' (aesthetic judgment needed)' : ''}`);
    lines.push(`- risk: ${frontmatter.risk || 'safe'}${frontmatter.risk === 'irreversible' ? ' (require operator confirmation before external writes)' : ''}`);
    lines.push(`- time: ${frontmatter.time || 'standard'}${frontmatter.time === 'deep' ? ' (checkpoint past 20min)' : ''}`);
    lines.push(`- surface: ${frontmatter.surface || 'local'}${frontmatter.surface === 'api-bound' ? ' (verify env vars first)' : frontmatter.surface === 'human-loop' ? ' (needs operator decision inline)' : ''}`);
  } else {
    lines.push(`Work on task ${work.ref}:`);
    if (work.projectid) lines.push(`**Project:** ${work.projectid}`);
    lines.push('');
    if (work.body) { lines.push(''); lines.push(work.body); }
    else lines.push(`Run \`gad tasks show ${work.ref}\` to read the task body, then proceed.`);
  }
  lines.push('');
  lines.push('---');
  lines.push('VERIFICATION CONSTRAINT:');
  lines.push('- gad.exe is LOCKED by this worker process. Do NOT run `gad self install` or `gad self build` — both will fail and tempt you to kill the lock holder (yourself).');
  lines.push('- Use `node vendor/get-anything-done/bin/gad.cjs <args>` for all in-session verification (per framework CLAUDE.md "which gad to invoke").');
  lines.push('- Pre-commit auto-rebuild was retired 2026-04-23 because it deadlocked during worker sessions. Use `gad self build && gad self install` manually after source changes, outside the locked worker process.');
  lines.push('');
  lines.push('---');

  // Context-budget hint based on context type
  const contextType = (frontmatter.estimated_context || 'prescribed').toLowerCase();
  const budgetHints = {
    prescribed: 'minimize tool calls; don\'t run gad snapshot unless needed',
    bounded: 'load canonical reference for the domain; ok to read spec files',
    exploratory: 'load standing skills; ok to read multiple references and search broadly',
    design: 'load standing skills; ok to read multiple references and examples',
    audit: 'load verifier docs; focus on validation, not exploration',
    decision: 'load prior CONTEXT.md and decision patterns; reason about tradeoffs',
  };
  const hint = budgetHints[contextType] || budgetHints.prescribed;
  lines.push(`Context-budget hint (${contextType}): ${hint}.`);
  lines.push('');

  // Per-context read_first defaults
  const readFirstDefaults = {
    prescribed: 'only files being modified',
    bounded: '+ canonical reference for the domain',
    exploratory: '+ standing skills + broad search',
    design: '+ standing skills (frontend-design, web-design-guidelines, gad-visual-context-system) + examples',
    audit: '+ verifier docs (gad-verify-phase, gad-plan-checker)',
    decision: '+ gad-discuss-phase patterns + prior CONTEXT.md',
  };
  const rfHint = readFirstDefaults[contextType] || readFirstDefaults.prescribed;
  lines.push(`Read-first defaults (${contextType}): ${rfHint}.`);
  lines.push('');

  const scopedSkills = resolveScopedSkills(skillsScope, { runtime, context: contextType });
  if (scopedSkills.length > 0) {
    lines.push(`Scoped preload skills (${runtime || 'any-runtime'} / ${contextType}): ${scopedSkills.join(', ')}.`);
    lines.push('');
  }

  lines.push('Discipline:');
  lines.push('- Run `gad snapshot` first to orient if unsure.');
  lines.push('- Commit each cohesive edit immediately (parallel-agent hygiene).');
  lines.push('- If context autopauses, call `gad pause-work --goal "..."` before exiting.');
  lines.push('- Serialize any TASK-REGISTRY / STATE writes by wrapping them with `gad tasks claim/update` or `gad state log` — the worker loop already holds a team lock around these when invoked via gad CLI.');
  lines.push('- Complete the handoff/task via gad CLI before you finish.');
  return lines.join('\n');
}

module.exports = { composePrompt };
