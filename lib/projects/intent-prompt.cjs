'use strict';

/**
 * Project-intent capture for `gad projects init`.
 *
 * Operator direction 2026-05-18: PROJECT.md content (purpose, audience,
 * differentiators, non-goals) is merged into AGENTS.md as a `## Project
 * Intent` section so agents have one source of project context. This
 * module collects that intent at init time — interactively when stdin
 * is a TTY, via flags otherwise.
 *
 * Public surface:
 *   collectProjectIntent(args, io?) → Promise<Intent>
 *   renderProjectIntentSection(intent) → string  // ## Project Intent block
 *   PLACEHOLDER_INTENT                            // safe non-interactive default
 *
 * Intent shape:
 *   { purpose: string, audience: string,
 *     differentiators: string[], nonGoals: string[] }
 */

const readline = require('readline');

const PLACEHOLDER_INTENT = Object.freeze({
  purpose: 'TODO — describe what this project does in 1–2 sentences.',
  audience: 'TODO — name the primary audience / users.',
  differentiators: [
    'TODO — what makes this project different (1)',
    'TODO — what makes this project different (2)',
    'TODO — what makes this project different (3)',
  ],
  nonGoals: [
    'TODO — non-goal (1)',
    'TODO — non-goal (2)',
    'TODO — non-goal (3)',
  ],
});

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ask(rl, label) {
  return new Promise((resolve) => rl.question(label, (a) => resolve(String(a || '').trim())));
}

async function collectInteractive(io) {
  const stdin = io && io.stdin ? io.stdin : process.stdin;
  const stderr = io && io.stderr ? io.stderr : process.stderr;
  const rl = readline.createInterface({ input: stdin, output: stderr, terminal: true });
  try {
    stderr.write('\nProject intent — captured into AGENTS.md ## Project Intent.\n');
    stderr.write('Press Enter to accept a TODO placeholder for any field.\n\n');
    const purpose = (await ask(rl, 'Purpose (1–2 sentences): ')) || PLACEHOLDER_INTENT.purpose;
    const audience = (await ask(rl, 'Audience (1–2 lines): ')) || PLACEHOLDER_INTENT.audience;

    stderr.write('Top 3 differentiators (one per line, blank line to finish):\n');
    const differentiators = [];
    for (let i = 0; i < 3; i++) {
      const line = await ask(rl, `  ${i + 1}. `);
      if (!line) break;
      differentiators.push(line);
    }
    stderr.write('Top 3 non-goals (one per line, blank line to finish):\n');
    const nonGoals = [];
    for (let i = 0; i < 3; i++) {
      const line = await ask(rl, `  ${i + 1}. `);
      if (!line) break;
      nonGoals.push(line);
    }
    return {
      purpose,
      audience,
      differentiators: differentiators.length ? differentiators : PLACEHOLDER_INTENT.differentiators.slice(),
      nonGoals: nonGoals.length ? nonGoals : PLACEHOLDER_INTENT.nonGoals.slice(),
    };
  } finally {
    rl.close();
  }
}

/**
 * Resolve project intent from CLI args, with interactive fallback when TTY.
 *
 * @param {object} args  CLI args (purpose, audience, differentiators,
 *   non-goals, nonInteractive).
 * @param {object} [io]  { stdin, stderr, isTTY } — injectable for tests.
 * @returns {Promise<{purpose,audience,differentiators,nonGoals}>}
 */
async function collectProjectIntent(args = {}, io = {}) {
  const flagsProvided = Boolean(
    args.purpose || args.audience || args.differentiators || args['non-goals'] || args.nonGoals,
  );
  const stdin = io.stdin || process.stdin;
  const isTTY = typeof io.isTTY === 'boolean' ? io.isTTY : Boolean(stdin.isTTY);

  if (args['non-interactive'] || args.nonInteractive) {
    return {
      purpose: args.purpose || PLACEHOLDER_INTENT.purpose,
      audience: args.audience || PLACEHOLDER_INTENT.audience,
      differentiators: splitList(args.differentiators).length
        ? splitList(args.differentiators)
        : PLACEHOLDER_INTENT.differentiators.slice(),
      nonGoals: splitList(args['non-goals'] || args.nonGoals).length
        ? splitList(args['non-goals'] || args.nonGoals)
        : PLACEHOLDER_INTENT.nonGoals.slice(),
    };
  }

  if (flagsProvided || !isTTY) {
    return {
      purpose: args.purpose || PLACEHOLDER_INTENT.purpose,
      audience: args.audience || PLACEHOLDER_INTENT.audience,
      differentiators: splitList(args.differentiators).length
        ? splitList(args.differentiators)
        : PLACEHOLDER_INTENT.differentiators.slice(),
      nonGoals: splitList(args['non-goals'] || args.nonGoals).length
        ? splitList(args['non-goals'] || args.nonGoals)
        : PLACEHOLDER_INTENT.nonGoals.slice(),
    };
  }

  return collectInteractive(io);
}

function renderProjectIntentSection(intent) {
  const i = intent || PLACEHOLDER_INTENT;
  const bullets = (arr) => (arr && arr.length ? arr.map((x) => `- ${x}`).join('\n') : '- (none)');
  return [
    '## Project Intent',
    '',
    '_Captured at `gad projects init` — keep current as the project evolves._',
    '',
    '### Purpose',
    '',
    i.purpose,
    '',
    '### Audience',
    '',
    i.audience,
    '',
    '### Differentiators',
    '',
    bullets(i.differentiators),
    '',
    '### Non-goals',
    '',
    bullets(i.nonGoals),
    '',
  ].join('\n');
}

module.exports = {
  PLACEHOLDER_INTENT,
  collectProjectIntent,
  renderProjectIntentSection,
};
