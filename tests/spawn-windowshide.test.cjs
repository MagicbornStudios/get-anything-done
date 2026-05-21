'use strict';
/**
 * tests/spawn-windowshide.test.cjs — regression guard for Windows conhost popup fix.
 *
 * RULE (GLOBAL-T-273-17): Every spawn/spawnSync call in the GAD codebase that
 * may run on Windows MUST have `windowsHide: true` in its options object.
 * Without it, Node.js allocates a new console window (conhost.exe) for each
 * spawned process, causing visible popup/flash when team workers, the dispatcher,
 * or any runtime child starts.
 *
 * This test scans the files listed in SCANNED_FILES and FAILS if any
 * spawn()/spawnSync() call lacks `windowsHide`.
 *
 * MAINTENANCE: When you add a new spawn callsite in any of the scanned files,
 * ensure it includes `windowsHide: true`. When you add a new file that spawns
 * child processes, add it to SCANNED_FILES below.
 *
 * The test also verifies that lib/win-spawn.cjs (the central helper) exports
 * the expected API so the file cannot be silently deleted.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/**
 * Files that must have windowsHide on every spawn/spawnSync call.
 * Add new files here when they grow spawn callsites.
 */
const SCANNED_FILES = [
  // Team / dispatcher / worker core
  'lib/team/spawn.cjs',
  'lib/team/subprocess.cjs',
  // Ecosystem (Kael, curator, daemons, dispatcher, workers)
  'bin/commands/ecosystem.cjs',
  // Supervisor (auto-restarts workers/dispatcher)
  'lib/supervisor-agent.cjs',
  // Runtime launch + health checks
  'lib/runtime-launch.cjs',
  'lib/runtime-health/index.cjs',
  'lib/runtime-substrate-scripts.cjs',
  'bin/commands/runtime/launch.cjs',
  // Planning serve / start
  'lib/start-cmd.cjs',
  // Cron event dispatch
  'lib/cron/runner.cjs',
  // Install helpers (PATH update, daily tip)
  'lib/install-helpers.cjs',
  // Git substrate
  'lib/git-substrate/index.cjs',
  // Wrapper base (gad try/trial)
  'lib/wrapper-base.cjs',
  // Dev launch (Kael surfaces, tauri-dev)
  'bin/commands/dev.cjs',
  // Desktop launch
  'bin/commands/desktop.cjs',
  // Overnight daemon
  'bin/commands/overnight.cjs',
  // Trainer dispatch (already had windowsHide but included for completeness)
  'lib/retraining/trainer-dispatch.cjs',
  // Keychain (already had windowsHide)
  'lib/keychain/windows.cjs',
  // System singletons (supervisor, dispatcher, worker)
  'bin/commands/system.cjs',
  // Team status (dispatcher restart)
  'bin/commands/team/status.cjs',
  // Self-update
  'bin/commands/update.cjs',
];

/**
 * Parse a JS source file and find all spawn/spawnSync call-option objects
 * that are MISSING `windowsHide`. Returns an array of { line, snippet }
 * violations.
 *
 * Strategy: find each `spawn(` or `spawnSync(` occurrence in the source,
 * then scan forward for the closing `}` of the options object passed as the
 * 3rd argument. If we find a `{` before the next spawn and no `windowsHide`
 * inside the matching `}`, it is a violation.
 *
 * This is intentionally conservative: it only flags calls where we can
 * clearly see an options object literal inline. Calls that pass a variable
 * (e.g. `spawn(cmd, args, opts)`) are NOT flagged — those are covered by
 * code review. The goal is to catch literal object omissions (the common case).
 */
function findSpawnViolations(source, filePath) {
  const violations = [];
  // Match spawn( or spawnSync( that is NOT winSpawn / winSpawnSync / winSpawnDetached
  // (the helper itself is exempt)
  const spawnRe = /(?<!\bwinSpawn\b)(?<!\bwinSpawnSync\b)(?<!\bwinSpawnDetached\b)\b(spawnSync|spawn)\s*\(/g;
  const lines = source.split('\n');

  // Build a line-number index: character offset → line number
  const offsets = [];
  let acc = 0;
  for (const l of lines) {
    offsets.push(acc);
    acc += l.length + 1; // +1 for '\n'
  }
  function offsetToLine(offset) {
    let lo = 0, hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return lo + 1; // 1-indexed
  }

  let m;
  while ((m = spawnRe.exec(source)) !== null) {
    const callStart = m.index;
    const lineNo = offsetToLine(callStart);

    // Skip if inside a comment line
    const lineContent = lines[lineNo - 1] || '';
    const trimmed = lineContent.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Scan forward from the call's opening paren to find the options object.
    // We look for the third comma-separated argument: span past first two args
    // then find the `{` that opens the options object.
    const afterParen = callStart + m[0].length; // character after `(`
    let depth = 1; // paren depth (we're inside the spawn(...) call now)
    let argDelimiters = 0; // how many top-level commas we've seen
    let optionsObjectStart = -1;
    let optionsObjectEnd = -1;
    let braceDepth = 0;
    let inString = false;
    let stringChar = '';
    let i = afterParen;

    for (; i < source.length && depth > 0; i++) {
      const ch = source[i];

      // String tracking (skip escapes)
      if (!inString) {
        if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; continue; }
      } else {
        if (ch === '\\') { i++; continue; } // escape
        if (ch === stringChar) { inString = false; continue; }
        continue;
      }

      if (ch === '(' || ch === '[') { depth++; continue; }
      if (ch === ')' || ch === ']') {
        depth--;
        if (depth === 0) break; // end of spawn() call
        continue;
      }
      if (ch === '{') {
        if (depth === 1) {
          // Top-level brace in the spawn call's arg list
          if (optionsObjectStart === -1) {
            optionsObjectStart = i;
            braceDepth = 1;
          } else {
            braceDepth++;
          }
        }
        continue;
      }
      if (ch === '}') {
        if (depth === 1 && optionsObjectStart !== -1) {
          braceDepth--;
          if (braceDepth === 0) {
            optionsObjectEnd = i;
            break;
          }
        }
        continue;
      }
      // Top-level commas separate arguments
      if (ch === ',' && depth === 1 && optionsObjectStart === -1) {
        argDelimiters++;
        continue;
      }
    }

    // If we found an inline options object, check for windowsHide
    if (optionsObjectStart !== -1 && optionsObjectEnd !== -1) {
      const optionsText = source.slice(optionsObjectStart, optionsObjectEnd + 1);
      if (!/windowsHide/.test(optionsText)) {
        const snippet = lineContent.trim().slice(0, 80);
        violations.push({ line: lineNo, snippet, file: filePath });
      }
    }
    // If no inline options object found, skip (variable-ref pattern)
  }

  return violations;
}

