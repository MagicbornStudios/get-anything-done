'use strict';

/**
 * shell-profile-snippet.cjs — produces + installs shell-profile snippets
 * that set `GAD_RUNTIME=<id>` based on runtime-specific env vars present
 * at shell start. After install, every `gad` CLI invocation from that
 * shell tags itself with the correct runtime, so `gad agents status`
 * LIVENESS populates for all runtimes (not just Claude Code).
 *
 * Operator decision 2026-04-19: explicit per-runtime hook installers
 * are week-scale; this is the today-scale fix.
 *
 * Supported shells:
 *   - bash   → ~/.bashrc (Git Bash on Windows, Linux, macOS)
 *   - zsh    → ~/.zshrc
 *   - pwsh   → $PROFILE (PowerShell Core / Windows PowerShell)
 *
 * The snippet is idempotent — bounded by BEGIN_MARK / END_MARK tokens.
 * install() replaces any existing block between the markers. uninstall()
 * removes the block.
 *
 * Runtime order matters: Claude Code last because CLAUDECODE is often
 * inherited when Claude spawns shells for tool use; we want a more
 * specific runtime's env (Cursor, Codex) to win if both are present.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const BEGIN_MARK = '# --- GAD runtime detection (managed) ---';
const END_MARK = '# --- end GAD runtime detection ---';

const PWSH_BEGIN_MARK = '# --- GAD runtime detection (managed) ---';
const PWSH_END_MARK = '# --- end GAD runtime detection ---';

// Known runtimes + their fingerprint env vars. Precedence: most-specific
// first (Cursor / Codex / Gemini / Opencode) so inherited CLAUDECODE from
// a parent Claude Code session doesn't mask a narrower runtime.
const RUNTIME_ORDER = [
  { id: 'cursor',      vars: ['CURSOR_TRACE_ID', 'CURSOR_AGENT_ID', 'CURSOR_SESSION_ID', 'CURSOR_SESSION'] },
  { id: 'codex',       vars: ['CODEX_SESSION_ID', 'CODEX_HOME', 'CODEX_CLI'] },
  { id: 'gemini',      vars: ['GEMINI_SESSION_ID', 'GEMINI_CONFIG_DIR'] },
  { id: 'opencode',    vars: ['OPENCODE_SESSION_ID', 'OPENCODE_HOME'] },
  { id: 'copilot',     vars: ['COPILOT_CONFIG_DIR'] },
  { id: 'antigravity', vars: ['ANTIGRAVITY_CONFIG_DIR'] },
  { id: 'windsurf',    vars: ['WINDSURF_CONFIG_DIR'] },
  { id: 'augment',     vars: ['AUGMENT_CONFIG_DIR'] },
  { id: 'claude-code', vars: ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CONFIG_DIR'] },
];

function bashSnippet() {
  const lines = [BEGIN_MARK, 'if [ -z "$GAD_RUNTIME" ]; then'];
  for (let i = 0; i < RUNTIME_ORDER.length; i++) {
    const { id, vars } = RUNTIME_ORDER[i];
    const test = vars.map((v) => `-n "$${v}"`).join(' ] || [ ');
    const kw = i === 0 ? 'if' : 'elif';
    lines.push(`  ${kw} [ ${test} ]; then export GAD_RUNTIME=${id}`);
  }
  lines.push('  fi');
  lines.push('fi');
  lines.push(END_MARK);
  return lines.join('\n') + '\n';
}

function pwshSnippet() {
  const lines = [PWSH_BEGIN_MARK, 'if (-not $env:GAD_RUNTIME) {'];
  for (let i = 0; i < RUNTIME_ORDER.length; i++) {
    const { id, vars } = RUNTIME_ORDER[i];
    const test = vars.map((v) => `$env:${v}`).join(' -or ');
    const kw = i === 0 ? 'if' : 'elseif';
    lines.push(`    ${kw} (${test}) { $env:GAD_RUNTIME = '${id}' }`);
  }
  lines.push('}');
  lines.push(PWSH_END_MARK);
  return lines.join('\n') + '\n';
}

function defaultProfilePath(shell) {
  const home = os.homedir();
  if (shell === 'bash') return path.join(home, '.bashrc');
  if (shell === 'zsh') return path.join(home, '.zshrc');
  if (shell === 'pwsh') {
    // $PROFILE — PowerShell Core default on Windows
    if (process.platform === 'win32') {
      const docs = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Documents') : home;
      // Prefer PowerShell 7+ profile path; fall back to legacy
      const ps7 = path.join(docs, 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
      const legacy = path.join(docs, 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
      return fs.existsSync(ps7) ? ps7 : legacy;
    }
    return path.join(home, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1');
  }
  throw new Error(`Unknown shell: ${shell}`);
}

function snippetForShell(shell) {
  if (shell === 'bash' || shell === 'zsh') return bashSnippet();
  if (shell === 'pwsh') return pwshSnippet();
  throw new Error(`Unknown shell: ${shell}`);
}

/**
 * Install the snippet into the given profile file.
 * Idempotent: if an existing BEGIN/END block exists, replace it.
 * @returns { path, action: 'installed' | 'updated' | 'dry-run' }
 */
