'use strict';

const fs = require('fs');
const path = require('path');
const { pickNodeExecutable } = require('./node-exec.cjs');

function normalizeRuntimeLaunchId(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'claude') return 'claude-code';
  if (raw === 'codex') return 'codex-cli';
  if (raw === 'gemini') return 'gemini-cli';
  if (raw === 'open-code') return 'opencode';
  return raw;
}

function buildInteractiveRuntimeLaunchSpec(runtimeId, runtimeRepoRoot) {
  if (runtimeId === 'claude-code') {
    return { command: 'claude', args: [] };
  }
  if (runtimeId === 'codex-cli') {
    return {
      command: pickNodeExecutable(),
      args: [path.join(runtimeRepoRoot, 'scripts', 'codex-trial.mjs'), '--'],
    };
  }
  if (runtimeId === 'gemini-cli') {
    return {
      command: pickNodeExecutable(),
      args: [path.join(runtimeRepoRoot, 'scripts', 'gemini-trial.mjs'), '--'],
    };
  }
  if (runtimeId === 'opencode') {
    return {
      command: pickNodeExecutable(),
      args: [path.join(runtimeRepoRoot, 'scripts', 'opencode-trial.mjs'), '--'],
    };
  }
  throw new Error(`Unsupported runtime id for interactive launch: ${runtimeId}`);
}

function escapePowerShellSingleQuoted(value) {
  return `'${String(value || '').replace(/'/g, "''")}'`;
}

function buildPowerShellArrayLiteral(values) {
  const entries = Array.isArray(values) ? values : [];
  if (entries.length === 0) return '@()';
  return `@(\n${entries.map((entry) => `  ${escapePowerShellSingleQuoted(entry)}`).join(',\n')}\n)`;
}

function writeRuntimeLaunchScriptWindows({ command, args = [], cwd, runtimeId }) {
  const os = require('os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-runtime-launch-'));
  const scriptPath = path.join(tmpDir, 'launch.ps1');
  const lines = [
    '$ErrorActionPreference = "Stop"',
    `$host.UI.RawUI.WindowTitle = ${escapePowerShellSingleQuoted(`GAD Runtime: ${runtimeId}`)}`,
    `$wd = ${escapePowerShellSingleQuoted(cwd)}`,
    'Set-Location -LiteralPath $wd',
    `$cmd = ${escapePowerShellSingleQuoted(command)}`,
    `$argList = ${buildPowerShellArrayLiteral(args)}`,
    'Write-Host ""',
    `Write-Host ${escapePowerShellSingleQuoted(`[gad runtime launch] ${runtimeId}`)} -ForegroundColor Cyan`,
    'Write-Host ""',
    'if ($argList.Count -gt 0) {',
    '  & $cmd @argList',
    '} else {',
    '  & $cmd',
    '}',
    '$exitCode = $LASTEXITCODE',
    'if ($null -ne $exitCode -and $exitCode -ne 0) {',
    '  Write-Host ""',
    `  Write-Host ${escapePowerShellSingleQuoted('[gad runtime launch] process exited with code')} $exitCode -ForegroundColor Yellow`,
    '}',
    '# Best-effort cleanup of temp launcher artifacts after script execution.',
    'try {',
    '  $self = $MyInvocation.MyCommand.Path',
    '  if ($self -and (Test-Path -LiteralPath $self)) { Remove-Item -LiteralPath $self -Force -ErrorAction SilentlyContinue }',
    '  $dir = Split-Path -Parent $self',
    '  if ($dir -and (Test-Path -LiteralPath $dir)) { Remove-Item -LiteralPath $dir -Force -ErrorAction SilentlyContinue }',
    '} catch {}',
  ];
  fs.writeFileSync(scriptPath, `${lines.join('\r\n')}\r\n`, 'utf8');
  return { scriptPath };
}

function launchRuntimeInNewShellWindows({ command, args = [], cwd, runtimeId = 'runtime' }) {
  const { spawn } = require('child_process');
  const argList = Array.isArray(args) ? args : [];
  const { scriptPath } = writeRuntimeLaunchScriptWindows({
    command,
    args: argList,
    cwd,
    runtimeId,
  });
  const child = spawn(
    'powershell',
    ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    {
      cwd,
      env: process.env,
      detached: true,
      windowsHide: false,
      stdio: 'ignore',
    },
  );
  if (!child || !child.pid) {
    throw new Error(`Failed to launch runtime shell for ${command}.`);
  }
  child.unref();
}

module.exports = {
  normalizeRuntimeLaunchId,
  buildInteractiveRuntimeLaunchSpec,
  escapePowerShellSingleQuoted,
  buildPowerShellArrayLiteral,
  writeRuntimeLaunchScriptWindows,
  launchRuntimeInNewShellWindows,
};