describe('spawn windowsHide regression guard', () => {
  test('lib/win-spawn.cjs central helper exports expected API', () => {
    const helperPath = path.join(ROOT, 'lib', 'win-spawn.cjs');
    assert.ok(
      fs.existsSync(helperPath),
      'lib/win-spawn.cjs must exist (central Windows-safe spawn helper)',
    );
    const mod = require(helperPath);
    assert.equal(typeof mod.winSpawn, 'function', 'winSpawn must be a function');
    assert.equal(typeof mod.winSpawnSync, 'function', 'winSpawnSync must be a function');
    assert.equal(typeof mod.winSpawnDetached, 'function', 'winSpawnDetached must be a function');
  });

  test('lib/win-spawn.cjs always injects windowsHide: true', () => {
    // Verify the helpers themselves enforce windowsHide by checking their source.
    const helperPath = path.join(ROOT, 'lib', 'win-spawn.cjs');
    const src = fs.readFileSync(helperPath, 'utf8');
    assert.ok(
      /windowsHide:\s*true/.test(src),
      'lib/win-spawn.cjs source must contain windowsHide: true',
    );
  });

  for (const relPath of SCANNED_FILES) {
    const absPath = path.join(ROOT, relPath);

    test(`${relPath} — all inline spawn options include windowsHide`, () => {
      assert.ok(
        fs.existsSync(absPath),
        `Scanned file not found: ${absPath}. If the file was moved/renamed, update SCANNED_FILES in this test.`,
      );
      const source = fs.readFileSync(absPath, 'utf8');
      const violations = findSpawnViolations(source, relPath);

      if (violations.length > 0) {
        const detail = violations
          .map((v) => `  line ${v.line}: ${v.snippet}`)
          .join('\n');
        assert.fail(
          `${relPath} has ${violations.length} spawn call(s) missing windowsHide: true.\n` +
          `Each spawn/spawnSync options object MUST include windowsHide: true to prevent\n` +
          `conhost.exe popup windows on Windows (GLOBAL-T-273-17).\n\n` +
          `Violations:\n${detail}\n\n` +
          `Fix: add windowsHide: true to each options object, or route through\n` +
          `lib/win-spawn.cjs (winSpawn / winSpawnSync / winSpawnDetached).`,
        );
      }
    });
  }

  test('guard catches a missing windowsHide (self-test)', () => {
    // Verify the scanner actually detects violations by running it on a synthetic source.
    const syntheticSource = `
      const { spawnSync } = require('child_process');
      function bad() {
        return spawnSync('node', ['--version'], { encoding: 'utf8' });
      }
    `;
    const violations = findSpawnViolations(syntheticSource, '(synthetic)');
    assert.ok(
      violations.length > 0,
      'Guard must detect spawn missing windowsHide in synthetic source',
    );
  });

  test('guard does NOT flag a call with windowsHide (self-test)', () => {
    const syntheticSource = `
      const { spawnSync } = require('child_process');
      function good() {
        return spawnSync('node', ['--version'], { encoding: 'utf8', windowsHide: true });
      }
    `;
    const violations = findSpawnViolations(syntheticSource, '(synthetic)');
    assert.equal(
      violations.length,
      0,
      'Guard must NOT flag a spawn that already has windowsHide: true',
    );
  });

  test('guard does NOT flag win-spawn helper calls (self-test)', () => {
    const syntheticSource = `
      const { winSpawn, winSpawnSync } = require('./win-spawn.cjs');
      function ok() {
        winSpawn('node', ['--version'], { encoding: 'utf8' });
        winSpawnSync('node', ['--version'], { encoding: 'utf8' });
      }
    `;
    const violations = findSpawnViolations(syntheticSource, '(synthetic)');
    assert.equal(
      violations.length,
      0,
      'Guard must NOT flag winSpawn/winSpawnSync helper calls',
    );
  });
});
