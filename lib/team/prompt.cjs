'use strict';
/**
 * lib/team/prompt.cjs — compose the prompt text handed to the runtime CLI.
 *
 * Kept intentionally short. The subprocess is a full agentic runtime; it
 * can pull more context on its own. The prompt frames the work item,
 * notes the worker identity (so the agent attributes properly), and
 * reminds on discipline.
 */

function composePrompt(work, { workerId, lane } = {}) {
  const lines = [];
  lines.push(`# gad team worker task`);
  lines.push('');
  lines.push(`You are a gad team worker (${workerId || 'unknown'}${lane ? `, lane=${lane}` : ''}).`);
  lines.push('');
  if (work.kind === 'handoff') {
    lines.push(`Claim this handoff and execute it to completion:`);
    lines.push('');
    lines.push(`**Handoff ID:** ${work.ref}`);
    if (work.projectid) lines.push(`**Project:** ${work.projectid}`);
    lines.push('');
    lines.push('Body:');
    lines.push('');
    lines.push(work.body || '(body not loaded)');
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
  lines.push('- Pre-commit hook may fail on the `gad self install` step if gad.exe is locked. That is expected. Your fix is already committed. `git commit --no-verify` is acceptable IF operator has authorized --no-verify for this session (check handoff body).');
  lines.push('');
  lines.push('---');
  lines.push('Discipline:');
  lines.push('- Run `gad snapshot` first to orient if unsure.');
  lines.push('- Commit each cohesive edit immediately (parallel-agent hygiene).');
  lines.push('- If context autopauses, call `gad pause-work --goal "..."` before exiting.');
  lines.push('- Serialize any TASK-REGISTRY / STATE writes by wrapping them with `gad tasks claim/update` or `gad state log` — the worker loop already holds a team lock around these when invoked via gad CLI.');
  lines.push('- Complete the handoff/task via gad CLI before you finish.');
  return lines.join('\n');
}

module.exports = { composePrompt };
