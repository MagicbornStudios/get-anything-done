'use strict';
/**
 * keychain/windows.cjs — Windows DPAPI-backed keychain adapter.
 *
 * Stores per-user-encrypted blobs at:
 *   %LOCALAPPDATA%\gad\keychain\<service>\<account>.dpapi
 *
 * Uses PowerShell's ConvertTo-SecureString / ConvertFrom-SecureString
 * (without -Key) which delegates to DPAPI with the current-user master
 * key. That gives us:
 *   - Per-user scope (another Windows user on the same machine can't read)
 *   - No plaintext on disk
 *   - No additional native deps — PowerShell 5.1+ ships with Windows 10/11
 *
 * This is the same primitive that `Protect-CmsMessage` and the built-in
 * Windows Credential Manager ship on top of. We go direct to DPAPI rather
 * than shelling out to `cmdkey` because cmdkey cannot read back a stored
 * password without Win32 API access (it's a deliberate limitation).
 *
 * Adapter contract (matches lib/keychain/index.cjs dispatcher):
 *   get(service, account)            -> Promise<Buffer|null>   null = not found
 *   set(service, account, bytes)     -> Promise<void>
 *   delete(service, account)         -> Promise<void>
 *   isAvailable()                    -> Promise<boolean>
 *
 * Errors surface as SecretsStoreError('KEYCHAIN_LOCKED'|'KEYCHAIN_UNAVAILABLE').
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { SecretsStoreError } = require('../secrets-store-errors.cjs');

function keychainRoot() {
  const base = process.env.GAD_WINDOWS_KEYCHAIN_ROOT
    || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'gad', 'keychain');
  return base;
}

function blobPath(service, account) {
  const safeService = String(service).replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeAccount = String(account).replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(keychainRoot(), safeService, `${safeAccount}.dpapi`);
}

function locatePowerShell() {
  if (process.env.GAD_POWERSHELL) return process.env.GAD_POWERSHELL;
  // Windows ships powershell.exe at a fixed path. Prefer it over PATH lookup
  // for reliability inside git-bash / mingw shells.
  const sys = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
  const candidate = path.join(sys, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (fs.existsSync(candidate)) return candidate;
  return 'powershell.exe';
}

function runPowerShell(script, stdinBytes) {
  const ps = locatePowerShell();
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-Command', script,
  ];
  const result = spawnSync(ps, args, {
    input: stdinBytes,
    // Omit encoding → stdout/stderr come back as Buffer. Explicit
    // 'buffer' is not a valid value for spawnSync (Node rejects it).
    windowsHide: true,
  });
  if (result.error) {
    throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', `powershell not executable: ${result.error.message}`);
  }
  return {
    status: result.status,
    stdout: result.stdout ? result.stdout.toString('utf8') : '',
    stderr: result.stderr ? result.stderr.toString('utf8') : '',
  };
}

async function isAvailable() {
  if (process.platform !== 'win32') return false;
  const r = runPowerShell('Write-Output "ok"');
  return r.status === 0 && /ok/.test(r.stdout);
}

async function get(service, account) {
  const p = blobPath(service, account);
  if (!fs.existsSync(p)) return null;
  const encoded = fs.readFileSync(p, 'utf8').trim();
  if (!encoded) return null;
  // ConvertTo-SecureString <- the stored string; then marshal the SecureString
  // to a plain UTF-8 blob via BSTR + copy. We echo base64 so the bytes
  // survive the PowerShell->stdout pipe cleanly.
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$enc = [Console]::In.ReadToEnd().Trim()',
    'try {',
    '  $sec = ConvertTo-SecureString -String $enc',
    '} catch {',
    '  Write-Error $_.Exception.Message',
    '  exit 3',
    '}',
    '$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)',
    'try {',
    '  $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)',
    '} finally {',
    '  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)',
    '}',
    'Write-Output $plain',
  ].join('; ');
  const r = runPowerShell(script, encoded);
  if (r.status !== 0) {
    if (/key not valid|invalid data|cannot be decrypted/i.test(r.stderr)) {
      throw new SecretsStoreError('KEYCHAIN_LOCKED', `DPAPI decrypt failed for ${service}/${account}: ${r.stderr.trim()}`);
    }
    throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', `DPAPI decrypt error: ${r.stderr.trim()}`);
  }
  // The plain value was stored as base64 by us on set (see below). Decode.
  const b64 = r.stdout.trim();
  if (!b64) return null;
  try {
    return Buffer.from(b64, 'base64');
  } catch (e) {
    throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', `DPAPI output base64 decode failed: ${e.message}`);
  }
}

async function set(service, account, bytes) {
  if (!Buffer.isBuffer(bytes)) {
    throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', 'windows keychain: set() requires Buffer value');
  }
  const b64 = bytes.toString('base64');
  const p = blobPath(service, account);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$plain = [Console]::In.ReadToEnd().Trim()',
    '$sec = ConvertTo-SecureString -String $plain -AsPlainText -Force',
    '$enc = ConvertFrom-SecureString -SecureString $sec',
    'Write-Output $enc',
  ].join('; ');
  const r = runPowerShell(script, b64);
  if (r.status !== 0) {
    throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', `DPAPI encrypt error: ${r.stderr.trim()}`);
  }
  const encrypted = r.stdout.trim();
  if (!encrypted) {
    throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', 'DPAPI encrypt produced empty output');
  }
  fs.writeFileSync(p, encrypted + '\n', { mode: 0o600 });
}

async function del(service, account) {
  const p = blobPath(service, account);
  if (fs.existsSync(p)) fs.rmSync(p, { force: true });
}

module.exports = {
  get,
  set,
  delete: del,
  isAvailable,
  _blobPath: blobPath, // exposed for tests/introspection
};