function install({ shell, profilePath, dryRun = false } = {}) {
  if (!shell) throw new Error('shell is required (bash|zsh|pwsh)');
  const target = profilePath || defaultProfilePath(shell);
  const snippet = snippetForShell(shell);
  const begin = shell === 'pwsh' ? PWSH_BEGIN_MARK : BEGIN_MARK;
  const end = shell === 'pwsh' ? PWSH_END_MARK : END_MARK;

  let existing = '';
  let hadExisting = false;
  try {
    existing = fs.readFileSync(target, 'utf8');
    hadExisting = true;
  } catch { /* file doesn't exist — we'll create it */ }

  const beginIdx = existing.indexOf(begin);
  const endIdx = existing.indexOf(end);
  let updated;
  let action;
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    // Replace existing block
    const before = existing.slice(0, beginIdx);
    const after = existing.slice(endIdx + end.length);
    updated = before + snippet.trimEnd() + after;
    action = 'updated';
  } else {
    const prefix = hadExisting && existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    updated = existing + prefix + (hadExisting && existing.length > 0 ? '\n' : '') + snippet;
    action = 'installed';
  }

  if (dryRun) {
    return { path: target, action: 'dry-run', snippet, previewHadExisting: hadExisting };
  }

  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(target, updated);
  return { path: target, action };
}

/**
 * Remove the snippet block from the profile file.
 * @returns { path, action: 'removed' | 'absent' | 'dry-run' }
 */
function uninstall({ shell, profilePath, dryRun = false } = {}) {
  const target = profilePath || defaultProfilePath(shell);
  const begin = shell === 'pwsh' ? PWSH_BEGIN_MARK : BEGIN_MARK;
  const end = shell === 'pwsh' ? PWSH_END_MARK : END_MARK;

  let existing;
  try { existing = fs.readFileSync(target, 'utf8'); } catch {
    return { path: target, action: 'absent' };
  }
  const beginIdx = existing.indexOf(begin);
  const endIdx = existing.indexOf(end);
  if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) {
    return { path: target, action: 'absent' };
  }
  // Remove block + one trailing newline if present
  const before = existing.slice(0, beginIdx);
  let after = existing.slice(endIdx + end.length);
  if (after.startsWith('\n')) after = after.slice(1);
  const updated = (before.endsWith('\n\n') ? before.slice(0, -1) : before) + after;

  if (dryRun) return { path: target, action: 'dry-run' };
  fs.writeFileSync(target, updated);
  return { path: target, action: 'removed' };
}

/**
 * Inspect whether the snippet is currently installed in the given profile.
 * @returns { path, installed, matchesCurrent, existingBlock }
 */
function status({ shell, profilePath } = {}) {
  const target = profilePath || defaultProfilePath(shell);
  let existing;
  try { existing = fs.readFileSync(target, 'utf8'); } catch {
    return { path: target, installed: false, matchesCurrent: false, existingBlock: null };
  }
  const begin = shell === 'pwsh' ? PWSH_BEGIN_MARK : BEGIN_MARK;
  const end = shell === 'pwsh' ? PWSH_END_MARK : END_MARK;
  const beginIdx = existing.indexOf(begin);
  const endIdx = existing.indexOf(end);
  if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) {
    return { path: target, installed: false, matchesCurrent: false, existingBlock: null };
  }
  const existingBlock = existing.slice(beginIdx, endIdx + end.length);
  const current = snippetForShell(shell).trimEnd();
  return {
    path: target,
    installed: true,
    matchesCurrent: existingBlock === current,
    existingBlock,
  };
}

module.exports = {
  BEGIN_MARK,
  END_MARK,
  RUNTIME_ORDER,
  bashSnippet,
  pwshSnippet,
  snippetForShell,
  defaultProfilePath,
  install,
  uninstall,
  status,
};
